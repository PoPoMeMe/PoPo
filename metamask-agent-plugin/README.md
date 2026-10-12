# mm-plugin-popo — PoPo.meme for MetaMask Agent Wallet

A plugin for the **MetaMask Agent Wallet CLI (`mm`)** that lets an AI agent
trade on **PoPo.meme** entirely from the terminal / REPL — on **Monad
testnet (chainId `10143`)**.

PoPo.meme is a meme-coin launch + trading platform with an integrated
**YES/NO prediction market**. This plugin exposes both to an autonomous agent:

- **Hatch bonding-curve meme coins** — buy/sell with exact `previewBuy` /
  `previewSell` quotes and on-chain slippage protection.
- **Prediction markets** — buy/sell **YES/NO shares** priced on the same
  `k·√supply + c` curve, settled in the platform vault's internal `$P`.
- **Vault management** — deposit ERC-20 `$P` into the trading vault and check
  balances/positions.

> Every state-changing call is submitted through the Agent Wallet's
> **`wallet-submit` capability** (`ctx.walletExecutor`). The plugin never
> touches a private key: the host enforces MFA and the user's allow/policy
> rules, in both BYOK and server-wallet mode. Public market reads use direct
> Monad RPC and need no login; wallet reads use `wallet-read`.

## Why it fits the bounty

- Builds a **real plugin using the MetaMask Agent Wallet plugin SDK**, with
  native commands under the `popo` topic (`mm help popo` / REPL discoverable).
- **All transactions route through Agent Wallet** — no external signer, no key
  handling. Allowlists (`mm policy`), MFA and approvals work out of the box.
- **Useful beyond a demo**: a trader/agent can run an end-to-end loop —
  read markets → quote → deposit → buy YES/NO shares or meme coins → monitor
  positions → sell — unattended, inside the user's policy.
- Pinned to **Monad testnet**; addresses live in `src/lib/contracts.ts`.

## Commands

| Command | Capability | What it does |
| --- | --- | --- |
| `mm popo markets` | `wallet-read` | List all prediction markets with live YES/NO price, supply and pot. |
| `mm popo market <index\|digest>` | `wallet-read` | Full detail for one market. |
| `mm popo quote predict <ref> --outcome yes\|no [--side buy\|sell] --amount N` | `wallet-read` | Exact summed cost / redemption for N shares (no send). |
| `mm popo quote hatch --token ID [--side buy\|sell] --amount A` | `wallet-read` | On-chain `previewBuy/previewSell` for a meme coin. |
| `mm popo vault` | `wallet-read` | Raw ERC-20 `$P`, ERC-20 allowance, internal vault `$P` and vault allowance. |
| `mm popo position [ref]` | `wallet-read` | Your YES/NO share balances across all markets or one. |
| `mm popo faucet` | `wallet-read` + `wallet-submit` | Sign an Agent Wallet-approved EIP-712 PoPoAuth request to claim 1,000,000 testnet `$P`; the service hot wallet mints, so no MON gas is needed for this drip. |
| `mm popo deposit <amount>` | `wallet-read` + `wallet-submit` | ERC-20 approve (once) → deposit into vault → one-time ERC-6909 trading approve. |
| `mm popo predict <buy\|sell> <ref> <yes\|no> <shares>` | `wallet-read` + `wallet-submit` | Buy/sell YES/NO shares (**positional args**); auto-funds the vault on buys (pass `--no-auto-fund` to disable). |
| `mm popo trade <buy\|sell> <tokenId> <amount>` | `wallet-read` + `wallet-submit` | Buy/sell a Hatch meme coin with slippage protection (`--slippage-bps`, default 100). |

All commands support `--json` for machine/agent consumption.

## Install (beta)

Requires Node ≥ 22.18 / npm ≥ 10 and the Agent Wallet CLI `mm` (this plugin is
built and verified against `@metamask/agent-wallet` **7.1.0**):

```bash
# 1) Install the CLI globally
npm install -g @metamask/agent-wallet@latest   # provides the `mm` binary
mm --version

# 2) Enable the (still beta) plugin feature
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true   # allow file: installs

# 3) Build + install this plugin FROM ITS DIRECTORY (not a tarball — the CLI
#    reads package.json#mm from the directory to persist capability grants)
cd hackathon/metamask-agent-plugin
npm install
npm run link-host-sdk   # force PluginCommand identity to match global mm
npm run build
mm plugins install "file:$PWD" --accept-permissions
mm popo --help
```

### One-time setup: give chainId 10143 a public RPC (`customEvmChains`)

Monad **Testnet** (`10143`) is in the Agent Wallet registry but ships **with
no RPC config**, and its hosted GasFeeController/EVM gateway answers
`400 Invalid chainId` for it. Fix it once by adding a custom RPC to the local
wallet state (`~/.metamask/wallets.json` → `data.customEvmChains`). An entry
with an explicit `rpcTarget` is used as-is (the host then skips its gateway):

```jsonc
// ~/.metamask/wallets.json → data.customEvmChains
[
  {
    "key": "monad-testnet",
    "chainId": 10143,
    "caip2": "eip155:10143",
    "name": "Monad Testnet",
    "nativeCurrency": { "name": "Monad", "symbol": "MON", "decimals": 18 },
    "blockExplorer": "https://testnet.monadexplorer.com",
    "rpcTarget": "https://testnet-rpc.monad.xyz"
  }
]
```

Verify with `mm wallet balance --chain 10143 --json` (it should read your MON
over the public RPC). The plugin also fills EIP-1559 `maxFeePerGas` /
`maxPriorityFeePerGas` and an explicit gas limit itself, because remote signing
is EIP-1559-only and never calls the hosted gas API for 10143.

### Approvals are per-transaction email MFA (server-wallet + guard)

With `server-wallet` + `guard` mode and a social login, **each** state-changing
request pauses as `AWAITING_MFA` and must be confirmed from the email
registered to the MetaMask account (`authMethod: social`). Requests expire 10
minutes after creation — confirm quickly. The very first transaction on a new
network also surfaces a warning-level **“Trust Monad Testnet / New network”**
policy that you tick once; “Shield scan not available on this network” is
informational only. Track pending requests with `mm wallet requests list` and
resume watching one with `mm wallet requests watch <pollingId>`.

### Known 7.1.0 quirks (already handled here)

1. **`window.addEventListener is not a function`** — the CLI's bundled web3auth
   bridge aliases `globalThis.window = globalThis` under plain Node, then calls
   `window.addEventListener`. Every command imports `src/lib/node-compat.ts`
   first, which installs no-op event methods, so no wrapper/`NODE_OPTIONS` is
   needed.
2. **`Plugin command … must extend PluginCommand`** — caused by two physical
   copies of the SDK. Keep `@metamask/agent-wallet` a **peer/dev dependency**
   resolving to the SAME install the CLI runs. If a nested copy sneaks in,
   point it at the global one:
   ```bash
   G=$(dirname "$(dirname "$(which mm)")")/lib/node_modules/@metamask/agent-wallet
   ln -sfn "$G" node_modules/@metamask/agent-wallet
   ```

### Read vs write commands

- **Public reads need no login**: `popo markets`, `popo market`, `popo quote`
  use a direct viem client over the public Monad RPC list (override with
  `POPO_MONAD_RPC_URL`, e.g. an Alchemy endpoint) — the host gateway RPC would
  otherwise demand a signed-in project id.
- **Wallet commands need auth**: `popo vault`, `popo position`, `popo faucet`,
   `popo deposit`, `popo predict`, `popo trade` run `mm login` (QR/browser/token)
   or use a BYOK wallet from `mm wallet`, on Monad testnet (`10143`). Run
   `mm popo faucet` for test `$P`; MON gas is still required for deposit/predict
   and comes from https://faucet.monad.xyz.

```bash
# public (no login)
mm popo markets
mm popo market 0
mm popo quote --kind predict --market 0 --outcome yes --side buy --amount 2
mm popo quote --kind hatch --token <hatchTokenId> --side buy --amount 10

# requires mm login / wallet
mm popo faucet                        # Agent Wallet EIP-712 sign; receive 1,000,000 test $P
# after receiving MON gas from https://faucet.monad.xyz:
mm popo deposit 25                    # fund the trading vault (positional amount)
mm popo predict buy 0 yes 5           # buy 5 YES on market index 0 (positional)
mm popo position 0                    # check your shares
mm popo predict sell 0 yes 5          # sell them back
mm popo trade buy <hatchTokenId> 10   # buy a Hatch meme coin (positional)
```

## How settlement works

The PoPoApp Diamond (`0xa08e…4c07`) is one EIP-2535 diamond hosting the Vault,
Hatch and Market facets. Trades do **not** move raw ERC-20 `$P`:

1. `deposit(quoteId=1, amount)` pulls ERC-20 `$P` and mints an internal
   **ERC-6909** vault balance (1:1).
2. A one-time ERC-6909 `approve(diamond, quoteId, max)` lets the facets spend it.
3. `buyAmount` / Hatch `buy` spend that internal balance; sells and prediction
   payouts credit it back. `withdraw` returns raw ERC-20 `$P`.

YES/NO shares are themselves soulbound ERC-6909 ids. The curve price for the
next share is `k·√supply + c`; batch fills sum every integer curve point.
`src/lib/curve.ts` is an exact floor-`sqrt` replica of the on-chain math.

## Layout

```
src/lib/contracts.ts  Monad addresses + minimal ABIs (diamond, vault, hatch, market, ERC-20)
src/lib/sdk.ts        active wallet, host viem client, calldata encode, walletExecutor submit
src/lib/curve.ts      exact k·√supply + c sum (matches MarketBase._curveSum)
src/commands/popo/    one file per `mm popo …` command
```

## Live run on Monad testnet (2026-10-11)

Server wallet `0xb81fCEe70017317F79C169B3727193a786bFc88D`, chainId `10143`,
trading mode `guard`; every mutation confirmed via per-tx email MFA:

| Step | tx | Result |
| --- | --- | --- |
| Faucet claim (EIP-712 sign, hot wallet mints) | [`0xcffa3950…6ac93`](https://testnet.monadexplorer.com/tx/0xcffa39500ad667b8e67105b0d72f38ce8e7c2354d6af806d4f92395b00f6ac93) | +1,000,000 `$P` |
| ERC-20 approve (diamond, max) | `0x34526ee14c45bbb44c1d546bf1ac0cad80b9cde2330d26bd169f4ca1e3d38942` | confirmed |
| `deposit` 100 `$P` | [`0xce5f260b…2a28`](https://testnet.monadexplorer.com/tx/0xce5f260bbbbb9867fe6b2eaafb41b8fdeec27043ee58019abe7f143909bd2a28) | success, vault 0→100 |
| Vault ERC-6909 approve | `0xcf4fadca72605282f23df8a6033044ca402ac09ff80125ce94987c5100dea421` | confirmed |
| `predict buy 0 yes 2` | [`0x14bbadb4…e768`](https://testnet.monadexplorer.com/tx/0x14bbadb455df16f5b639873e31b0a3f9be5a195094013802a5eac111a487e768) | success, +2 YES, vault 100→61.3275084 `$P` |

The 38.6724916 `$P` spend matches the plugin's own `popo quote` exact curve
cost to the wei; `mm popo position 0` reports `yesShares = 2`.

## Security model

- Capabilities are declared per command in `package.json#mm.commands`; public
  market reads request no wallet capability, wallet reads request
  `wallet-read`, and mutations request `wallet-submit`. Faucet requires both
  because it reads the selected address then asks for a signature.
- The plugin has **no network code of its own for signing** and no key access;
  reads go through the host public client and writes through the executor.
- Slippage bounds are enforced on-chain (`minTokensOut` / `minQuoteOut`);
  prediction buys compute exact curve cost before submitting.

## License

MIT
