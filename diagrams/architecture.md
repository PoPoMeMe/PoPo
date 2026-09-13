# Diagrams

Mermaid sources — render automatically on GitHub, or paste into
<https://mermaid.live>.

## 1. System overview

```mermaid
flowchart LR
    subgraph Browser
        UI[React 19 SPA<br/>viem 2 · shadcn/ui · Three.js]
        EW[Privy embedded wallet<br/>ALL business signing]
        FE[On-chain fallback indexer<br/>getLogs trades/holders]
        P2P[P2P media engine<br/>SW + WebRTC]
    end

    subgraph Edge[Supabase Edge Functions · Deno]
        V[EIP-712 verifySignature<br/>ecrecover · 10-min window]
        W[service-role writes only]
    end

    DB[(Postgres<br/>threads · likes · replies<br/>trades index · holders<br/>episodes · applications)]
    STO[(Storage<br/>videos · images)]

    subgraph Chain[Diamond Proxy · EIP-2535]
        CURVE[HatchSwap<br/>bonding curve]
        PM[PoolManager<br/>v4-style CLM · hooks]
        VAULT[Vault<br/>ERC-6909 ledger]
        MIG[Migration]
        REF[Referral]
        EP[Episodes + buyback]
        PRED[Prediction market]
        AC[AccessControl]
    end

    HOOK[CreatorFeeHook<br/>CREATE2 0x44 · tiered fee]

    UI -->|read RPC| Chain
    UI --> FE
    EW -->|eth_signTypedData_v4| V
    UI -->|invoke| V
    V --> W --> DB
    UI -->|signed uploads| STO
    P2P -.offloaded bytes.-> STO
    EW -->|sendTransaction| Chain
    CURVE -->|graduate| MIG --> PM
    PM --> HOOK
    CURVE --- VAULT
    PM --- VAULT
    REF --- VAULT
    EP -->|daily buy| PM
    EP -->|burn| VAULT
    AC -.canCall selector.- UI
```

## 2. Token lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active: create(fee) — total supply minted to Diamond
    Active --> Active: buy / sell on xy=k curve<br/>platform + creator fees<br/>referral carve-out
    Active --> Complete: realQuoteReserves ≥ threshold
    Complete --> Graduated: permissionless migrate()<br/>init pool + seed full-range LP<br/>vesting clock starts
    Graduated --> Graduated: AMM swaps<br/>hook charges tiered creator fee
    Graduated --> Graduated: daily buyback-and-burn<br/>episode treasury
    note right of Graduated
        Creator reserve tokens:
        cliff then linear daily unlock
    end note
```

## 3. Flash accounting during migration

```mermaid
sequenceDiagram
    participant Anyone
    participant Diamond
    participant PM as PoolManager facet
    participant Ledger as ERC-6909 ledger

    Anyone->>Diamond: migrate(tokenId)
    Diamond->>Diamond: _markGraduated (status + vesting clock)
    Diamond->>Diamond: sqrtPriceX96 from curve reserves
    Diamond->>PM: initializePool(key, sqrtPriceX96) [locked]
    Diamond->>PM: unlock(callbackData)
    PM-->>Diamond: unlockCallback (msg.sender == address(this))
    Diamond->>PM: modifyLiquidity(+L full-range)
    PM->>Ledger: record negative deltas
    Diamond->>PM: _accountDelta(diamond, -delta) ×2
    Note over Diamond,Ledger: deltas net to zero — reserves were<br/>already on the Diamond ledger
```

## 4. EIP-712 secured Supabase write

```mermaid
sequenceDiagram
    participant U as User (embedded wallet)
    participant C as Client
    participant E as Edge Function
    participant DB as Postgres (service role)

    U->>C: click like / reply / apply
    C->>C: canonicalJson(payload), keys sorted
    C->>U: eth_signTypedData_v4(PoPoAuth)
    U-->>C: signature + timestampMs
    C->>E: {action, address, payload, timestampMs, signature}
    E->>E: freshness ≤ 10 min
    E->>E: rebuild EIP-712 digest · secp256k1 recover
    alt recovered == claimed
        E->>DB: validated write
        DB-->>C: ok
    else mismatch / stale
        E-->>C: 401, no write
    end
```

## 5. Episode buyback flywheel

```mermaid
flowchart TD
    A[Fan buys episode access in $P] --> B{split}
    B --> C[creator revenue]
    B --> D[platform share]
    B --> E[buyback treasury per coin]
    E -->|once per UTC day, anyone may call| F[router swap inside unlock<br/>sqrtPriceLimit −5%]
    F --> G[bought coin to Diamond]
    G --> H[BURN — total supply drops]
    H --> I[price/supply support for all holders]
```
