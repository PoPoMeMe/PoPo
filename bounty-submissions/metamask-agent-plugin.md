# MetaMask Agent Wallet Plugin — PoPo.meme (`mm-plugin-popo`)

> **Track:** Onchain Finance & Trading (Monad testnet, chainId 10143)
> **Bounty:** Best use of the Agent Wallet — build an agentic dApp or plugin
> **Team:** PoPo.meme (`predpred`)

## What we built

A native **MetaMask Agent Wallet CLI plugin** (`mm popo …`) that lets an AI
agent trade on PoPo.meme end to end from the terminal / REPL — both the
**Hatch bonding-curve meme coins** and the **YES/NO prediction market**, on
Monad testnet.

Source: `metamask-agent-plugin/`
Package: `mm-plugin-popo` (oclif plugin, topic `popo`).

## Commands

| Command | Capability | Purpose |
| --- | --- | --- |
| `mm popo markets` | wallet-read | List prediction markets with live YES/NO price, supply, pot |
| `mm popo market <index\|digest>` | wallet-read | Full market detail |
| `mm popo quote predict/hatch …` | wallet-read | Exact curve quote without sending |
| `mm popo vault` | wallet-read | Raw ERC-20 $P + internal vault $P + allowances |
| `mm popo position [ref]` | wallet-read | YES/NO share holdings |
| `mm popo deposit <amount>` | wallet-submit | ERC-20 approve → vault deposit → one-time ERC-6909 approve |
| `mm popo predict <buy\|sell> <ref> <yes\|no> <n>` | wallet-submit | Trade YES/NO shares (auto-funds vault on buys) |
| `mm popo trade <buy\|sell> <tokenId> <amount>` | wallet-submit | Trade a Hatch meme coin with slippage protection |

All commands emit `--json` for machine consumption.

## Agent-wallet compliance (the bounty's key requirement)

- **Every transaction routes through the Agent Wallet**: each write command
  obtains the executor with `ctx.walletExecutor(io, "popo:…")` and submits via
  `executor({ kind: "transaction", chainId: 10143, transaction })`.
- **No private keys / no external signer**: the plugin never imports an
  account or signs locally. Both **BYOK** and **server-wallet** modes work,
  with the host driving MFA approval and explorer links.
- **Allowlist/policy support out of the box**: because calls go through the
  normal executor, `mm policy` allowlists and spending rules apply unchanged;
  pending approvals surface via `mm wallet requests`.
- **Least-privilege capabilities**: read commands request only `wallet-read`;
  exactly three commands request `wallet-submit`, declared per command in
  `package.json#mm.commands`. No reserved/admin capabilities.
- Host-managed RPC via `ctx.publicClient(10143)` — the plugin ships no secret
  RPC or relayer.

## Why it is useful beyond a demo

It closes an unattended, policy-bounded agent loop:

```
markets → quote → deposit → predict/trade → position → sell
```

- An agent can run a market-making / averaging strategy on YES/NO shares.
- Exact cost is computed off-chain with a verified replica of the on-chain
  `k·√supply + c` curve (`src/lib/curve.ts`), so buys pre-fund the exact vault
  amount; Hatch trades use on-chain `previewBuy/previewSell` and enforce
  `minTokensOut`/`minQuoteOut`.
- Buys auto-top-up the internal vault (ERC-20 approve + deposit) only when
  short, so a fresh funded agent works in one command.

## Verification done

- `npm run build` → `tsc` + `oclif manifest` succeed; all 8 commands appear in
  the manifest under topic `popo`.
- Curve replica matches on-chain values exactly (e.g. next-share price at
  supply 2 = `2.931370849898476` $P, identical to the live market read).
- Addresses/ABIs taken from the deployed Diamond; the plugin talks to the same
  contract an end-to-end trade smoke test passed against.

> The `mm` CLI beta is not installed in our CI; judges can load it with
> `mm plugins install "file:$PWD" --accept-permissions` (see README).

## Deliverables mapping

- Real plugin built with the Agent Wallet plugin SDK (`@metamask/agent-wallet`
  plugin commands, capabilities, manifest) — not just any wallet.
- All transactions via Agent Wallet; multiple actions beyond a simple swap
  (deposit, two trading surfaces, quoting, positions).
- Public GitHub + README with install/run steps — *(link to insert)*.
- ≤2 min demo video — *(link to insert)*: `mm popo markets`, `deposit`,
  `predict buy 0 yes 5` (MFA approval shown), `position`, `predict sell`.
