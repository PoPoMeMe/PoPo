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
| `mm popo faucet` | wallet-read + wallet-submit | Agent Wallet EIP-712 sign-in to claim 1,000,000 testnet $P (server hot wallet mints, so this drip needs no MON gas) |
| `mm popo deposit --amount <amount>` | wallet-submit | ERC-20 approve → vault deposit → one-time ERC-6909 approve |
| `mm popo predict --side buy\|sell --market <ref> --outcome yes\|no --amount <n>` | wallet-submit | Trade YES/NO shares (auto-funds vault on buys) |
| `mm popo trade --side buy\|sell --token <id> --amount <amount>` | wallet-submit | Trade a Hatch meme coin with slippage protection |

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
- **Least-privilege capabilities**: public market reads require no login;
  wallet reads request `wallet-read`; mutating commands request
  `wallet-submit` (faucet needs both because it reads the selected address,
  then asks the Agent Wallet to sign an EIP-712 authorization). Permissions
  are declared per command in `package.json#mm.commands`. No reserved/admin
  capabilities.
- Public reads use a direct viem client over Monad's public RPC list
  (`testnet-rpc.monad.xyz` + dRPC; override with `POPO_MONAD_RPC_URL`, e.g. an
  Alchemy endpoint) because the host gateway RPC requires a signed-in project
  id. Wallet state and all writes still go through Agent Wallet — the plugin
  ships no secret RPC or relayer.

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

## Verification done (2026-10-11, live Monad testnet)

- Installed `@metamask/agent-wallet` **7.1.0** globally and linked the plugin
  with `mm plugins install "file:$PWD" --accept-permissions`; all 8 commands
  appear under topic `popo`.
- `npm run build` → `tsc` + `oclif manifest` succeed.
- Read commands verified with **no login**:
  - `mm popo markets` returned **27 live markets**; market 0 = digest
    `0x7fd5…3e52`, YES/NO ids 52/53, supplies 475/157, pot 7650.23 $P.
  - `mm popo market 0` returned live prices/fees/reward pool.
  - `mm popo quote --kind predict --market 0 --outcome yes --amount 2` returned
    exact total cost `38.526203117690386908` $P.
- With a real CLI 7.1.0 server wallet (`0xb81f…c88d`, `guard` mode),
  `vault` and `position` resolved the selected wallet and returned zero-state.
- `mm popo faucet` completed an Agent Wallet-approved EIP-712 signature and
  claimed **1,000,000 $P** on Monad testnet:
  `0xcffa39500ad667b8e67105b0d72f38ce8e7c2354d6af806d4f92395b00f6ac93`.
  The plugin now reads the host `selectedWallet` instead of assuming the first
  roster entry. The faucet edge accepts the legacy chainless PoPoAuth domain
  for existing Privy clients and an explicit chain-bound variant (`domainChainId`)
  for Agent Wallet; old clients remain unchanged.
- Fixed the ERC-6909 ABI argument order to match the deployed facet:
  `balanceOf(uint256 id,address owner)` and
  `allowance(uint256 id,address owner,address spender)`.
- Curve replica matches on-chain values exactly (e.g. next-share price at
  supply 2 = `2.931370849898476` $P).

### CLI 7.1.0 compatibility fixed in the plugin

- Added `src/lib/node-compat.ts`, imported first by every command, to work
  around the CLI's bundled web3auth bridge crashing under plain Node with
  `window.addEventListener is not a function` (the official sample plugin hit
  the same bug).
- Kept `@metamask/agent-wallet` as a single peer/dev copy (devDep `^7.1.0`) so
  `PluginCommand` identity matches the host; `mm.minCliVersion` is
  `^6.2.0 || ^7.0.0`.

## Deliverables mapping

- Real plugin built with the Agent Wallet plugin SDK (`@metamask/agent-wallet`
  plugin commands, capabilities, manifest) — not just any wallet.
- All transactions via Agent Wallet; multiple actions beyond a simple swap
  (deposit, two trading surfaces, quoting, positions).
- Public GitHub + README with install/run steps — *(link to insert)*.
- ≤2 min demo video — *(link to insert)*: `mm popo markets`, `faucet`
  (Agent Wallet EIP-712 signature), `deposit`,
  `predict --side buy --market 0 --outcome yes --amount 5` (MFA approval
  shown), `position`, `predict --side sell …`.
