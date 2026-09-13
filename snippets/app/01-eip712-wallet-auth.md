# Snippet — EIP-712 Wallet Auth for Supabase Writes

> Client: `app/src/lib/wallet-auth.ts`.
> Server: `app/supabase/functions/_shared/auth.ts` (Deno).
> Supabase Auth is **disabled**; users authenticate every write with an
> EIP-712 signature from their Privy embedded wallet.

## Protocol (byte-identical on both sides)

```
EIP712Domain(string name,string version)
   name = "PoPo.meme" (or "PoPo.meme Affiliate" for affiliate actions)
   version = "1"
PoPoAuth(string action, address wallet, uint256 timestamp, string payload)
   payload = canonical JSON — object keys sorted alphabetically
```

- No `chainId` / `verifyingContract`: this authorizes an **off-chain write**,
  not a contract call; chain scoping rides inside `payload`.
- Timestamp window: **10 minutes** — replay protection without a nonce store.

## Client: canonicalization + typed-data signing

```ts
export const AUTH_TYPES = {
  PoPoAuth: [
    { name: "action", type: "string" },
    { name: "wallet", type: "address" },
    { name: "timestamp", type: "uint256" },
    { name: "payload", type: "string" },
  ],
} as const

/** Deterministic JSON: object keys sorted alphabetically. */
export function canonicalJson(payload: Record<string, unknown>): string {
  return JSON.stringify(payload ?? {}, Object.keys(payload ?? {}).sort())
}

export async function signAuthRequest(
  wallet: ConnectedWallet,
  input: SignAuthInput,
): Promise<SignedRequest> {
  const address = input.address.toLowerCase()
  const timestampMs = Date.now()

  // Raw JSON-RPC so the exact call works for the embedded wallet AND any
  // injected provider; v4 requires uint256 as a decimal string.
  const rpcTypedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      PoPoAuth: AUTH_TYPES.PoPoAuth,
    },
    domain: { name: input.realm ?? AUTH_REALM, version: "1" },
    primaryType: "PoPoAuth",
    message: {
      action: input.action,
      wallet: address,
      timestamp: String(timestampMs),
      payload: canonicalJson(input.payload),
    },
  }

  const provider = await wallet.getEthereumProvider()
  const signature = await provider.request({
    method: "eth_signTypedData_v4",
    params: [address, JSON.stringify(rpcTypedData)],
  })
  return { timestampMs, signature }
}
```

Typical call site (like a thread like):

```ts
const { timestampMs, signature } = await signAuthRequest(wallet, {
  action: "hatch-toggle-like",
  address: walletAddress,
  payload: { action: "like", chainId, tokenId },
})
await invokeEdgeFunction("hatch-toggle-like", {
  chainId, tokenId, action: "like", timestampMs, signature,
})
```

## Server: digest reconstruction + ecrecover (no SDK auth)

```ts
const SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000

const DOMAIN_TYPESTRING = "EIP712Domain(string name,string version)"
const AUTH_TYPESTRING =
  "PoPoAuth(string action,address wallet,uint256 timestamp,string payload)"

function buildAuthDigest(input): Uint8Array {
  const payloadJson = canonicalJson(input.payload)   // same key sort
  return k256(
    utf8("\x19\x01"),
    hashDomain(input.realm ?? DEFAULT_REALM),        // keccak(typehash‖name‖version)
    k256(
      AUTH_TYPEHASH,
      encodeString(input.action),
      encodeAddress(input.address),
      encodeUint(BigInt(input.timestampMs)),
      encodeString(payloadJson),
    ),
  )
}

export function verifySignature(input) {
  if (!input.action || !input.address || !input.timestampMs || !input.signature)
    return { ok: false, error: "Missing signature parameters" }

  if (Math.abs((input.nowMs ?? Date.now()) - input.timestampMs) > SIGNATURE_MAX_AGE_MS)
    return { ok: false, error: "Signature expired" }

  const digest = buildAuthDigest(input)
  const recovered = recoverTypedSignAddress(digest, input.signature)
  if (recovered.toLowerCase() !== input.address.toLowerCase())
    return { ok: false, error: "Signature does not match caller address" }

  return { ok: true, address: input.address.toLowerCase() }
}
```

`recoverTypedSignAddress` uses `@noble/curves` secp256k1: parse `r,s,v` →
`Signature.fromCompact(...).addRecoveryBit(v).recoverPublicKey(digest)` →
keccak of the uncompressed pubkey, last 20 bytes = signer address. Hand-rolled
EIP-712 encoding (no viem in Deno) keeps the dependency surface tiny.

## Why it matters

- **No session/JWT infra, no anonymous DB writes.** The browser never sees the
  service-role key; every function verifies before writing.
- **Action-scoped.** `action` + canonical payload mean a signature for a like
  cannot authorize a profile edit; realm separation isolates affiliate.
- **Replay-bounded.** 10-minute window; payloads include chain/token ids where
  needed.
- **Free UX.** Social actions (likes, replies, thread posts, applications) need
  no gas transaction — just a familiar wallet signature popup.
- **Shared single source of truth.** Client and server files carry explicit
  comments warning they must stay byte-identical (domain name, field order,
  JSON canonicalization).
