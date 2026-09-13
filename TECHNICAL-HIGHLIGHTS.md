# Technical Highlights

The seven problems worth talking about in judging Q&A. Each links to the code
excerpt under `snippets/`.

---

## 1. Constant-product curve with virtual reserves and fee-in/fee-out symmetry

The launch phase keeps four reserves: virtual (`vToken`, `vQuote`, used for
pricing) and real (`realTokenReserves`, `realQuoteReserves`, bounding what can
be paid out). Pricing uses integer-only math with ceiling division that favors
the reserves on *both* sides:

```
buy:  tokenOut = vToken − ⌈k / (vQuote + netQuoteIn)⌉
sell: grossOut  = vQuote − ⌈k / (vToken + tokenIn)⌉
```

Fees (platform bps + creator bps) are removed *before* net quote enters the
curve on buys, and from gross quote on sells, so the invariant and the payout
math stay consistent in both directions. Slippage bounds (`minTokensOut` /
`minQuoteOut`) are explicit revert conditions. Referral shares are carved out
of the platform fee and the caller subtracts them from the platform's accrual —
no double spending.

Why it's non-trivial: wrong rounding direction is an exploitable drainage path;
mixing fee ordering between buy/sell desynchronizes virtual and real reserves.
→ `snippets/contracts/01-bonding-curve.md`

---

## 2. Atomic migration from bonding curve into concentrated liquidity

At graduation there must be no arbitrage gap between the curve's implied price
and the seeded AMM price. The migration:

1. derives `sqrtPriceX96 = √(tokenReserve · 2¹⁹² / quoteReserve)` using
   `FullMath.mulDiv` (512-bit intermediates) and an MSB-seeded Newton integer
   square root;
2. builds the canonical pool key (`currency0 = quote < currency1 = token`);
3. computes maximal full-range liquidity as `min(L0, L1)` exactly like
   v3-periphery `LiquidityAmounts`;
4. initializes the pool *while locked*, then opens an `unlock` session and mints
   the seed position in `unlockCallback`;
5. nets the resulting negative deltas to zero because the seeded reserves are
   already sitting on the Diamond's 6909 balance — **zero settle transfers**.

The callback accepts only `msg.sender == address(this)` inside a live unlock
session, so a hook or third party cannot replay seeded liquidity.

→ `snippets/contracts/02-graduation-migration.md`

---

## 3. A v4-style PoolManager built for an internal multi-token ledger

Instead of integrating an external AMM, the system ships its own concentrated-
liquidity core: tick state, `TickBitmap` word scanning, `SwapMath.computeSwapStep`,
sqrt-price moves, protocol-fee splits and a hook dispatcher — all settling on
ERC-6909 ids rather than ERC20 approvals.

- Swaps run only inside `unlock` (flash accounting); callers settle via callback.
- Price-limit validation prevents zero-price-impact/no-op abuse.
- Hook permissions are encoded in the hook contract address bits; the dispatcher
  invokes callbacks only when the corresponding flag is present, so deploying a
  hook that "implements" `beforeSwap` is meaningless without the address bit.

→ `snippets/contracts/03-poolmanager-hooks.md`

### 3b. Market-cap-tiered creator fee hook

`CreatorFeeHook` is deployed at a CREATE2-mined address ending `0x44`
(`AFTER_SWAP | AFTER_SWAP_RETURNS_DELTA`). On every swap it:

- computes market cap from the **pre-trade** `sqrtPriceX96Before` snapshot
  (a trade can't push itself into a cheaper tier);
- looks up the ascending tier table (`marketCap ≤ mcUpper → bps`);
- returns the fee as an afterSwap delta in quote currency; the manager credits
  it to `creatorRewards[tokenId]`, claimable through the same flow as curve
  creator fees.

Market cap math avoids `sqrtPriceX96²` overflow via two consecutive
`mulDiv` reductions; the delta is int128-clamped defensively.

→ same snippet file

---

## 4. One ledger to settle them all: ERC-6909 vault with 1:1 backing

Users deposit whitelisted ERC20s (e.g. $P) and receive internal id balances;
withdrawals burn the id and transfer the underlying out. This yields:

- curve/AMM/referral/episode/buyback flows as cheap internal transfers;
- a single approval surface (the Diamond);
- strict accounting: the quote id can never be minted by the curve — it only
  enters via deposits, which is why migration delta-netting and fee accounting
  are sound.

Metadata reads tolerate non-conforming ERC20s (`try/catch`, default 18
decimals).

→ `snippets/contracts/04-vault-erc6909.md`

---

## 5. Growth without trust: frozen-tier two-level referrals

Each trader has at most one referral edge, bound only before their first
fee-paying trade; self-bind, rebind and up-to-depth-8 cycles are rejected.
Gold status is snapshotted onto the edge **at bind time** — later subscription
expiry never changes historical rates, so users can't be retroactively
downgraded and referrers can't game timing. Rewards come exclusively from the
platform fee, and `referralPendingTotal` is subtracted from admin-withdrawable
fees.

→ `snippets/contracts/05-referral.md`

---

## 6. Content monetization with a built-in buyback-and-burn engine

Paid episodes split revenue into creator/platform/buyback shares without
rounding dust (`creator = price − a − b`). A permissionless function — one call
per UTC day per coin — swaps up to a governance cap from the buyback treasury
through a **stateless router** that:

- is funded and refunded within the same transaction (holds no funds overnight);
- executes an exact-in swap inside `unlock` with
  `sqrtPriceLimit = price · 0.95` (hard slippage bound, no min-out dependency);
- delivers bought coins straight to the Diamond, which burns them, reducing
  total supply.

Token-gating is an on-chain access mapping; even free unlocks increment buyer
count so a deleted episode slot can never be resurrected with different content.

→ `snippets/contracts/06-episodes-buyback.md`

---

## 7. Off-chain writes secured only by wallet signatures

The social/indexing layer needs free, high-frequency writes (likes, replies,
profiles) without asking users for transactions — but without trusting the
client either. The design:

- fixed EIP-712 struct `PoPoAuth(action, wallet, timestamp, payload)`;
- payload is canonical JSON with alphabetically sorted keys — the same string
  client and server hash;
- Deno side re-implements the digest from primitives (`@noble/curves`
  secp256k1 + keccak), no shared session/JWT;
- 10-minute signature age, realm domain separation, service-role writes only;
- client must sign with the **Privy embedded wallet**, enforced via
  `getEmbeddedConnectedWallet`, so signer and trading wallet never diverge.

→ `snippets/app/01-eip712-wallet-auth.md`, `02-privy-embedded-only.md`

### 7b. Honest multi-chain UX and indexing

- `/:chainId` URL routing is the instant source of truth for **reads**; a
  `walletMismatch` flag separately gates **writes** until the embedded wallet
  finishes switching chains.
- Admin permission is an on-chain `canCall(wallet, selector)` query — the UI
  has no hardcoded admin list.
- When the edge backend cannot reach the user's RPC (localhost/private nodes),
  a client-side getLogs indexer reconstructs trades and ERC-6909 holder
  balances from raw events over a bounded block window.
- Video delivery is opportunistically offloaded through a Service-Worker/WebRTC
  P2P mesh; feature detection and catch-all fallback guarantee direct playback.

→ `snippets/app/03-multichain-routing.md`, `04-onchain-indexer.md`,
`05-p2p-video.md`

---

## Bonus: prediction market math

YES/NO shares priced by `price = k·√supply + c`: marginal price rises smoothly
with open interest and collapses back on sells, giving an intuitive
probability-like signal without an order book. Settlement is pro-rata against
both the ERC20 reward pool and the $P trading pool; the losing side receives a
compensation token. Role separation (create / review-enable / end / finalize /
withdraw) uses distinct selectors so operations can be delegated to different
keys.

→ `snippets/contracts/07-prediction-market.md`

---

## Testing posture

- Hardhat + TypeScript tests cover curve buy/sell rounding, graduation
  determinism (seeded price equals curve price), AMM swap routing with and
  without hook fees, referral edge lifecycle, episode split accounting and
  buyback slippage, and prediction-market settlement paths.
- Full automated E2E runs against a real Privy layer on a public testnet
  (wallet creation, funding, trading, graduation).
