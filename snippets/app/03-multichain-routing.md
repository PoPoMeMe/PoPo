# Snippet — Multi-Chain Routing: URL Drives Reads, Wallet Gates Writes

> Excerpts from `app/src/lib/chain-route.ts` and
> `app/src/hooks/use-pp-hatch-swap.ts`.
> Networks share one deployment codebase: X Layer mainnet/testnet and local
> Hardhat. The app must switch instantly in the UI while the embedded wallet's
> asynchronous `switchChain` lags behind.

## `/:chainId` is the single source of truth for reads

```ts
// Every page lives under /:chainId/... — e.g. /31337/hatch/token-3.
// The URL segment flips the instant the user changes network in the sidebar;
// reads must not wait for the wallet's async switchChain().

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i

export function withChainPrefix(path: string, chainId: number | string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path
  if (ABSOLUTE_URL.test(path)) return path
  const segments = path.split("/")
  if (segments[1] && /^\d+$/.test(segments[1])) return path // already prefixed
  return `/${chainId}${path === "/" ? "" : path}`
}

export function chainIdFromPath(pathname: string): number | null {
  const first = pathname.split("/")[1]
  return first && /^\d+$/.test(first) ? Number(first) : null
}
```

The choice persists across reloads:

```ts
const NETWORK_STORAGE_KEY = "popo.selected-network.v1"

export function getDefaultChainId(): number {
  const stored = readStoredNetwork()
  return stored ? NETWORKS[stored].chainId : FALLBACK_CHAIN_ID
}
```

## Read/write desynchronization is explicit

```ts
const route = useChainRoute()
const routeChainId = route.chainId                       // instant, from URL

const walletChainId = wallet?.chainId
  ? Number(wallet.chainId.split(":")[1])
  : null

// True while the signing wallet is still being moved to the route chain.
// Reads are unaffected; WRITES must wait for this to clear.
const walletMismatch =
  walletChainId !== null && walletChainId !== routeChainId
```

Per-network configuration (addresses, RPC) is selected by the route network
key, so lists, prices, charts and trade previews always reflect the selected
chain even if the embedded wallet has not finished switching:

```ts
const hatchConfig = getHatchConfig(activeNetworkKey) // null on unsupported nets
const isSupported = hatchConfig !== null

const readHatchContract = useCallback(async (functionName, args = []) => {
  const client = getRpcClient(hatchConfig.rpcUrl)     // plain JSON-RPC client
  return client.readContract({
    address: hatchConfig.ppHatchSwapAddress,
    abi: PPHATCHSWAP_ABI,
    functionName,
    args,
  })
}, [hatchConfig])
```

Writes always target `routeChainId` and go through the embedded wallet, which a
`ChainGate` component moves onto the right chain first:

```ts
await sendTransaction(
  { to: hatchConfig.ppHatchSwapAddress, chainId: routeChainId, data },
  { address: wallet.address },
)
```

## Why it matters

- **No stale-chain reads**: deriving the network from wallet state used to keep
  serving localhost data while the wallet was still on Hardhat 31337 during a
  switch; URL routing updates synchronously on navigation.
- **No wrong-chain writes**: `walletMismatch` blocks trade buttons and shows a
  switching state instead of submitting a transaction that a popup would reject
  or, worse, broadcast on the wrong chain.
- **Multi-deployment demo story**: judges can switch between a public testnet
  and a local node mid-demo with consistent UI state, one codebase, and
  per-network contract config.
- **Graceful unsupported network**: unknown chain ids render "not supported"
  rather than misrouting calls at a mainnet deployment.
