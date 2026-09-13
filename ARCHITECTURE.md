# Architecture Deep Dive

PoPo.meme is one product split into three cooperating layers:

1. **On-chain Diamond** — trading, liquidity, fees, content access, settlement.
2. **Off-chain backend** — social/content metadata, indexing, admin review.
3. **Client** — React SPA with embedded wallets, strict wallet-selection rules
   and a read/write path engineered for multi-chain use.

---

## 1. On-chain: one Diamond, many facets

All business contracts are deployed behind an **EIP-2535 Diamond proxy**.
A single address holds storage; independently upgradable facets expose
functions. Shared infrastructure facets (`ERC6909`, `AccessControl`,
`EIP712`, `UserNonce`, `Pausable`, …) are inherited by app facets, so all
economic activity settles against **one multi-token ledger**.

```
Diamond (single address, AppStorage)
│
├── shared facets
│   ├── ERC6909            multi-token ledger (every asset is an id)
│   ├── AccessControl      role → allowed selectors, canCall()
│   ├── EIP712 / UserNonce typed signatures for gasless-style flows
│   ├── Pausable / Ownable / DiamondCut / DiamondLoupe
│
└── application diamonds (facets mounted on the same pattern)
    ├── PPHatchSwapApp
    │   ├── PPHatchSwap     create / buy / sell on the bonding curve
    │   ├── Migration       curve → concentrated-liquidity graduation
    │   ├── PoolManager     v4-style pools, ticks, flash accounting, hooks
    │   ├── Vault           ERC20 ⇄ ERC6909 1:1 wrapper ($P underwriting)
    │   ├── Referral        two-level fee share + gold tier
    │   ├── Episode         paid video access + buyback treasury
    │   ├── Admin           config, fee withdrawal
    │   └── hooks/CreatorFeeHook   external CREATE2-mined afterSwap hook
    │
    └── PPApp (prediction market)
        ├── Market          create/enable/end/finalize, buy/sell YES-NO
        └── Admin           review & settlement controls
```

### Why Diamond

- **One approval, one ledger**: a user who deposited $P into the Vault holds an
  internal balance; curve trades, AMM swaps, episode payments and referral
  payouts are all internal 6909 transfers — no per-contract ERC20 approvals.
- **Upgradability without migration**: math or fee policy can evolve behind the
  same address and the same token ids/liquidity.
- **Role granularity**: `AccessControl` stores permission as
  `selector → role → bool`, enabling least-privilege admins (e.g. a key that
  can review markets but not withdraw fees).

### Storage discipline

Every facet inherits a shared `AppStorage` struct pinned at a fixed storage
slot; facet-specific libraries use their own namespaced slots. Because the
migration facet performs *external self-calls* (v4-router style) into the
PoolManager facet, the code carefully distinguishes `msg.sender == address(this)`
inside `unlockCallback` from external callers.

---

## 2. The token lifecycle

```
                 create (fee in $P)
                        │
                        ▼
        ┌────── Bonding curve phase ──────┐
        │  total supply minted to Diamond │
        │   • realTokenReserves for sale  │
        │   • reserve % → creator vesting │
        │   • remainder permanently locked│
        │                                 │
        │  buy/sell: xy=k virtual reserves│
        │  fees: platform + creator (+    │
        │  referral carve-out)            │
        └───────────────┬─────────────────┘
            realQuoteReserves ≥ graduationThreshold
                        │  permissionless migrate()
                        ▼
        ┌──── Concentrated liquidity ────┐
        │  initializePool(sqrtP derived  │
        │  from curve reserves)          │
        │  full-range position locked to │
        │  Diamond, deltas netted zero   │
        │  afterSwap hook ⇒ tiered       │
        │  creator fee continues forever │
        └────────────────────────────────┘
                        │
        creator reserve tokens: cliff + linear vest
        (clock starts at graduation)
```

Two independent price mechanisms before/after graduation:

| Phase | Pricing | Fee mechanism |
|---|---|---|
| Curve | `tokenOut = vToken − ⌈k / (vQuote + netQuoteIn)⌉` | fixed bps platform + creator bps per trade |
| AMM | tick-based concentrated liquidity, sqrt-price steps | LP fee + protocol fee + **hook** creator fee |

The fee story is the product story: **creators keep earning after graduation**,
and buying episodes later triggers burns of the same coin.

---

## 3. PoolManager (v4-style, purpose-built)

Not a wrapper around Uniswap — the contracts implement the core mechanisms
directly against the internal ERC-6909 ledger:

- `PoolKey {currency0, currency1, fee, tickSpacing, hooks}`, pool id =
  `keccak256(abi.encode(key))`.
- `SwapMath.computeSwapStep` + `SqrtPriceMath` for within-tick moves;
  `Tick` / `TickBitmap` (`BitMath` MSB word scan) for initialized-tick crossing.
- **Flash accounting**: all swaps/liquidity changes run inside an `unlock`
  callback session. Operations record signed deltas; at session end every
  currency delta must settle to zero (`settle` / `take` / `_accountDelta`).
- **Hooks**: permission bits are read from the hook address's low 14 bits.
  The deployed `CreatorFeeHook` is CREATE2-mined so its address ends in
  `0x44` = `AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA`.

Because currencies are 6909 ids (not ERC20 addresses), "settlement" inside the
Diamond is pure ledger movement — which is what makes zero-transfer migration
seeding and the buyback router cheap.

---

## 4. Creator economy: episodes + buyback-and-burn

```
Episode price ($P / 6909 quote)
   ├── platform share   → claimable by platform admin
   ├── creator share    → claimable by coin creator
   └── buyback share    → per-coin treasury

executeDailyBuyback(tokenId)   // permissionless, 1/UTC-day
   ├── amount = min(treasury, governanceCap)
   ├── router.unlock → exact-in swap, sqrtPriceLimit = currentP·0.95
   ├── bought coins delivered to Diamond and immediately _burn()
   └── unspent quote refunded in the same call
```

The router (`EpisodeBuybackRouter`) holds no funds between transactions; the
facet funds it and receives refunds atomically. Access to episodes is a simple
permanent mapping — deleted paid content can never re-appear behind the same
slot with different data.

Referrals are integrated at the fee source: the curve/AMM hands the platform fee
to `_accrueReferralFee`, which credits direct + indirect referrers and returns
the reserved amount so the facet never double-counts it. Edge tier (default vs
gold) is frozen at *bind time*.

---

## 5. Prediction market (PPApp)

- Outcomes are ERC-1155 share NFTs (`yesNftId`, `noNftId`), minted 1:1 on buy.
- Price follows `price = k·√(supply) + c` — a square-root curve that makes early
  contrarian shares cheap and expresses probability-like prices.
- Lifecycle: application (off-chain review) → `adminEnableMarket` → trading →
  `endMarket(result)` → `adminFinalizeMarket` → claims.
- Winners: burn winning shares, receive pro-rata ERC20 reward **and** pro-rata
  pool $P. Losing side: burn for a compensation token.
- Sells carry double the platform fee (round-trip discourages spam).

Every state transition is a separate role-protected selector; the on-chain
`canCall` check — not the UI — determines who is an admin.

---

## 6. Off-chain: Supabase, but authenticated by the wallet

Supabase Auth is intentionally **disabled**. The browser never holds database
write credentials.

```
Client (Privy embedded wallet)
   │  1. build PoPoAuth EIP-712 typed data
   │     {action, wallet, timestamp, payload(canonical JSON)}
   │  2. eth_signTypedData_v4
   ▼
Edge Function (Deno)
   1. CORS + input validation
   2. reconstruct EIP-712 digest (hand-rolled encoder, no SDK)
   3. secp256k1 recover → must equal claimed wallet
   4. timestamp within 10-minute window (replay bound)
   5. business rule checks (ownership, bounds, one-vote, …)
   6. write with service-role key
```

Used by: likes, thread replies, profile updates, token-create records, trade &
price indexing, holder snapshots, episode metadata, prediction applications.

Domain separation is by realm name (`PoPo.meme` vs `PoPo.meme Affiliate`), and
the domain deliberately omits `chainId`/`verifyingContract` because it
authorizes an off-chain action; chain scoping rides inside the signed payload.

---

## 7. Client engineering decisions

- **Embedded-only signing.** A single `pickEmbeddedWallet()` feeds every
  business signature/transaction; injected wallets (MetaMask) exist only to fund
  the platform. This prevents two hooks signing with different addresses (which
  the server rejects) and accidental external-wallet popups.
- **URL is the read source of truth.** `/:chainId/...` routing determines the
  read network immediately; a separate `walletMismatch` flag gates writes while
  Privy's async `switchChain` catches up. Old behavior derived the network from
  wallet state and served stale localhost reads.
- **RPC reads vs wallet writes.** Reads go through a plain JSON-RPC viem client
  (no wallet extension, no popup); writes go through Privy `sendTransaction`,
  with hex-encoded gas values.
- **On-chain fallback indexer.** Edge Functions cannot reach localhost RPCs; on
  networks the server can't index, the client reconstructs trades/holders from
  `Buy`/`Sell`/6909-`Transfer` logs over a bounded block window.
- **P2P media as pure enhancement.** A lazily-loaded (~136 KB) Service-Worker +
  WebRTC engine proxies video; feature detection runs first, and *every* failure
  mode falls back to the direct Storage URL.
- **Gas/encoding care.** Privy requires 0x-hex numeric fields; ABIs are trimmed
  hand-maintained subsets; the prediction createMarket selector is computed from
  its struct ABI rather than guessed.

---

## 8. Data flow examples

**Buy on the curve**

1. UI calls `previewBuy` (read RPC) → shows token out + both fees + min-out.
2. `usePPHatchSwap.buy` encodes the facet call, sends via embedded wallet.
3. Diamond: fee split → referral accrual → 6909 quote in / token out →
   reserves update; if threshold crossed, curve flips `complete`.
4. Edge-indexed networks: `hatch-record-trade` stores the row (EIP-712
   authed by the *indexing trigger flow*); otherwise the client logs fallback.

**Post a reply on a coin thread**

1. Client canonicalizes payload, signs `PoPoAuth("hatch-post-reply", …)`.
2. Edge verifies signer + freshness, validates token existence/rate rules,
   inserts row with service role.
3. No wallet transaction — social actions are free and instant.

**Graduation day**

1. Anyone calls `migrate(tokenId)`.
2. Status → Graduated; sqrt price & full-range L computed; `initializePool`
   runs under lock; `unlock` session mints the seed LP and nets deltas against
   reserves already on the Diamond; vesting clock starts.
