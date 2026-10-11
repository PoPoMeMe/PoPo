# Alchemy Bounty Submission — PoPo.meme on Monad testnet

> **Bounty:** Best Projects using Alchemy — meaningfully integrate ≥1 Alchemy
> service/tool that supports Monad
> **Network:** Monad testnet (chainId `10143`) ｜ **Team:** PoPo.meme (`predpred`)
> **Required form field:** describe the integration ｜ optional ≤2min video

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
(`useAlchemyMonad(address)`) for the wallet/activity surface, filtering to the
canonical Monad `$P` address from `CHAIN_CONTRACTS[10143].usdpApp`.

## Why it is a meaningful integration (not superficial)

- It replaces a reliability-critical data path (RPC ordering for both reads and
  **Privy transaction submission**), not just a cosmetic logo.
- The Enhanced API removes client-side getLogs indexing for balances/history —
  a concrete limitation we already work around elsewhere with chunked logs.
- Env-gated and fail-safe: without a key the app behaves exactly as before;
  with a key, Alchemy becomes primary plus powers the activity feature.

## Verification

- `tsc --noEmit` is clean with the new module/hook and the `main.tsx` wiring.
- Endpoint slug confirmed from Alchemy's Monad docs
  (`monad-testnet.g.alchemy.com/v2/<KEY>`).
- With a key set (`VITE_ALCHEMY_API_KEY`), the Monad network routes through
  Alchemy first and the hook returns live balances/transfers; without it the
  original RPC list is used unchanged.

## Demo (≤2 min, to record)

1. Show `VITE_ALCHEMY_API_KEY` set and the network panel/RPC list with the
   Alchemy Supernode first.
2. Switch the Privy embedded wallet to Monad testnet; make a Hatch/prediction
   trade, showing the tx is submitted via the Alchemy-backed RPC.
3. Open the wallet activity surface: balances and $P transfers come from
   `alchemy_getTokenBalances` / `alchemy_getAssetTransfers`.
4. Point to the live tx on the Monad explorer.

## Required form answer (ready to paste)

> PoPo.meme integrates two Alchemy services on Monad testnet: (1) the Alchemy
> Supernode as the primary JSON-RPC for both viem reads and Privy embedded-
> wallet transaction submission, with the public RPC and dRPC as automatic
> fallbacks; (2) the Enhanced `alchemy_getTokenBalances` and
> `alchemy_getAssetTransfers` APIs to render the connected wallet's $P balance
> and transfer history without getLogs-heavy indexing. The integration is
> env-gated (`VITE_ALCHEMY_API_KEY`) and fails safe to the prior endpoints.
> Code: `app/src/lib/alchemy.ts`, `app/src/hooks/use-alchemy-monad.ts`,
> wired in `app/src/main.tsx`.
