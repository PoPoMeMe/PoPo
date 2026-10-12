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

## B. MetaMask Agent Wallet 插件 ≤5:00（`VIDEO_MM`，官方必填）

> ⭐ 这条 bounty 唯一评审标准是 *“routes all transactions through the Agent
> Wallet with no bypass of signing, policy, or MFA”*。全片核心就是反复证明：
> 插件**从不碰私钥**，每一次签名/交易都走 Agent Wallet，并由 owner 逐笔在
> 邮件 MFA + guard policy 中确认。**不要切 beast、不要配白名单自动放行。**

> 环境已就绪（2026-10-11 实测，server wallet `0xb81f…c88d` / `guard` / chainId 10143）：
> 本机已装 `@metamask/agent-wallet` **7.1.0** 并
> `mm plugins install file:.../metamask-agent-plugin` 装好 `mm-plugin-popo`（9 命令）。
> 已在 `~/.metamask/wallets.json` 的 `customEvmChains` 给 10143 配 `rpcTarget`
> （registry 无内置 RPC，否则托管 gas API 报 Invalid chainId）。只读命令**免登录**。
> 写命令已在本机真实跑通：server-wallet + 社交登录下，**每笔交易都是发到注册邮箱的
> MFA 确认链接**（不是 App 弹窗），首笔还要勾选「Trust Monad Testnet」，请求 10 分钟过期；
> 用 `mm wallet requests list/watch` 跟踪。已落袋的 tx 可直接在 explorer 展示（见下）。

**第一段 · 安装与只读（无需登录）**
- **0:00–0:20** 口播选题：「给 MetaMask Agent Wallet 加一个交易超能力 —— 在 Monad
  testnet 上交易 PoPo.meme 预测市场/meme 币」。终端 `mm popo --help`：列出 9 个命令。
- **0:20–0:45** 快速带过安装：`npm i -g @metamask/agent-wallet`、`npm run build`、
  `mm plugins install "file:$PWD" --accept-permissions`（可快进），以及一次性的
  `customEvmChains` RPC 配置（强调只是节点连接，不是安全放行）。
- **0:45–1:10** `mm popo markets`：实链列出市场（当前 27 个），口播「公开读免登录、
  走公共 Monad RPC（可用 POPO_MONAD_RPC_URL 换 Alchemy），插件不碰私钥」。
- **1:10–1:30** `mm popo market 0`：YES/NO 供应、价格、手续费、奖池读数。
- **1:30–1:55** `mm popo quote --kind predict --market 0 --outcome yes --side buy --amount 2`：
  展示精确报价（k·√supply+c 逐份求和），强调 quote 只模拟、不发交易。

**第二段 · 每笔都过 Agent Wallet MFA（核心得分点）**
- **1:55–2:15** `mm init show` / `mm wallet trading-mode get`：特写 **server-wallet +
  guard**；口播「所有写操作都必须过 Agent Wallet 的 signing/policy/MFA，插件里没有私钥」。
- **2:15–2:45** `mm popo faucet`：终端出现 `AWAITING_MFA` → **切到邮箱，点开 MetaMask
  确认链接的完整动作**（这是重点镜头）→ 成功；explorer 打开 mint tx `0xcffa…6ac93`，
  `mm popo vault` 显示 1,000,000 $P。说明这是 EIP-712 签名、热钱包 mint、无需 MON gas。
- **2:45–3:05** `mm popo vault` / `mm popo position 0`：展示钱包金库与持仓（需登录）。
- **3:05–3:50** `mm popo deposit 100`（位置参数）：终端出现 `AWAITING_MFA` → **再切邮箱
  点确认**，给首笔「Trust Monad Testnet」guard policy 警告一个特写 → approve→deposit→
  6909 approve 三笔依次完成；`mm popo vault` 显示金库增加。可用
  `mm wallet requests list` 展示每个请求都要等 owner 批准。
- **3:50–4:35** `mm popo predict buy 0 yes 2`（位置参数）：**又一封邮件 MFA** →
  owner 确认 → 成交；`mm popo position 0` 显示 YES=2，explorer 展示 tx
  `0x14bbadb4…e768`（success），金库 100→61.3275084 $P，与 quote 逐位一致。
- **4:35–5:00** 收尾：并排展示 explorer 上全部 tx + 一句口播「读行情→报价→EIP-712
  领水→存款→买入，全部经 Agent Wallet，每笔 owner 邮件 MFA，无 signing/policy/MFA
  绕过」；打出 repo 与 `skills/popo/SKILL.md` 链接。

> 已实测落袋的真实 tx（可直接录 explorer 兜底，不必重跑）：faucet mint `0xcffa3950…6ac93`、
> ERC-20 approve `0x34526ee1…8942`、deposit 100 `0xce5f260b…2a28`（success）、
> 6909 approve `0xcf4fadca…a421`、buy 2 YES `0x14bbadb4…e768`（success，金库 100→61.3275084 $P）。
> 安全姿态（务必保持后再录）：`mm wallet trading-mode get` = `guard`；policy `allowlist: []`、
> 不含 10143、`rolling_24h: 0` —— 这样每笔必发邮件 MFA。
> 备注：写命令的 `side/market/outcome/amount` 是**位置参数**（flag 形式会报 MISSING_ARG）；
> `mm popo quote --kind hatch --token <id>` 需传 Monad 上有效 Hatch token id，别用 id=0（会 revert）。

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
