# 视频脚本（逐镜，可直接照录）

> 统一要求：Monad testnet（chainId 10143）｜ 时长见标题 ｜ 先开 explorer 与网络面板
> 备用 ｜ 录屏前清理浏览器无关标签，窗口 16:9，字号调大。所有 tx 在
> https://testnet.monadexplorer.com 可查。

录制前置（一次性）：
1. 系统设置 → 隐私与安全性 → 屏幕录制 → 给录制宿主/终端授权。
2. 由你手动起好：app dev（`VITE_ALCHEMY_API_KEY` 已在 `app/.env.local`）、
   Envio 的 Postgres（`npm run dev` in `hackathon/envio-indexer`）。
3. 备一个 Monad testnet 钱包：MON 来自 https://faucet.monad.xyz ，$P 来自站内
   faucet edge（热钱包 `0x911d…4ae57` 已有 ROLE_1）。

---

## A. Privy ≤2:00（`VIDEO_PRIVY`）

- **0:00–0:15** 打开 PoPo.meme，Monad testnet；点登录，展示 email / passkey /
  GitHub / X（无需助记词，embedded wallet）。
- **0:15–0:35** 进入 Hatch 一个币，点买入；切到 Privy 弹窗，强调**交易由 Privy
  内嵌钱包签名提交**（不是 MetaMask）。
- **0:35–0:55** 预测市场页对 Monad 市场（digest `0x7fd5…3e52`）买 YES；展示
  静默授权（无 `personal_sign` 弹窗）即 EIP-712 PoPoAuth 写 Supabase。
- **0:55–1:15** 设置/个人资料改昵称，展示一次静默 EIP-712 签名（不弹钱包 UI）。
- **1:15–1:35** explorer 里展示对应 tx，from=内嵌钱包地址。
- **1:35–2:00** 口播收束：交易、EIP-712 授权、API access token 全走 Privy；
  外部钱包仅用于充值。给代码路径 `useSendTransaction` / `useSignTypedData`。

---

## B. MetaMask Agent Wallet 插件 ≤2:00（`VIDEO_MM`）

> 环境已就绪（2026-10-11 实测）：本机已装 `@metamask/agent-wallet` **7.1.0** 并
> `mm plugins install file:.../metamask-agent-plugin` 装好 `mm-plugin-popo`。
> 只读命令**免登录**可直接录前半段；写命令需先在交互终端 `mm login`（扫码/浏览器/token，
> 本人操作密钥）。当前实测 server wallet 为 `0xb81f…c88d` / `guard` 模式；可用
> `mm popo faucet` 通过 Agent Wallet EIP-712 签名领取 1,000,000 $P（服务端 mint，无需 MON
> gas），但 deposit/predict 仍需从 https://faucet.monad.xyz 领取 MON。

**第一段（无需登录，现在就能录）**
- **0:00–0:12** 终端 `mm popo --help`：列出 9 个命令（markets/market/quote/vault/
  position/faucet/deposit/predict/trade）。
- **0:12–0:30** `mm popo markets`：实链列出市场（当前 27 个），口播「公开读免登录、
  走公共 Monad RPC（可用 POPO_MONAD_RPC_URL 换 Alchemy），插件不碰私钥」。
- **0:30–0:48** `mm popo market 0`：YES/NO 供应、价格、手续费、奖池读数。
- **0:48–1:05** `mm popo quote --kind predict --market 0 --outcome yes --amount 2`：
  展示精确报价（如 2 份 YES=38.526 $P，k·√supply+c 逐份求和），强调 quote 不发交易。

**第二段（mm login + 充值后录）**
- **1:05–1:22** `mm popo faucet`：展示 Agent Wallet EIP-712 签名批准；成功后 explorer 打开
  mint tx `0xcffa…6ac93`，`mm popo vault` 显示 1,000,000 $P。
- **1:22–1:32** `mm popo vault` / `mm popo position`：展示当前钱包金库与持仓（需登录）。
- **1:32–1:48** `mm popo deposit --amount 20`：**Agent Wallet 弹出 MFA/policy 批准卡**，
  批准后 approve→deposit→6909 approve 完成（重点给批准弹窗特写）。
- **1:48–2:00** `mm popo predict --side buy --market 0 --outcome yes --amount 2`：再次弹
  Agent Wallet 批准，成交；explorer 展示 tx，口播 `walletExecutor` / `wallet-submit`、BYOK
  与 server 同策略。

> 若时间紧，前半段（免登录读 + quote）已能证明插件真实可用；写操作弹窗是加分项。
> 备注：`mm popo quote --kind hatch --token <id>` 需传 Monad 上有效 Hatch token id，
> 别用 id=0（会 revert）。

---

## C. Envio HyperIndex ≤2:00（`VIDEO_ENVIO`）

> 前置：起 Postgres，`cd hackathon/envio-indexer && npm run dev`。

- **0:00–0:20** 展示 `config.yaml`（Hatch + PredictionMarket 两逻辑合约共用钻石
  地址，start_block 70016287）与 `schema.graphql` 7 个实体。
- **0:20–0:45** 终端 `envio dev` 同步进度（区块增长、事件入库）。
- **0:45–1:15** 浏览器打开 Hasura GraphQL：查 `predictionMarket`（YES/NO open
  interest、volume）与 `hatchTrade`/`memecoin` 排行榜。
- **1:15–1:40** 在 PoPo.meme 实时做一笔 Hatch 买/卖或预测交易，回到 GraphQL 刷新，
  新 trade 与累计 volume 立即出现。
- **1:40–2:00** 口播：sub-second 出块 + 节点 getLogs 限制下，HyperIndex 提供类型化
  查询，供前端与 agent 读重场景。

---

## D. Alchemy ≤2:00（`VIDEO_ALCHEMY`，catalog 里选填但建议交）

- **0:00–0:20** 展示 `.env.local` 的 `VITE_ALCHEMY_API_KEY`（打码）与
  `app/src/lib/alchemy.ts`：Supernode 列首位、公共 RPC + dRPC 降级。
- **0:20–0:45** 终端快速证据（我已实测，可现场再跑）：
  - `eth_chainId` → `0x279f`；Alchemy 与公共节点 `eth_blockNumber` 一致。
  - `alchemy_getTokenBalances` 返回 deployer 的 $P=2.0。
  - `alchemy_getAssetTransfers` 返回 $P 铸造/转账记录。
- **0:45–1:15** 切到 Monad testnet，Privy 内嵌钱包做一笔交易，网络面板/RPC 指向
  `monad-testnet.g.alchemy.com`。
- **1:15–1:40** 打开钱包资产/活动面：余额与 $P 转账来自 Enhanced API
  （`use-alchemy-monad.ts`）。
- **1:40–2:00** explorer 展示 tx；口播 env 门控：无 key 时行为与旧版完全一致。

---

## E. 主赛道技术 Demo ≤3:00（`VIDEO_TRACK_TECH`）

按 `hackathon/DEMO-SCRIPT.md` 主线：登录(embedded) → 领水 → 发币 → 曲线买卖 →
预测市场 YES/NO →（如时间允许）毕业→AMM → hook 创作者费。全程 Monad testnet 实链，
每个写操作给 explorer tx 特写。

## F. Pitch ≤2:00（`VIDEO_PITCH`）

问题（meme 发射到 LP 断层、预测市场体验割裂）→ 方案（发射→毕业→AMM 一体化 + 金库
wPCT 结算的预测市场 + agent 交易 + 索引分析）→ Monad 上已上线实链数据 → 奖项叠加
（Privy / Agent Wallet / Envio / Alchemy）→ CTA（live link + repo + 评委领水）。
