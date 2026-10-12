# Envio HyperIndex Bounty Submission — PoPo.meme on Monad

> **Track:** Onchain Finance & Trading (Monad testnet, chainId 10143)
> **Bounty:** Best Use of Envio (HyperIndex) ｜ **Prize:** $1,000 USD
> **Team:** PoPo.meme (`predpred`) ｜ demo video optional (≤2 min)

## What we built

A **HyperIndex v2** indexer, `popomonad`, that streams and aggregates every
trade on PoPo.meme's two on-chain trading venues — both living behind one
EIP-2535 Diamond on Monad testnet — into a typed Postgres layer with an
auto-generated GraphQL API.

Source: `envio-indexer/`

## Coverage

- **Hatch bonding curve** (`TokenCreated`, `Buy`, `Sell`,
  `BondingCurveComplete`) → meme coin, holder, per-trade ledger, rolling
  volume/fees/supply/last-price, graduation flag.
- **Prediction market** (`Buy`/`Sell` single-share and `BuyBatch`/`SellBatch`,
  keyed by market `digest`) → YES/NO open interest, buy/sell volume, fees,
  per-trader positions, full order-flow ledger.
- Same-named events across the two facets are handled by two logical contract
  entries that share the single Diamond address, avoiding overloaded-signature
  ambiguity.
- Starts at the Diamond deployment block `70016287`.

## Why HyperIndex fits

- **High-throughput Monad blocks (sub-second):** an indexer syncs via
  HyperSync/RPC instead of making the dApp poll node RPC for every chart and
  holder view.
- **Aggregated analytics are first-class entities** (per-coin and per-market
  rolling stats), not ad-hoc client math.
- **Typed DX:** `envio codegen` emits typed event params (`bigint` for
  `uint256`) and entity stores; handlers compile clean against the generated
  types.
- One deployment serves both the web UI and the agent plugin's read-heavy
  queries.

## GraphQL answers out of the box

- Top meme coins by volume; per-coin holders, circulating supply, fees,
  graduation.
- Per-trader $P spent/received and Hatch vs prediction trade counts.
- Per-market YES/NO open interest, volume, fees; full timestamped order flow.
- Per-trader YES/NO positions.

## Validation

- `envio codegen` exits 0: config + event ABIs + GraphQL schema parse and
  generate `.envio/types.d.ts` with all 8 events and 7 entities typed.
- `tsc --noEmit` is clean for both handlers.
- Event signatures copied verbatim from the Solidity interfaces
  (`IPPHatchSwapBase`, prediction `IBase`).
- Start block and address taken from the verified on-chain deployment.

## Live status (verified 2026-10-12, local `envio dev` + Hasura :8080)

The indexer is running and has caught up to the chain head:

- `chain_metadata`: chain_id **10143**, start_block **70016287**,
  latest_processed_block **70,442,952** (still advancing).
- Live entity counts from the auto-generated GraphQL API:
  - **61** `Memecoin`, **24** `Trader`, **703** `HatchTrade`
  - **7** `PredictionMarket` (with live YES/NO supply + trade counts)
  - `PredictionTrade` ledger populated.
- Cross-surface end-to-end proof: the buy placed through the **MetaMask Agent
  Wallet CLI plugin** (`0x14bbadb4…`, block **70202021**, 2 YES,
  quote `38672491599734362682` wei) appears as a `PredictionTrade` row here —
  the same trade is thus visible in both bounties.

Example query (Hasura at http://localhost:8080/v1/graphql, no admin secret):

```graphql
query {
  PredictionMarket { id digest yesSupply noSupply tradeCount }
  PredictionTrade(limit: 5, order_by: { blockNumber: desc }) {
    side outcome shares quoteP blockNumber transactionHash
  }
}
```

## Run

```bash
cd envio-indexer
cp .env.example .env          # set ENVIO_API_TOKEN (HyperSync access)
npm install
npm run codegen
npm run dev                   # Postgres + Hasura :8080 + indexer
```

Containers on this machine: `envio-postgres` (host :5433) and
`envio-hasura` (host :8080). GraphQL: http://localhost:8080/v1/graphql (no
admin secret). See the folder README for entity details and example queries.

## Deliverables mapping

- Live indexer config/handlers + GraphQL schema committed to the public repo.
- README with setup, entity model, and query examples.
- ≤2 min demo video — *(link to insert)*: `npm run dev`, a buy on the site,
  then the GraphQL query returning the indexed trade and updated volume.
- Public GitHub link — *(link to insert)*.
