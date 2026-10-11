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
> rules, in both BYOK and server-wallet mode. Read commands use the
> authenticated host RPC (`wallet-read`).

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
| `mm popo deposit <amount>` | `wallet-submit` | ERC-20 approve (once) → deposit into vault → one-time ERC-6909 trading approve. |
| `mm popo predict <buy\|sell> <ref> <yes\|no> <shares>` | `wallet-submit` | Buy/sell YES/NO shares; auto-funds the vault on buys (disable with `--no-auto-fund`). |
| `mm popo trade <buy\|sell> <tokenId> <amount>` | `wallet-submit` | Buy/sell a Hatch meme coin with slippage protection (`--slippage-bps`, default 100). |

All commands support `--json` for machine/agent consumption.

## Install (beta)

Requires the Agent Wallet CLI with experimental plugins enabled:

```bash
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true

npm install
npm run build

mm plugins install "file:$PWD" --accept-permissions
mm popo --help
```

Link your Monad-testnet wallet (`mm wallet …`) and make sure Monad testnet
(`10143`) is the active network. Get test `$P` and gas from the PoPo faucet,
then:

```bash
mm popo markets                       # see the live markets
mm popo deposit 25                    # fund the trading vault
mm popo predict buy 0 yes 5           # buy 5 YES shares through Agent Wallet
mm popo position 0                    # check your shares
mm popo predict sell 0 yes 5          # sell them back
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

## Security model

- Capabilities are declared per command in `package.json#mm.commands`; read
  commands request `wallet-read`, only the three mutating commands request
  `wallet-submit`.
- The plugin has **no network code of its own for signing** and no key access;
  reads go through the host public client and writes through the executor.
- Slippage bounds are enforced on-chain (`minTokensOut` / `minQuoteOut`);
  prediction buys compute exact curve cost before submitting.

## License

MIT
