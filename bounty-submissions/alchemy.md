# Alchemy Bounty Submission — PoPo.meme on Monad testnet

> **Bounty:** Best Projects using Alchemy — meaningfully integrate ≥1 Alchemy
> service/tool that supports Monad ｜ **Prize:** $1,000 USD in Alchemy Credits
> **Network:** Monad testnet (chainId `10143`) ｜ **Team:** PoPo.meme (`predpred`)
> **Required form field:** describe the integration ｜ demo video **optional**

## The integration (two real Alchemy services)

PoPo.meme meaningfully integrates Alchemy on Monad testnet in two ways:

### 1. Alchemy Supernode as the primary Monad JSON-RPC (with failover)

`app/src/lib/alchemy.ts` builds the Monad RPC list. When `VITE_ALCHEMY_API_KEY`
is present, the Alchemy Supernode endpoint
`https://monad-testnet.g.alchemy.com/v2/<KEY>` is prepended as the **primary**
RPC for both viem reads and the Privy embedded-wallet transaction path
(`privyWalletOverride`). The public Monad RPC and dRPC remain automatic
fallbacks, so reliability degrades gracefully if Alchemy is unavailable.

This matters on Monad specifically: sub-second blocks and the public RPC's
strict `eth_getLogs` range cap make a dependable Supernode endpoint the
difference between a working trading UI and flaky reads.

- Code: `app/src/lib/alchemy.ts` (`monadRpcList`, `alchemyMonadRpcUrl`), wired
  into `monadTestnetWithRpc` in `app/src/main.tsx`.

### 2. Alchemy Enhanced APIs — ERC-20 balances & transfer history

The same module calls two Alchemy Enhanced APIs over the Supernode endpoint:

- `alchemy_getTokenBalances` — the connected wallet's ERC-20 / $P balances on
  Monad without scanning ERC-6909/transfer history on the public node.
- `alchemy_getAssetTransfers` (`category: erc20`, metadata, pagination) — a
  real $P activity/transfer feed for the wallet.

`app/src/hooks/use-alchemy-monad.ts` exposes these to React
(`useAlchemyMonad(address)`) and is rendered by a **dedicated, env-gated
"Alchemy Supernode · Monad" panel on the `/faucet` page**
(`AlchemyMonadPanel` in `app/src/pages/faucet.tsx`). It shows the live $P
balance and a timestamped $P transfer feed (in/out + explorer link), filtering
to the canonical Monad `$P` address from `CHAIN_CONTRACTS[10143].usdpApp`.
The panel renders only on chainId `10143` and only when the key is set.

## Why it is a meaningful integration (not superficial)

- It replaces a reliability-critical data path (RPC ordering for both reads and
  **Privy transaction submission**), not just a cosmetic logo.
- The Enhanced API removes client-side getLogs indexing for balances/history —
  a concrete limitation we already work around elsewhere with chunked logs.
- Env-gated and fail-safe: without a key the app behaves exactly as before;
  with a key, Alchemy becomes primary plus powers the activity feature.

## Verification (live, Monad testnet)

Verified against the running Supernode endpoint with a real key and the Agent
Wallet address `0xb81fCEe70017317F79C169B3727193a786bFc88D`:

- `eth_chainId` over `monad-testnet.g.alchemy.com/v2/<KEY>` → `0x279f` (10143).
- `alchemy_getTokenBalances` filtered to the $P contract
  `0xf8D44b7682fe1f2D3d5089DCA3510D830675C662` → raw
  `999900000000000000000000` = **999,900 $P** (matches the wallet exactly).
- `alchemy_getAssetTransfers` (`category: erc20`, $P contract) returns the
  faucet mint tx `0xcffa39500ad667b8…` (2026-10-11). The `asset`/`value` fields
  are null because Alchemy has no testnet token metadata; the amount is read
  from `rawContract.rawValue`, which the UI does.
- `tsc --noEmit` is clean with the module, hook, `main.tsx` wiring and the new
  `/faucet` panel.
- Endpoint slug confirmed from Alchemy's Monad docs
  (`monad-testnet.g.alchemy.com/v2/<KEY>`).
- With a key set (`VITE_ALCHEMY_API_KEY`) Monad routes through Alchemy first
  and the panel shows live balances/transfers; without the key the panel does
  not render and the original RPC list is used unchanged.

> Production: set `VITE_ALCHEMY_API_KEY` in Vercel and rebuild so the key is
> inlined at build time (Vite exposes only `VITE_`-prefixed build-time vars).

## Demo (optional, ~2 min)

App dev server must be started **after** `VITE_ALCHEMY_API_KEY` is in
`app/.env.local` (use the normal `vite` on http://localhost:5173, not the
`vite.e2e.config.ts` instance on 5174).

1. Open `/faucet` with the route switched to **Monad Testnet (10143)** and a
   Privy wallet connected → the **"Alchemy Supernode · Monad"** card appears.
2. Show the live **$P balance** (`alchemy_getTokenBalances`) and the **$P
   transfer feed** (`alchemy_getAssetTransfers`), each row with in/out +
   explorer link; click Refresh.
3. (Optional) Make a Hatch/prediction trade from the Privy embedded wallet and
   note the tx is submitted through the Alchemy-first RPC list, then point to
   it on the Monad explorer.
4. Point at `app/src/lib/alchemy.ts` (env gate + failover) to show that with
   no key the app behaves exactly as before.

## Required form answer (ready to paste)

> PoPo.meme integrates two Alchemy services on Monad testnet (10143): (1) the
> Alchemy Supernode as the primary JSON-RPC for both viem reads and Privy
> embedded-wallet transaction submission, with the public RPC and dRPC as
> automatic fallbacks; (2) the Enhanced `alchemy_getTokenBalances` and
> `alchemy_getAssetTransfers` APIs, surfaced in a dedicated env-gated "Alchemy
> Supernode · Monad" panel on /faucet that shows the connected wallet's live
> $P balance and transfer history without getLogs-heavy indexing. Verified live:
> chainId 0x279f, exact 999,900 $P balance, and the faucet mint transfer
> returned by the Enhanced API. Env-gated (VITE_ALCHEMY_API_KEY) and fails safe
> to the prior endpoints. Code: app/src/lib/alchemy.ts,
> app/src/hooks/use-alchemy-monad.ts, panel in app/src/pages/faucet.tsx, RPC
> wired in app/src/main.tsx.
