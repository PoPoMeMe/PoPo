# MetaMask Agent Wallet Plugin — PoPo.meme (`mm-plugin-popo`)

> **Track:** Onchain Finance & Trading (Monad testnet, chainId 10143)
> **Bounty:** Best Agent Wallet Plugin — **$2,500 USD** (single prize)
> **Required:** installable plugin + `skills/popo/SKILL.md` url + ≤5 min demo video
> **Sole judging criterion:** *“a working, installable plugin that routes all transactions through the Agent Wallet with no bypass of signing, policy, or MFA”*
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
| `mm popo deposit <amount>` | wallet-read + wallet-submit | ERC-20 approve → vault deposit → one-time ERC-6909 approve |
| `mm popo predict <buy\|sell> <ref> <yes\|no> <n>` | wallet-read + wallet-submit | Trade YES/NO shares (positional args; auto-funds vault on buys, `--no-auto-fund` to disable) |
| `mm popo trade <buy\|sell> <tokenId> <amount>` | wallet-read + wallet-submit | Trade a Hatch meme coin with slippage protection (`--slippage-bps`, default 100) |

All commands emit `--json` for machine consumption.

## Agent-wallet compliance (the bounty's key requirement)

- **Every transaction routes through the Agent Wallet**: each write command
  obtains the executor with `ctx.walletExecutor(io, "popo:…")` and submits via
  `executor({ kind: "transaction", chainId: 10143, transaction })`.
- **No private keys / no external signer**: the plugin never imports an
  account or signs locally. Both **BYOK** and **server-wallet** modes work,
  with the host driving MFA approval and explorer links.
- **Policy + MFA enforced, never bypassed**: we run `server-wallet` + `guard`
  with a **strict policy** (`addresses.allowlist: []`, chainId 10143 NOT in
  `allowed_chains`, `outflow_limits_usd.rolling_24h: 0`). Consequently **every**
  signature/transaction pauses as `AWAITING_MFA` and is confirmed by the owner
  via the email registered to the MetaMask account — we deliberately do **not**
  use `beast` mode or whitelist the PoPo contracts to auto-approve. Pending
  approvals surface via `mm wallet requests list/watch`. The plugin supports
  allowlists/spending rules generically (they flow through the same executor),
  but the demo keeps the strict per-tx MFA posture the bounty requires.
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
  with `mm plugins install "file:$PWD" --accept-permissions`; all **9 commands**
  appear under topic `popo` (markets, market, quote, vault, position, faucet,
  deposit, predict, trade).
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
- **Full state-changing loop executed live through Agent Wallet MFA** (server
  wallet `0xb81f…c88d`, `guard`, chainId 10143). Each tx paused as
  `AWAITING_MFA` and was confirmed from the registered email before signing:
  1. ERC-20 approve (diamond, max) — `0x34526ee14c45bbb44c1d546bf1ac0cad80b9cde2330d26bd169f4ca1e3d38942`
  2. `deposit 100` (success, block 70199024, gas 260226) —
     [`0xce5f260b…2a28`](https://testnet.monadexplorer.com/tx/0xce5f260bbbbb9867fe6b2eaafb41b8fdeec27043ee58019abe7f143909bd2a28), vault 0→100
  3. vault ERC-6909 approve — `0xcf4fadca72605282f23df8a6033044ca402ac09ff80125ce94987c5100dea421`
  4. `predict buy 0 yes 2` (success, block 70202021, gas 352595) —
     [`0x14bbadb4…e768`](https://testnet.monadexplorer.com/tx/0x14bbadb455df16f5b639873e31b0a3f9be5a195094013802a5eac111a487e768),
     position YES=2, vault 100→**61.3275084** $P.
  The 38.6724916 $P spend equals the plugin's own `popo quote` exact curve
  cost to the wei; `mm popo position 0` reports `yesShares = 2`. This proves
  reads, quoting, EIP-712 faucet auth, approve/deposit and both internal-vault
  settlement and the ERC-6909 accounting all work through the guarded Agent
  Wallet — no key ever leaves MetaMask.

### Monad testnet RPC support added (`customEvmChains`)

10143 is in the Agent Wallet registry but ships without an RPC config and its
hosted GasFeeController/EVM gateway returns `400 Invalid chainId`. We added the
network once to `~/.metamask/wallets.json` → `data.customEvmChains` with an
explicit `rpcTarget: https://testnet-rpc.monad.xyz` (plus caip2/native currency/
explorer). The plugin also supplies EIP-1559 `maxFeePerGas` /
`maxPriorityFeePerGas` (base fee ×2 + 2 gwei tip) and a +30% gas estimate from
the public RPC, because remote signing is EIP-1559-only and must never call the
hosted gas API on 10143. Verified by `mm wallet balance --chain 10143` reading
live MON over the public RPC. The first on-chain approval also surfaced the
warning-level “Trust Monad Testnet / new network” guard policy, acknowledged
once; shield-scan-unavailable is informational.

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
- ≤5 min **required** demo video — *(link to insert)*: `mm popo markets`, `faucet`
  (Agent Wallet EIP-712 signature), `deposit 100`,
  `predict buy 0 yes 2` (per-tx email MFA approval + “trust network” guard
  shown), `position 0` (YES=2), `vault`, and the explorer tx pages — matching
  the live hashes above.
