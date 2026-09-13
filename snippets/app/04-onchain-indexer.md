# Snippet — Client-Side On-Chain Fallback Indexer

> Excerpt from `app/src/lib/hatch-chain-index.ts`.
> Supabase Edge Functions cannot reach a developer's `localhost` RPC, so on
> networks the server can't index (private/local nodes), the client
> reconstructs trades, price history and holder snapshots directly from
> contract events — mirroring what the server indexer stores on public chains.

## Event definitions

```ts
const BUY_EVENT = parseAbiItem(
  "event Buy(address indexed buyer, uint256 indexed tokenId, uint256 tokenAmount," +
  " uint256 quoteCost, uint256 platformFee, uint256 creatorFee)",
)
const SELL_EVENT = parseAbiItem(
  "event Sell(address indexed seller, uint256 indexed tokenId, uint256 tokenAmount," +
  " uint256 quoteOut, uint256 platformFee, uint256 creatorFee)",
)
// ERC-6909: id is the hatch token id minted inside the Diamond singleton.
const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address caller, address indexed from, address indexed to," +
  " uint256 indexed id, uint256 amount)",
)

// Local chains are short-lived; one 50k-block sweep covers the whole history.
const SCAN_BLOCKS = 50_000n
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

const clientCache = new Map<string, PublicClient>() // one viem client per RPC
```

## Trade history: parallel topic scans, batched timestamp resolution

```ts
export async function getTradesFromChain(
  network: NetworkKey, tokenId: bigint, limit = 50,
): Promise<{ trades: ChainTrade[]; total: number }> {
  const ctx = getClient(network)
  if (!ctx) return { trades: [], total: 0 }
  const { client, address } = ctx
  const { fromBlock, toBlock } = await getScanRange(client)

  const [buyLogs, sellLogs] = await Promise.all([
    client.getLogs({ address, event: BUY_EVENT,
      args: { tokenId }, fromBlock, toBlock }),
    client.getLogs({ address, event: SELL_EVENT,
      args: { tokenId }, fromBlock, toBlock }),
  ])

  const parsed: Omit<ChainTrade, "blockTime">[] = []
  const blockNumbers = new Set<bigint>()
  for (const log of buyLogs as TradeLog[]) {
    const a = log.args as Record<string, unknown>
    parsed.push({
      txHash: log.transactionHash!,
      logIndex: Number(log.logIndex ?? 0),
      trader: String(a.buyer).toLowerCase(),
      side: "buy",
      tokenAmount: a.tokenAmount as bigint,
      quoteAmount: a.quoteCost as bigint,
      blockNumber: log.blockNumber!,
    })
    blockNumbers.add(log.blockNumber!)
  }
  // ...same for sells (trader = seller, quoteAmount = quoteOut)...

  // Newest first, tie-break by log index within a block.
  parsed.sort((x, y) =>
    x.blockNumber === y.blockNumber
      ? y.logIndex - x.logIndex
      : x.blockNumber > y.blockNumber ? -1 : 1)

  // Only fetch timestamps for blocks in the returned window; one batched pass.
  const windowBlocks = new Set(parsed.slice(0, limit).map((t) => t.blockNumber))
  const blocks = await Promise.all(
    [...windowBlocks].map((bn) =>
      client.getBlock({ blockNumber: bn }).catch(() => null)),
  )
  // ...map blockNumber → Date, attach blockTime...
}
```

## Holders: replay 6909 transfers chronologically

```ts
export async function getHoldersFromChain(network: NetworkKey, tokenId: bigint) {
  // ...getLogs(TRANSFER_EVENT, args: { id: tokenId }) over the scan window...

  // Chronological replay keeps deltas correct regardless of log delivery order.
  const balances = new Map<string, bigint>()
  const adjust = (key: string, delta: bigint) =>
    balances.set(key, (balances.get(key) ?? 0n) + delta)

  for (const log of transferLogs) {
    const a = log.args as Record<string, unknown>
    const amount = a.amount as bigint
    const from = String(a.from ?? ZERO_ADDRESS).toLowerCase()
    const to   = String(a.to   ?? ZERO_ADDRESS).toLowerCase()
    if (from !== ZERO_ADDRESS) adjust(from, -amount) // mint when from = 0x0
    if (to   !== ZERO_ADDRESS) adjust(to,   +amount) // burn when to   = 0x0
  }

  return [...balances.entries()]
    .filter(([who, balance]) =>
      balance > 0n &&
      who !== address.toLowerCase() &&   // exclude the Diamond's own bag
      who !== ZERO_ADDRESS)
    .map(([holder, balance]) => ({ holder, balance }))
    .sort((a, b) => a.balance > b.balance ? -1 : a.balance < b.balance ? 1 : 0)
}
```

## Price history from the curve itself

The chart reconstruction reads the token's **current** reserves from the
contract and replays trades backwards/forwards, deriving
`spot = realQuoteReserves / realTokenReserves` after each trade — so the chart
reflects actual on-chain moves with no off-chain price feed.

## Why it matters

- **Demo on any network**: local Hardhat E2E still renders trade lists, holder
  tables and live charts even though no edge indexer can reach the node.
- **No trust in off-chain data for fallback**: logs are the chain; derived
  prices match the contract's own reserves math.
- **Bounded work**: 50k-block window + client cache + timestamp batching keeps
  scans fast; public chains prefer the server indexer, so this is strictly a
  fallback.
- **Correct burn/mint accounting**: zero-address handling and chronological
  replay matter for a contract that burns coins every day (buyback) — naive
  event counting would overstate supply/holders.
