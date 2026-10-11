# PoPo.meme × Envio HyperIndex — Monad testnet analytics indexer

A real-time, typed indexer for **PoPo.meme on Monad testnet (chainId
`10143`)**, built on **Envio HyperIndex v2**. It indexes both trading surfaces
of the platform and exposes them through an auto-generated GraphQL/REST API:

1. **Hatch** — meme coins on bonding curves (`TokenCreated`, `Buy`, `Sell`,
   `BondingCurveComplete`).
2. **PredictionMarket** — YES/NO prediction-market order flow (`Buy`, `Sell`,
   `BuyBatch`, `SellBatch` keyed by market `digest`).

Both facets live behind ONE EIP-2535 Diamond
(`0xa08e66FD7f19C22Fe44928518DFe6A867B0E4c07`); the two logical contracts in
`config.yaml` share that address and are split only because the facets emit
same-named `Buy/Sell` events with different parameter tuples.

## What it gives judges / users

A live analytics backend answering, via GraphQL:

- per-meme-coin **buy/sell volume ($P)**, fees, circulating supply, holder
  count, last price, graduation flag;
- per-trader **$P spent / received**, number of Hatch vs prediction trades;
- per-prediction-market **YES/NO open interest (supplies)**, buy/sell volume,
  fees, trade count;
- per-trader **YES/NO positions**;
- a fully timestamped trade ledger (`HatchTrade`, `PredictionTrade`) for
  candles / dashboards / risk tooling.

This is the data layer the MetaMask Agent Wallet plugin and any analytics UI
query — read-heavy analytics served without touching node RPC.

## Entities

`Trader`, `Memecoin`, `MemecoinHolder`, `HatchTrade`, `PredictionMarket`,
`PredictionPosition`, `PredictionTrade` — see `schema.graphql`. All `$P`
amounts are stored **raw (18 decimals, BigInt)**; YES/NO shares are integers.

YES/NO nft ids are learned from the first two distinct ids observed per digest
(the smaller id is YES, matching on-chain mint order), so no admin
`CreateMarket` event (which embeds a large `Market` struct tuple) is required.

## Run

Requires Node ≥ 22 and a Postgres instance (`envio dev` provisions one with
Docker by default).

```bash
cp .env.example .env          # set RPC_10143 if you want a non-default RPC
npm install
npm run codegen               # generates .envio/types.d.ts (event + entity types)
npm run dev                   # starts indexer + Hasura GraphQL on localhost
```

`config.yaml` starts syncing at block `70016287` (the Diamond deployment
block) using `https://testnet-rpc.monad.xyz`. For HyperSync-supported networks
the RPC is only a fallback; on Monad testnet it currently acts as the primary
source.

## Query examples

```graphql
# Top meme coins by buy volume
query {
  Memecoin(order_by: { buyVolumeP: desc }, limit: 10) {
    symbol name holders buyVolumeP sellVolumeP feesP graduated
  }
}

# A prediction market's order flow
query ($digest: String!) {
  PredictionMarket(id: $digest) {
    yesSupply noSupply buyVolumeP sellVolumeP tradeCount
  }
  PredictionTrade(where: { market_id: { _eq: $digest } }, order_by: { blockNumber: desc }) {
    trader { address } side outcome shares quoteP timestamp
  }
}
```

## Layout

```
config.yaml                 contracts, event signatures, chain + start block
schema.graphql              analytics entities
src/EventHandlers/Hatch.ts            meme-coin aggregation
src/EventHandlers/PredictionMarket.ts prediction order-flow + positions
.envio/types.d.ts           generated event/entity types (npm run codegen)
```

## Validation

- `envio codegen` passes (config + event ABIs + schema parse and generate
  types).
- `tsc --noEmit` is clean for both handlers.
- Event signatures were taken verbatim from
  `IPPHatchSwapBase` and the prediction `IBase`, and params are typed
  (`uint256` → `bigint`, etc.) by the generated contract types.

## License

MIT
