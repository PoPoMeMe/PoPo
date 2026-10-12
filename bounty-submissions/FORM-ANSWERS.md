# Monad Metropolis — 最终表单答案合集（可直接粘贴）

> Team: **PoPo.meme** (`predpred`) ｜ Track: **Onchain Finance & Trading**
> Network: Monad testnet, chainId `10143`
> 用法：在 https://hackathon.monad.xyz 提交页，按每个 bounty 的字段，把下面对应
> 段落直接粘贴。凡是 **【待填】** 的地方在录完视频 / 公开 repo 后补上链接。
> 链接占位统一用：
> - 公开仓库：`【REPO_URL】`
> - 在线 demo：`【LIVE_URL】`（建议 Monad 默认演示构建）
> - 视频：`【VIDEO_<bounty>】`

---

## 0. 团队 / 项目公共信息（所有 bounty 通用）

- **Project name:** PoPo.meme
- **One-liner:** A launch-to-LP meme-coin trading arena with on-chain prediction
  markets, an embedded-wallet UX, an agent-trading plugin, and indexed analytics —
  all deployed and live on Monad testnet.
- **Monad testnet contracts:**
  - PoPoApp Diamond (Hatch AMM + vault + prediction + LP): `0xa08e66FD7f19C22Fe44928518DFe6A867B0E4c07`
  - MarketFacet: `0xa967407cE6f65Efd7919Ec9E22f9B7a8b9982Db0`
  - $P (USDPApp): `0xf8D44b7682fe1f2D3d5089DCA3510D830675C662`
  - PFT (soulbound outcome/compensation token): `0xEE172A8486454ff5f01593Cb62B70CAFD8BC1c9E`
  - EpisodeBuybackRouter: `0xDD91C29F40af463B42871a010cAFbddD90892266`
- **Live prediction market:** digest `0x7fd5153590607951f0abdd92f39ba4422d3bad94d319558d47f6564cd15a3e52`,
  YES/NO ERC-6909 ids `52/53`, enabled & trading.
- **Explorer:** https://testnet.monadexplorer.com ｜ **Faucet:** https://faucet.monad.xyz

---

## 1. Privy — "Beyond authentication" ($5,000)

**字段要求**（catalog `requirements`）：以「集成深度 + 视频」交付，强调不止登录。

**Describe your integration / answer:**

> PoPo.meme uses Privy as the **full transaction and identity layer**, not just
> sign-in. On Monad testnet (and every supported chain) the Privy embedded
> wallet is the only business signing key:
> - **All contract transactions go through Privy** — bonding-curve buy/sell,
>   vault deposit/withdraw, prediction-market YES/NO trades, and AMM swaps use
>   `useSendTransaction`/the embedded-wallet provider (19 transaction-hook call
>   sites, ~75 `sendTransaction` usages across ~98 files).
> - **Silent EIP-712 authorization** (`useSignTypedData` with
>   `uiOptions.showWalletUIs:false`) secures every direct Supabase write; Edge
>   Functions recover the signer and reject raw addresses (no `personal_sign`
>   popups).
> - **Privy access tokens** authenticate the app's Edge/API layer (14
>   `getAccessToken` call sites).
> - Monad testnet (chainId 10143) is wired via `privyWalletOverride` so Privy's
>   server-side preflight/balance check and submission all run against a working
>   Monad RPC.
> External injected wallets are used only for one-off top-ups; there is no
> fallback signing path for product actions.

**Demo video (≤2 min):** `【VIDEO_PRIVY】`

**Public link:** `【REPO_URL】` ｜ Live: `【LIVE_URL】`

---

## 2. MetaMask — Best Agent Wallet Plugin ($2,500)

**字段要求**：可安装插件 + 演示通过 Agent Wallet 完成真实链上动作 + 视频。

**Describe your integration / answer:**

> We built `mm-plugin-popo`, an oclif plugin for the **MetaMask Agent Wallet
> CLI** that lets an AI agent trade on PoPo.meme on Monad testnet entirely
> through Agent Wallet's security layer. It adds nine commands under the
> `popo` topic:
> - public read/no login: `popo markets`, `popo market <digest>`, `popo quote`
> - wallet read: `popo vault`, `popo position`
> - signature/write: `popo faucet`, `popo deposit`, `popo predict`, `popo trade`
>
> Compliance with Agent Wallet:
> - The plugin **never touches a private key**. Every signature/transaction goes
>   through `ctx.walletExecutor(io, "popo:…")`, so BYOK and server wallets both
>   get Agent Wallet MFA + per-action policy approval.
> - Capabilities are declared per command in `package.json#mm.commands`
>   (`wallet-read` for wallet reads, `wallet-submit` for signatures/tx).
> - Public market reads use viem over Monad public RPC / dRPC (override with
>   `POPO_MONAD_RPC_URL`, including Alchemy); wallet state and writes use the
>   Agent Wallet host.
> - We completed the **full live trade loop** with a real server-wallet
>   (`guard`) on chainId 10143, every mutation confirmed through Agent Wallet's
>   per-transaction email MFA and policy layer:
>   EIP-712 faucet claim `0xcffa3950…6ac93` (+1,000,000 $P, hot-wallet mint),
>   ERC-20 approve `0x34526ee1…8942`, deposit 100 $P `0xce5f260b…2a28`
>   (success), vault ERC-6909 approve `0xcf4fadca…a421`, and
>   `predict buy 0 yes 2` `0x14bbadb4…e768` (success) — position YES=2, vault
>   100→61.3275084 $P, matching the plugin's exact curve quote to the wei.
> - Monad testnet ships in the Agent Wallet registry with no RPC config; we add
>   it once via `customEvmChains` (`rpcTarget=https://testnet-rpc.monad.xyz`)
>   and supply EIP-1559 fees + gas ourselves so the host's gas API (which
>   rejects 10143) is never needed.
> - Slippage protection on bonding-curve trades uses on-chain `previewBuy/
>   previewSell`; prediction buys replicate the on-chain `k·√supply + c` pricing
>   and pre-fund the internal vault exactly, verified bit-for-bit against chain
>   values.
>
> Funds settle inside the PoPoApp vault's internal $P (ERC-6909 quote id 1):
> `ERC-20 approve → deposit(1, amount) → one-time ERC-6909 approve`, then Hatch
> and prediction trades spend internal $P.

**Install (judge machine, MetaMask Agent Wallet ≥6.2.0 beta):**

```bash
# CLI (Node ≥22.18):
npm install -g @metamask/agent-wallet@latest   # provides `mm`, built vs 7.1.0
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true
# from the public repo
cd hackathon/metamask-agent-plugin && npm i && npm run link-host-sdk && npm run build
mm plugins install "file:$PWD" --accept-permissions

# One-time: give chainId 10143 a public RPC (the registry ships none) by adding
# an entry with rpcTarget https://testnet-rpc.monad.xyz to
# ~/.metamask/wallets.json -> data.customEvmChains (exact JSON in the README).
mm wallet balance --chain 10143 --json   # should read your MON

mm popo markets                 # public read, no login required
mm popo quote --kind predict --market 0 --outcome yes --side buy --amount 2
mm login                        # one-time, for wallet commands
mm popo faucet                  # Agent Wallet EIP-712 signature; claims test $P
# get MON gas from https://faucet.monad.xyz, then confirm the EMAIL approval
# Agent Wallet emails for EACH write (expires in 10 min; trust the network once):
mm popo deposit 20              # positional amount: approve -> deposit -> 6909 approve
mm popo predict buy 0 yes 2     # positional: <buy|sell> <marketRef> <yes|no> <shares>
mm popo position 0
```

> 7.1.0 note: the plugin already ships a Node-compat shim for the CLI's
> `window.addEventListener` bug and keeps the SDK a single peer copy, so no
> `NODE_OPTIONS` wrapper is needed. Server-wallet + social login sends a
> **per-transaction approval email** (`mm wallet requests list` /
> `mm wallet requests watch <id>` to track); the first write also asks you to
> trust the new network. Under Node 24, networked `mm` commands may need
> `NODE_USE_ENV_PROXY=1` plus proxy env vars on a restricted network. Public
> reads use the Monad public RPC (override via `POPO_MONAD_RPC_URL`); only
> wallet/signature/trade commands need `mm login`.

**Agent skill file:** https://github.com/PoPoMeMe/PoPo/blob/main/skills/popo/SKILL.md

**Demo video (REQUIRED, ≤5 min):** `【VIDEO_MM】`
**SKILL.md (REQUIRED url):** https://github.com/PoPoMeMe/PoPo/blob/main/skills/popo/SKILL.md
**Repo:** https://github.com/PoPoMeMe/PoPo

> 官方唯一评审标准：*“a working, installable plugin that routes all transactions through the Agent Wallet with no bypass of signing, policy, or MFA”*。提交视频必须展示每笔交易的 Agent Wallet MFA/policy 审批（我们用 guard + 每笔邮件确认），不能切 beast、不能加白名单自动放行。

---

## 3. Envio — Best Use of Envio ($1,000)

**字段要求**：真实可用的 Envio 应用 + 视频 + 公开 repo。

**Describe your integration / answer:**

> We built `popomonad`, a **HyperIndex v2** indexer for PoPo.meme on Monad
> testnet that streams every trade on our two on-chain venues behind one
> EIP-2535 Diamond into a typed Postgres layer with an auto-generated GraphQL
> API.
> - **Hatch bonding curve:** `TokenCreated`, `Buy`, `Sell`,
>   `BondingCurveComplete` → coins, holders, per-trade ledger, rolling
>   volume/fees/supply/last-price, graduation.
> - **Prediction markets:** single + batch `Buy/Sell` keyed by market
>   `digest` → YES/NO open interest, volume, fees, per-trader positions, full
>   order flow.
> - Overloaded `Buy/Sell` events across facets are handled with two logical
>   contracts sharing one Diamond address; start block is the Diamond deploy
>   block `70016287`.
> - `envio codegen` and `tsc --noEmit` are clean; typed `uint256 → bigint`.
> The GraphQL API answers coin/holder/volume rankings and prediction
> open-interest questions without getLogs-heavy public-RPC polling — important
> under Monad's sub-second blocks and strict node log limits.

**Run:**

```bash
cd hackathon/envio-indexer && cp .env.example .env && npm i && npm run dev
```

**Demo video (≤2 min):** `【VIDEO_ENVIO】` ｜ **Repo:** `【REPO_URL】`

---

## 4. Alchemy — Best projects using Alchemy ($1,000 credits)

**字段要求（catalog 明确）**：
- (text, required) "Describe how your project meaningfully integrates one or
  more of Alchemy's services or tools."
- (url, optional) ≤2min demo video.

**Required text answer (paste verbatim):**

> PoPo.meme integrates two Alchemy services on Monad testnet (chainId 10143):
> (1) the **Alchemy Supernode** as the **primary JSON-RPC** for both viem reads
> and Privy embedded-wallet transaction submission, with the public Monad RPC
> and dRPC kept as automatic fallbacks; and (2) the **Enhanced APIs**
> `alchemy_getTokenBalances` and `alchemy_getAssetTransfers`, used to render the
> connected wallet's $P balance and ERC-20 transfer history without
> getLogs-heavy client indexing. The integration is env-gated
> (`VITE_ALCHEMY_API_KEY`) and fails safe: without a key the app uses the
> original endpoints unchanged. We verified on Monad testnet that the Alchemy
> endpoint returns chainId `0x279f` (10143), tracks the canonical head, and
> returns real token balances/transfers for the $P contract
> `0xf8D44b7682fe1f2D3d5089DCA3510D830675C662`.
> Code: `app/src/lib/alchemy.ts`, `app/src/hooks/use-alchemy-monad.ts`, wired in
> `app/src/main.tsx`.

**Optional demo video (≤2 min):** `【VIDEO_ALCHEMY】`

---

## 5. 主赛道提交（Onchain Finance & Tracking）公共素材

- **Live link:** `【LIVE_URL】`（Monad testnet 默认构建；评委登录用邮箱/ passkey，
  在站内 faucet 领测试 $P）。
- **Judge notes / repo:** `【REPO_URL】`（含 `hackathon/README.md`,
  `ARCHITECTURE.md`, `DEMO-SCRIPT.md`）。
- **技术 demo:** `【VIDEO_TRACK_TECH】`（≤3 min） ｜ **Pitch:** `【VIDEO_PITCH】`（≤2 min）。
