---
name: popo
description: Use the MetaMask Agent Wallet CLI plugin `mm popo` to inspect and trade PoPo.meme Hatch meme coins and YES/NO prediction markets on Monad testnet.
---

# PoPo.meme Agent Wallet skill

This skill tells an autonomous agent how to use [`mm-plugin-popo`](../../metamask-agent-plugin/README.md), a MetaMask Agent Wallet CLI plugin for PoPo.meme on **Monad testnet** (chainId `10143`).

## What the plugin can do

The plugin adds nine commands under the `popo` topic:

| Command | Auth | Purpose |
| --- | --- | --- |
| `mm popo markets` | none | List live prediction markets, YES/NO supply, price and pot. |
| `mm popo market <index-or-digest>` | none | Inspect one prediction market. |
| `mm popo quote --kind predict ...` | none | Calculate an exact prediction YES/NO quote without sending a transaction. |
| `mm popo quote --kind hatch ...` | none | Read an on-chain Hatch bonding-curve quote. |
| `mm popo vault` | Agent Wallet | Show ERC-20 `$P`, vault `$P`, and allowances. |
| `mm popo position` | Agent Wallet | Show YES/NO positions. |
| `mm popo faucet` | Agent Wallet signature | Claim 1,000,000 testnet `$P` through an Agent Wallet-approved EIP-712 signature. No MON gas is needed for the faucet claim because the service hot wallet mints the tokens. |
| `mm popo deposit --amount <P>` | Agent Wallet transaction | Approve ERC-20 `$P`, deposit into the ERC-6909 vault, and approve trading. |
| `mm popo predict ...` | Agent Wallet transaction | Buy or sell prediction YES/NO shares. |
| `mm popo trade ...` | Agent Wallet transaction | Buy or sell a Hatch bonding-curve token. |

Every command accepts `--json`. Machine agents should prefer `--json` because it returns stable `{ ok, data, error }` output.

## Install

```bash
npm install -g @metamask/agent-wallet@latest
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true

cd metamask-agent-plugin
npm install
npm run link-host-sdk
npm run build
mm plugins install "file:$PWD" --accept-permissions
mm popo --help
```

The plugin is built and verified against `@metamask/agent-wallet` `7.1.0`. It supports both `server-wallet` and BYOK modes.

If a restricted network requires a proxy, set Node's built-in fetch proxy support before running networked `mm` commands:

```bash
export NODE_USE_ENV_PROXY=1
export HTTPS_PROXY=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
export ALL_PROXY=http://127.0.0.1:7897
export NO_PROXY=localhost,127.0.0.1
```

## Agent setup

The human owner must complete authentication and wallet creation. The agent must never ask for or handle a mnemonic, private key, password, or refresh token.

```bash
mm login
mm init --wallet server-wallet --mode guard
mm wallet address
mm wallet balance
```

Recommended mode is `server-wallet` + `guard`, so every signature and transaction can be approved through MetaMask Agent Wallet policy/MFA.

Public reads do not require login:

```bash
mm popo markets --json
mm popo market 0 --json
mm popo quote --kind predict --market 0 --outcome yes --side buy --amount 2 --json
```

Wallet reads and writes require an initialized Agent Wallet:

```bash
mm popo vault --json
mm popo position --json
```

## Trading workflow

1. Discover and price the market:

   ```bash
   mm popo markets --json
   mm popo market 0 --json
   mm popo quote --kind predict --market 0 --outcome yes --side buy --amount 2 --json
   ```

2. Claim testnet `$P` if needed. This command requests an EIP-712 signature through Agent Wallet; the faucet service performs the mint:

   ```bash
   mm popo faucet --json
   ```

3. Obtain MON gas from <https://faucet.monad.xyz>. The Agent Wallet address returned by `mm wallet address` must hold MON before deposit or trade transactions.

4. Deposit `$P` into the PoPo trading vault:

   ```bash
   mm popo deposit --amount 100 --json
   ```

5. Buy prediction shares:

   ```bash
   mm popo predict --side buy --market 0 --outcome yes --amount 2 --json
   ```

6. Verify the resulting state:

   ```bash
   mm popo vault --json
   mm popo position --market 0 --json
   ```

7. Exit the position:

   ```bash
   mm popo predict --side sell --market 0 --outcome yes --amount 2 --json
   ```

For Hatch tokens, first use a valid Monad Hatch token id. Do not use token id `0`; `previewBuy` reverts for it:

```bash
mm popo quote --kind hatch --token <hatchTokenId> --side buy --amount 10 --json
mm popo trade --side buy --token <hatchTokenId> --amount 10 --slippage-bps 100 --json
```

## Security and policy rules

- Never read, print, store, or request the owner's private key, mnemonic, password, or session token.
- Every signature and transaction must use `ctx.walletExecutor` in the plugin; do not bypass Agent Wallet with a local signer, relayer, or raw key.
- Treat `guard` approval prompts as mandatory. Stop and ask the human owner to approve or reject the Agent Wallet request.
- Use small testnet amounts first.
- Do not assume a transaction is final until the JSON result contains a transaction hash and the receipt is successful.
- Slippage is enforced on-chain for Hatch trades through `minTokensOut` / `minQuoteOut`.
- Prediction prices are summed integer curve points using `k * sqrt(supply) + c`; always call `quote` before buying.

## Monad testnet contracts

- PoPoApp Diamond: `0xa08e66FD7f19C22Fe44928518DFe6A867B0E4c07`
- MarketFacet: `0xa967407cE6f65Efd7919Ec9E22f9B7a8b9982Db0`
- `$P` / USDPApp: `0xf8D44b7682fe1f2D3d5089DCA3510D830675C662`
- Public RPC: `https://testnet-rpc.monad.xyz`
- Fallback RPC: `https://monad-testnet.drpc.org`
- Explorer: <https://testnet.monadexplorer.com>

Override the plugin's read RPC if desired:

```bash
export POPO_MONAD_RPC_URL="https://monad-testnet.g.alchemy.com/v2/$ALCHEMY_API_KEY"
```

## Troubleshooting

- `AUTH_FAILED`: run `mm login` and ensure the project was initialized with `mm init`.
- `NOT_INITIALIZED`: run `mm init --wallet server-wallet --mode guard` in the project directory.
- `No active Agent Wallet found`: check `mm wallet list` and select the intended wallet.
- Capability errors after editing the plugin: rebuild and reinstall it with `npm run build && mm plugins install "file:$PWD" --accept-permissions`.
- Agent Wallet rejects EIP-712 signing with a domain chainId mismatch: keep chainId `10143` in both the signature request and PoPo faucet payload.
- Out-of-gas or nonce errors require MON and a healthy Agent Wallet policy state; do not retry blindly.
