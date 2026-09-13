# Snippet — Embedded-Only Wallet Policy & Transaction Flow

> Excerpts from `app/src/lib/wallet-auth.ts` and
> `app/src/hooks/use-pp-hatch-swap.ts` (React + Privy + viem).

## One selector for every business signature / transaction

`useWallets()` returns all connected wallets — including browser extensions —
in no guaranteed order. Picking `wallets[0]` silently hands signing to MetaMask,
which both pops the wrong popup and makes the server-side `ecrecover` check
reject the write (signer ≠ expected wallet).

```ts
import { getEmbeddedConnectedWallet } from "@privy-io/react-auth"
import type { ConnectedWallet } from "@privy-io/react-auth"

/**
 * STRICT: all business signatures and contract transactions go through the
 * Privy embedded wallet. NEVER falls back to an injected wallet. External
 * wallets exist only to fund the platform. Callers prompt "connect Privy"
 * instead of silently signing with an extension.
 */
export function pickEmbeddedWallet(
  wallets: ConnectedWallet[] | undefined | null,
): ConnectedWallet | null {
  return getEmbeddedConnectedWallet(wallets ?? []) ?? null
}
```

The trading hook memoizes exactly one signing wallet:

```ts
export function usePPHatchSwap() {
  const { wallets } = useWallets()
  const { sendTransaction } = useSendTransaction()

  // Business signing: embedded wallet ONLY. Never fall back to an injected
  // wallet — that both popped the browser plugin on chain switch and let
  // business txs sign with the wrong address.
  const wallet = useMemo(() => pickEmbeddedWallet(wallets), [wallets])
  // ...
}
```

## Read path ≠ write path

Reads use a plain JSON-RPC viem client (no wallet extension attached — no popup,
works logged-out); writes go through Privy `sendTransaction` with the embedded
wallet.

```ts
// RPC read client: hand-rolled transport, no injected provider.
function getRpcClient(rpcUrl: string): PublicClient {
  return createPublicClient({
    transport: custom({
      request: async ({ method, params }: any) => {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        })
        return (await res.json()).result
      },
    }),
  })
}
```

## Buy on the curve: approve-6909 → send, with on-chain receipt wait

```ts
const buyTokens = useCallback(
  async (tokenId: bigint, quoteAmount: bigint, minTokensOut: bigint) => {
    if (!hatchConfig || !wallet) throw new Error("Not ready")

    const data = encodeFunctionData({
      abi: PPHATCHSWAP_ABI,
      functionName: "buy",
      args: [tokenId, quoteAmount, minTokensOut],
    })

    const { hash } = await sendTransaction(
      { to: hatchConfig.ppHatchSwapAddress, chainId: routeChainId, data },
      { address: wallet.address as `0x${string}` },
    )
    return hash
  },
  [hatchConfig, wallet, routeChainId, sendTransaction],
)
```

Deposit into the vault is a two-step approve-then-deposit with an explicit
receipt wait (the second call would otherwise race the approval):

```ts
const depositUsdp = useCallback(async (amount: bigint) => {
  // 1. approve Diamond as spender of ERC20 $P
  const approveData = encodeFunctionData({
    abi: USDPAPP_ABI, functionName: "approve",
    args: [hatchConfig.ppHatchSwapAddress, amount],
  })
  const { hash: approveHash } = await sendTransaction(
    { to: hatchConfig.usdpAppAddress, chainId: routeChainId, data: approveData },
    { address: wallet.address as `0x${string}` },
  )
  const client = await getPublicClient(wallet)
  await client.waitForTransactionReceipt({ hash: approveHash })

  // 2. wrap into the ERC-6909 vault balance
  const depositData = encodeFunctionData({
    abi: PPHATCHSWAP_ABI, functionName: "deposit",
    args: [hatchConfig.quoteTokenId, amount],
  })
  const { hash } = await sendTransaction(
    { to: hatchConfig.ppHatchSwapAddress, chainId: routeChainId, data: depositData },
    { address: wallet.address as `0x${string}` },
  )
  return hash
}, [/* deps */])
```

## Admin actions are gated by the chain, not the client

The hook exposes `canCall`, which asks the AccessControl facet directly; admin
UI renders only when the chain permits the selector:

```ts
const canCall = useCallback(
  async (user: `0x${string}`, functionName: string): Promise<boolean> => {
    try {
      return await readHatchContract<boolean>("canCall", [
        user,
        getFunctionSelector(functionName), // selector computed from struct ABI
      ])
    } catch {
      return false
    }
  },
  [readHatchContract],
)
```

## Encoding rules learned the hard way

- Numeric transaction fields (`gasLimit`, `gasPrice`) must be **0x hex
  strings** — decimal strings get misinterpreted as ASCII bytes by the embedded
  wallet provider.
- `createMarket(Market)`'s selector must be computed from the full struct ABI
  (`0x5478cd0f`), not guessed from the function signature string.
- Every business call site must pass the same embedded wallet address to
  Privy's `sendTransaction` resolver, otherwise confirmations can land from a
  different account than the EIP-712-authorized one.
