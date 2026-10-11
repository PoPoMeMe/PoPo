# Monad Metropolis 黑客松 · Sponsor Bounty 对照与待办规划

> 日期：2026-10-11（规划稿，仅规划，未执行任何 bounty 开发）
> 主赛道：**Track 01 — Onchain Finance & Trading**（$30,000，前 3 名各 $10,000）
> 提交截止：**2026-10-14 03:59 UTC（约 2.9 天，极紧）**
> 数据来源：`GET https://hackathon.monad.xyz/api/v1/catalog`（登录态抓取，2026-10-11）
> 配套文档：`docs/2026-12-08-monad-testnet-deployment.md`（Monad testnet 部署事实源）

---

## 0. TL;DR（先看结论）

- 我们**已经有 Monad Testnet（10143）上完整运行的 PoPoApp Diamond（19 facets）**，
  HatchSwap（发币 / 曲线买卖 / 毕业迁移 / v4 风格 PoolManager / ERC-6909 金库）合约
  全套已部署并链上验证，前端已把 `monadTestnet` 加进可选网络，50 个 Higgsfield demo
  电影币已上链。**主赛道"deployed on Monad"的硬门槛已经满足一大半。**
- Monad 上目前是 **Hatch-only**：预测市场（MarketFacet 合约虽在钻石内但前端未开放 /
  未建市场）、PPT/USDC/airdrop、内容 episodes、billing/referral 索引器等链下层
  **尚未在 Monad 上接通**。
- 21 个 bounty 中，**6 个 Finance 专属 + 11 个 All-tracks 可叠加**（另有 4 个绑其他
  track，本文不纳入）。按"与现有 PoPo.meme 产品的复用度 ÷ 剩余工作量"排序：
  - **P0 必拿（几乎零额外开发，主要是录视频/写说明）**：Privy、Best Community Team。
  - **P1 高性价比（1–2 天工程量，强复用现有能力）**：Envio（索引器）、
    MetaMask Agent Wallet Plugin（交易策略插件）、Perpl Analytics/Risk Tool、
    Alchemy（RPC/Subgraph 替换）、Nansen（智能钱分析）。
  - **P2 可选冲刺（需要接外部协议，1–3 天）**：Kuru（New Assets，把我们的币/预测市场
    接到 Kuru 订单簿）、Perpl Trading Bot、Aurora Intents（跨链入金）、
    Chainlink CRE（编排层）、Mera（passkey 账户层）。
  - **P3 不建议（偏离产品 / 账号层冲突 / 时间不够）**：Agora（要 Mera+AUSD+Perpl
    全家桶且要移动 App）、Kuru Consumer Trading App（要拉新数据）、Dynamic（与
    Privy 二选一，账号层冲突）、KIMI（要发博客 + 接 LLM）、Mera 全账户层（替换 Privy，
    风险大）。
- **时间现实**：只剩 ~3 天。建议主攻 **主赛道本身 + P0 全部 + P1 中 2~3 个**，
  不要贪多。每个 bounty 都要单独填提交表单字段（见下文清单），且大多数要一条
  ≤2 分钟 demo 视频——**视频生产本身要排期**。

---

## 1. 主赛道硬性交付物（所有 bounty 的共同前提）

来自 catalog `tracks[onchain-finance].deliverables`：

| # | 交付物 | 现状 | 待办 |
|---|---|---|---|
| 1 | Project Logo/Graphic（JPG/PNG/WEBP，≤3MB） | 有 PoPo.meme logo | 导出符合尺寸/大小版本 |
| 2 | **Public GitHub Repo**（需对 `metropolis@hackathon.monad.xyz` 可访问） | 当前是私有 pp-all | 建对外公开精简 repo 或加该邮箱为协作者；沿用 `hackathon/` judge pack |
| 3 | **Technical Demo Video ≤3min**（YouTube/Loom/Vimeo，必须是 live 产品，不要幻灯片/代码走读） | 有 DEMO-SCRIPT 但无成品视频 | 在 **Monad testnet** 上实录：发币→买卖→毕业→AMM→（可选）episode 回购 |
| 4 | **Pitch Video ≤2min**（团队、问题、为什么做） | 无 | 录团队+愿景口播 |
| 5 | **Live Product Link，部署在 Monad 主网或测试网**，附访问说明 + judge 测试账号 | 前端可选 Monad testnet，但默认网络是 Arc；faucet edge 待重部署 | 把演示环境默认链切到 Monad testnet；准备 judge 测试账号/领水入口；部署文档 |
| 6 | Product Ad ≤30s（可选，不计评审，仅赛后宣发） | 无 | 可选 |

### 主赛道评审权重（catalog `criteria`）
1. **Founder & Market Readiness 25%** — 具体首个用户是谁（不是泛泛"crypto traders"）。
2. **Technical Execution 20%** — 端到端真实链上结算/定价/撮合，不是静态数据套 UI。
3. **Design & Craft 20%** — 清晰价格、清晰风险披露、trader 敢把钱放进来的界面。
4. **Traction & Path Forward 20%** — 真实使用/测试证据（哪怕模拟量/几笔测试交易）+ 明确下一步。
5. **Originality & Track Insight 15%** — 是否是快结算才能存在的新资产原语/市场结构，而非更快的 DeFi 仿盘。

> ⚠️ 赛道描述里特别点名的方向：**compute 市场、代币化股票（要让股票"做事"）、
> 非传统标的期权（社交注意力 / 创作者增长 / 事件结果）、收益剥离、亚秒终局交易界面、
> 移动优先、嵌入式交易、TWAP/网格/限价等新订单类型**。
> 我们的叙事抓手：**创作者 IP 币 + 集可成 v4 风格 CLMM + 每日回购销毁 + 预测市场**
> 属于"非传统标的（创作者增长/事件结果）+ 全新市场结构"，正好命中 originality。
> 但要在 pitch 里**显式对标这几条**，不能只讲 meme 发币。

---

## 2. Finance 专属 bounty（6 个，奖金合计 ~$25.5k）

### 2.1 Agora — Best Mobile Trading App on Monad　$10,000　【P3 不建议】
- **要求**：移动 App，**同时**集成 ① Mera passkey 认证 ② 持有/展示 AUSD 稳定币余额
  ③ 通过 **Perpl** 下单。三个集成要有创意地组合。
- **交付**：可运行 demo（passkey 登录→看 AUSD 余额→在 Perpl 下至少一单）；≤2min 视频，PWA 可接受。
- **表单字段**：核心功能描述（强调三集成）；demo video URL。
- **差距**：Mera 我们用的是 Privy（账号层不同）；无 AUSD；无 Perpl；需要移动/PWA。
  = 三套全新集成 + 移动端，3 天内不现实。
- **结论**：**放弃**（除非决定整体转向 Mera+Perpl，不推荐）。

### 2.2 Kuru — Build the Next Consumer Trading App on Kuru　$5,000　【P3】
- **要求**：聚焦的现货交易产品，交易路由到 Kuru 链上订单簿；要说清目标用户、需求证据、获客/留存策略、赛后路线图。
- **表单字段（4 段长文本）**：目标用户群；需求证据/用户数据；赛后路线图；获客留存策略。
- **差距**：未接 Kuru；且该 bounty 重心是"带来新 trader/社区"的 GTM，而非技术。我们 Hatch 用的是自有曲线+AMM，不是 Kuru 订单簿。
- **结论**：技术可做但 GTM 材料要求重，3 天难。**降级**。若要做，与 2.3 二选一。

### 2.3 Kuru — Bring New Assets and Markets to Kuru　$5,000　【P2 候选】
- **要求**：在 Kuru 现货订单簿上开一类**新资产市场**，且要解决交易界面之外的东西
  （发行/赎回/结算机制、合规、流动性、用户引导）。
- **明确点名的方向**：**事件/结果合约（预测市场）**、RWA、忠诚度积分/应用内资产、
  收入/版税/现金流挂钩资产、游戏与创作者经济。
- **表单字段（3 段长文本）**：新资产类别 + 需求证据 + 发行/赎回/结算可信度；
  上链的法律/运营方案 + 流动性与初始市场形成策略；赛后路线图。
- **匹配点（高）**：我们**同时有创作者 IP 币（"创作者经济/现金流挂钩资产"）
  和预测市场（"事件结果合约"）**——几乎是为这个 bounty 量身定做的资产类别。
- **差距/待办（若做）**：
  1. 接 Kuru testnet SDK，把至少一种我们的资产（一个电影币 或 一个预测市场 YES/NO）
     挂到 Kuru 订单簿挂牌/路由（`https://kuru-testnet-docs.mintlify.site/`）。
  2. 准备发行/赎回/结算说明（我们已有：曲线发行、毕业迁移、预测市场 pro-rata 结算）。
  3. 写流动性初始形成策略（我们有 Vault/做市预留，可直接讲）。
- **结论**：**P2，首选外部协议 bounty**（资产叙事最贴）。~1.5–2 天。

### 2.4 Perpl — Best Analytics / Risk Tool　$3,000（3 名各 $1,000）　【P1】
- **要求**：实时分析/风控/组合智能 dashboard，聚焦 Perpl，**协议级 + 钱包级双视图**。
  暗色现代 UI、实时数据、高层概览↔钱包下钻无缝切换、信号优先不堆砌。
- **协议级必备**：24h/7d/30d/all-time 量、OI、TVL、费用/收入、活跃用户；时序图；
  充提/净流入；按市场/资产 + 多空倾斜；清算与资金费率。
- **钱包级必备**：地址搜索→钱包画像；持仓（规模/开仓价/杠杆/未实现盈亏/清算价）；
  历史成交+已实现盈亏；绩效（胜率/利润因子/最大回撤/连胜/持仓时长/最佳市场）；
  收藏/并排对比；组合/保证金总览；可选 AI 行为洞察。
- **交付**：dashboard URL + ≤2min demo。
- **匹配点**：我们有现成的 dashboard/索引器/图表前端基建（billing、holders、trades、
  price-history），React+viem+getLogs indexer 都现成。
- **差距/待办**：
  1. 数据源换成 Perpl（`docs.perpl.xyz/resources/for-developers`、
     `github.com/PerplFoundation/api-docs`、`dex-sdk`）。
  2. 新建一个独立暗色 dashboard 页（协议级 + 钱包级）。
  3. 参照 stats.nado.xyz / hyperscreener / lighterdash。
- **结论**：**P1**。纯读+可视化，不动我们核心合约，~1.5 天可出 demo。可独立部署一个
  子站，不影响主产品。

### 2.5 Perpl — Best use of Perpl's API（交易机器人/自动化）　$5,000（前 2 各 $2,500）　【P2】
- **要求**：生产可用交易 bot/自动化，真实链上活动；看执行可靠性、风控、能否盈利。
- **想法**：做市 bot（适配 Perpl 低 gas CLOB）、TG bot、资金费率套利/网格/跨所统计套利、
  社交跟单/排行榜/PvP、结构化产品（备兑看涨等）。
- **交付**：≤2min 视频 + bot/系统链接（都要真实链上活动）。
- **差距**：要真实下单策略 + 链上成交记录。
- **结论**：**P2**。若做，最小可行 = 一个**网格/做市 bot**跑测试网留下真实成交，
  或一个"**创作者币交易信号 → 自动跟单**"的社交交易（更贴我们产品故事）。~1.5–2 天。

### 2.6 MetaMask — Best Agent Wallet Plugin　$2,500　【P1，强推】
- **要求**：给 MetaMask Agent Wallet 写一个**可安装插件**，用 `mm` 命令获得交易超能力；
  所有交易必须走 Agent Wallet，不得绕过签名/policy/MFA；要含 `skills/<name>/SKILL.md`
  （让 agent 知道何时/如何用）+ README + demo（live 或 ≤5min）。
- **明确点名想法**：跟单（带规模/风控/流出上限）、**预测市场策略（自动建仓/平仓、赔率套利、
  事件对冲、自动赎回）**、组合再平衡、DCA/网格/动量/资金费率套利/移动止盈/TWAP、
  A2A 交易（x402 + ERC-8004）、新增交易场所。
- **资源**：`docs.metamask.io/agent-wallet/plugins/`、官方 plugin template/examples
  （需 Agent Wallet ≥ v6.2.0）。
- **表单字段**：trader 能力描述；**SKILL.md 链接**；≤5min demo 视频。
- **匹配点（极高）**：我们有**预测市场 + 创作者币 AMM**，"预测市场自动策略 / 创作者币
  TWAP·网格 / 跟单"就是现成插件题材；而且插件本质是调我们自己的合约，**不依赖把产品
  迁移到别的协议**。
- **差距/待办**：
  1. 基于 `agent-wallet-plugin-template` 起一个插件项目。
  2. 实现 2~3 个 trader 能力（建议：`pprediction-auto-hedge`、`ptoken-grid/twap`、
     `copy-trader` 带风控上限），交易目标指向 Monad testnet 上的 PoPoApp。
  3. 写 `skills/<name>/SKILL.md`（声明触发条件/用法）。
- **结论**：**P1，强烈推荐**。题材贴、独立仓库、评审维度清晰，~1–1.5 天。

---

## 3. All-tracks bounty（11 个，奖金合计 ~$43k，可与主赛道叠加）

### 3.1 Privy — "Privy!"　$5,000　【P0 必拿】
- **要求（关键）**：**必须把 Privy 用到"认证之外"**；只用来登录/认证 **不合格**。
  demo 要清楚展示 Privy 驱动的功能；多 Privy 特性有加分。
- **表单字段**：如何有意义地集成 Privy（文本）；可选 ≤2min 视频。
- **我们的现状（远超门槛）**：
  - 所有业务签名/交易强制走 Privy 内嵌钱包（外部钱包仅充值）——见记忆 feedback。
  - `useSignTypedData` + `uiOptions.showWalletUIs:false` 做 **EIP-712 静默签名**，
    供 Supabase Edge 写层验签；`sendTransaction` 提交所有合约交互。
  - 3.40.0 交易弹窗 hooks 崩溃 + 跳过成功页已用 `pnpm patch` 修复。
  - Privy 覆盖：发币/买卖/毕业/预测市场/episode/领赏等 19 个文件。
- **待办**：只需**录一条 ≤2min 视频 + 写说明**，专门展示"登录之外"的 Privy 能力：
  静默 EIP-712 授权交易、内嵌钱包发起 AMM/预测市场交易、（可选）gas/跨链等。
  **零额外开发**，只需把现有功能讲清楚。**最高优先级，最先锁定。**

### 3.2 Monad Foundation — Best Community Team Project　$5,000　【P0，需确认】
- **要求**：团队代表一个"已 onboarded 的社区支持者"，在 profile 的 community 下拉里
  选得到；标准提交（公开 repo + demo video + 部署在 Monad）。
- **表单字段**：Which community does your team represent?
- **待办/阻塞**：**先去提交 portal 的 profile 页确认 community 下拉里有没有我们属于的
  社区**（团队/学校/DAO）。若有 → 勾上即可，几乎白拿；若没有 → 不可申报。
- **结论**：**P0，但先验证资格（5 分钟的事，今天就做）**。

### 3.3 Envio — Best Use of Envio　$1,000　【P1】
- **要求**：真正用 **HyperIndex / HyperSync / HyperRPC** 驱动一个核心功能，不是装了不用。
  深度加分：多链索引、非平凡 schema、派生/聚合实体、HyperSync 分析。
- **交付**：可运行 indexer/data pipeline（部署 Envio Cloud 或自建），公开 repo 含
  `config.yaml`/`schema.graphql`/event handlers（或 HyperSync client）；有消费端
  （前端/dashboard/bot/API）；短 demo 展示端到端数据流。
- **匹配点**：我们现在靠自研 getLogs 分块索引（Monad 限 100 块）+ Supabase 缓存，
  正好可把 **trades/holders/price-history/referral/billing** 迁移/复制一套到 Envio，
  支撑 Explore 排行、holders、价格图、推荐索引。
- **差距/待办**：
  1. 建 Envio HyperIndex 项目，索引 PoPoApp 事件（TokenCreated / Swap /
     Graduated / MarketTrade 等），schema 做派生聚合（K 线、holders、成交量榜）。
  2. 前端一个核心列表/图表切到 Envio GraphQL。
  3. 申请免费 token（`envio.dev/app/api-tokens`），部署 Cloud。
- **结论**：**P1**。和 2.4 Perpl dashboard 共用"索引+dashboard"能力，
  但 Envio 是索引**我们自己的合约**，更贴产品。~1–1.5 天。二选一或都做。

### 3.4 Alchemy — Best Projects using Alchemy　$1,000 credits　【P1，低成本】
- **要求**：部署在 Monad 且有意义地用至少一个 Alchemy 服务/工具（任何支持 Monad 的）。
- **表单字段**：集成说明；可选视频。
- **待办**：申请 Alchemy Monad RPC/API key，把前端或 Edge 的 **Monad RPC / NFT/Token
  API / Subgraph** 中至少一个真接到 Alchemy（我们有自定义 RPC 设置 + 多链注册表，
  切换成本低）。**成本极低，顺手做**。注意要展示"驱动了真实功能"。
- **结论**：**P1（低成本顺手）**。

### 3.5 Nansen AI — Best use of Nansen　$5,000（1st $2k / 2nd $1.5k / 3rd $1k / 荣誉 $500）【P1/P2】
- **要求**：用 Nansen API/MCP/CLI 造一个**产品体验**，不是简单罗列原始数据；至少集成
  一个端点/MCP 工具/CLI，且作为核心功能。
- **想法**：交易/组合/研报工具、解读链上情报的 AI agent、聪明钱/代币流可视化、
  实时监控告警、发现机会/叙事/市场参与者。
- **匹配点**：可在我们的**币详情页 / 预测市场 / 跟单**里接"聪明钱持仓、资金流、
  smart-money 告警"，或给"创作者币"加 Nansen 钱包标签/持仓画像。
- **差距/待办**：需 Nansen API key（可能有 Monad 覆盖限制，先查 `docs.nansen.ai`）；
  在详情页加一个 Nansen 驱动模块。
- **结论**：**P1/P2**，取决于 Monad 数据覆盖与 key 获取。~1 天。先验证 API 可用性再投入。

### 3.6 Aurora Intents — Bring Any-Chain Liquidity to Monad　$5,000（$2.5k/$1.5k/$1k）【P2】
- **要求**：把 Aurora Intents（NEAR Intents：Swap API / Intents Deposits / Intents
  Connect）接进 Monad App，做任意链入金/兑换/入金即执行；要 live 真实跨链流，不能 mock。
- **加分**：多链源覆盖、Intents Connect 合约级可组合、Confidential Intents。
- **匹配点**：解决"外部用户没有 MON/$P 无法体验"的痛点——**任意链资产→一键换成
  Monad 上的 $P 并直接买创作者币/入预测市场**（deposit & execute）。和我们"外部钱包
  仅充值"的产品定位天然契合。
- **差距/待办**：接 Intents Connect/Deposits，做一条真实跨链入金→买入流；录 live 视频。
- **结论**：**P2**。叙事好（跨链入金是真痛点）但集成+真实跨链联调在 3 天内有风险，
  排在 P1 之后。~1.5–2 天。

### 3.7 Chainlink — Best workflow with CRE　$3,000　【P2/P3】
- **要求**：用 Chainlink Runtime Environment（CRE）建/模拟/部署一个 **Workflow 作为编排
  层**；至少把一条链与外部 API/系统/数据源/LLM/AI agent 连起来；CRE CLI 模拟成功或
  CRE network 上线部署；**必须交 ≤2min 视频**。
- **匹配点**：可编排"每日回购销毁触发 / 预测市场结果结算（接外部数据源/LLM）/
  episode 发布后的自动动作"。
- **差距**：全新编排框架学习成本；我们每日回购目前是无许可路由手动/定时触发，
  可包装成 CRE workflow（外部数据→链上触发）。
- **结论**：**P2/P3**。若想做，最稳是把"每日回购"或"预测市场结果喂送"做成 CRE
  workflow + CLI 模拟录屏（不一定要主网部署）。~1.5–2 天。

### 3.8 Monad Foundation — Best Mera-Powered UX on Monad　$2,500　【P3】
- **要求**：Mera 作为**整个账户层**——无助记词、无插件、无托管后端；一次 passkey
  ceremony 注册；Mera signing sessions 做 prompt-free 签名；必须过"**无状态测试**"
  （评委清 localStorage/换新设备，身份仅靠 passkey 完全重建）。
- **冲突**：我们账户层是 **Privy**。整个替换成 Mera = 动账号根基，3 天内风险极高。
- **结论**：**P3，不建议在主产品上做**。若要，单独做一个 Mera-only 的小 demo 分支，
  但会稀释主线。

### 3.9 Monad Foundation — Mera: One Passkey, Many Keys（PRF 非钱包用途）　$2,500　【P3】
- **要求**：Mera PRF 确定性密钥材料做**非钱包**的创意用途（加密应用状态/E2E 加密消息、
  AI agent memory 加密、每应用隔离身份、不可链接隐私身份、passkey 派生 SSH/密钥库等）；
  要过跨设备复现测试。
- **匹配点**：可做"**passkey 加密的创作者私信 / 粉丝社群 E2E 消息**"或"加密的 AI 助手
  记忆"。但与我们核心交易产品弱相关。
- **结论**：**P3**。创意型、独立 demo，非主线。

### 3.10 Dynamic — Best Use of Dynamic　$5,000　【P3】
- **要求**：集成 Dynamic SDK 做 auth/内嵌钱包/agent 钱包/签名，部署可 demo。
- **冲突**：与 Privy 直接竞争的**账号层**，二选一；我们已深度绑定 Privy（含补丁、
  EIP-712 静默签名、强制内嵌钱包策略）。**同时挂两套钱包会破坏产品一致性与记忆中的
  强约束**。
- **结论**：**P3，放弃**（与 Privy bounty 互斥，且 Privy 我们零成本）。

### 3.11 Kimi — Best Builds Powered by KIMI　$3,000 credits（10 队平分）【P3】
- **要求**：KIMI（月之暗面）真正驱动一个核心功能（不是挂个聊天框）；Monad 上可 demo；
  **额外必须发布一篇文章/博客**讲怎么用 KIMI、带来什么价值。
- **匹配点**：可做"AI 分析创作者币/预测市场、AI agent 交易、多语言 dApp"。
  我们已有 AI studio（`studio.tsx` / ai-studio-events-playbook），但接的是别的模型。
- **差距**：接 KIMI API + 写/发博客 + 真驱动核心功能。
- **结论**：**P3**。若已有 KIMI key 且想低成本铺一个"AI 驱动"故事，可当顺手项，
  但博客是硬交付，注意排期。

> 备注：catalog 共 21 个 bounty，另有 4 个绑其他主 track（Agora 跨境支付→Consumer
> Payments；Cleanverse 身份→Trust/AI；Tencent Hunyuan、Alibaba Qwen→Trust/AI），
> 规则上只能与对应 track 叠加，本文不纳入。

---

## 4. 产品现状对照（Monad 维度）

| 能力 | 合约（Monad testnet 10143） | 前端 | 链下/Edge | 可用于 bounty |
|---|---|---|---|---|
| 发币（许可、创建费、metadata） | ✅ 已部署 | ✅ 已开放 | hatch_tokens 已缓存 50 币 | 主赛道 / Kuru / Agent Plugin |
| xy=k 曲线买卖 + 平台/创作者费 + 滑点 | ✅ | ✅ | 价格/成交 getLogs（100 块分块） | 主赛道 / Envio |
| 毕业→v4 风格 CLMM 一键迁移 | ✅ | ✅（默认 Arc，Monad 可切） | — | 主赛道（核心卖点） |
| PoolManager hooks / 市值分层创作者费 | ✅ | ✅ | — | 主赛道 / Kuru |
| ERC-6909 单金库多资产结算 | ✅ | ✅ | — | 主赛道 |
| 每日无许可回购销毁（Router + 滑点保护） | ✅ Router 已部署 | 待确认 Monad UI 入口 | — | 主赛道 / Chainlink CRE |
| 两级推荐 + 金色层级 | ✅（facet 在） | 通用 | referral-indexer edge **待重部署** | Envio / Aurora |
| 付费视频 episode + 收入分账 | ✅（facet 在） | studio 通用，Monad 未验证 | metadata/Storage 未在 Monad 接通 | 主赛道（可选演示） |
| **预测市场（YES/NO ERC1155、曲线、结算）** | ✅ MarketFacet 在钻石内 | ⚠️ 前端存在但 **Monad 上未建市场/未开放** | 申请/审核 edge 未按 Monad 配 | **Kuru New Assets / Agent Plugin（关键待打通）** |
| PPT 平台币 / USDC / airdrop | ✅ PPT/PFT 已部署；无 USDC | ❌ Monad 未接 | — | — |
| Faucet（$P + gas） | ✅ 热钱包已授 ROLE_1 + 0.2 MON | `/faucet` 通用 | **testnet-faucet-claim edge 待重部署**（Supabase token 401） | 主赛道 judge 领水 |
| Billing / referral / LP 索引器 | — | — | edge 已加 10143 配置但**待重部署** | Envio 迁移目标 |
| 账号层 | Privy 内嵌钱包（强制）+ EIP-712 静默签名 | ✅ 深度 | Edge ecrecover 验签 | **Privy bounty（P0）** |
| 多链路由 | 静态 chains-registry（Edge + 前端镜像） | ✅ | 待重部署 | Alchemy |
| 主网（chainId 143） | ❌ 未部署（仅 testnet） | network 占位 | — | 比赛接受 testnet，可不主网 |

> **状态更新（见 `docs/2026-12-08-monad-testnet-deployment.md`）**：
> faucet / referral-indexer / hatch-lp-indexer 等 edge 已带 10143 注册表重部署并冒烟通过；
> 50 个种子电影币（tokenId 2–51）已上链、前端 Explore 可列出；第一个真实预测市场已开通并完成
> 买/卖/金库结算端到端冒烟。前端默认网络仍为 Arc，评委演示时从网络选择器切到 Monad Testnet。

---

## 5. 建议的待办任务清单（按 3 天倒排）

> 原则：先保主赛道交付门槛，再锁 P0 零成本 bounty，P1 按"索引能力"和"插件能力"
> 两条复用线各取 1~2 个。**不启动服务**（按团队约定，服务由用户手动起）。

### Day 1（今天）— 解锁环境 + 锁 P0
- [ ] **T0 资格确认（5min）**：登录提交 portal，profile 里查 community 下拉
  → 定 Best Community Team（P0）能否申报。
- [ ] **T1 选定 bounty 集合**（本规划评审拍板）：建议
  主赛道 + Privy + Community(若有资格) + Agent Wallet Plugin + Envio + Perpl Analytics。
- [ ] **T2 解锁 Supabase 部署**：`supabase login` 刷新 token → 重部署 edge
  （testnet-faucet-claim / referral-indexer / hatch-lp-indexer / billing-sync；
  新函数 `--no-verify-jwt`）。**这是演示链路（领水/索引/缓存）的前置。**
- [ ] **T3 建 Monad 演示构建**：把演示环境默认链切到 `monadTestnet`（或独立演示 URL
  `?chain=monadTestnet` 默认化），准备 judge 测试账号 + 领水说明。
- [ ] **T4 公开 repo**：建对外公开精简 repo（沿用 `hackathon/` judge pack +
  必要源码），把 `metropolis@hackathon.monad.xyz` 加为协作者。
- [ ] **T5 Privy bounty 材料（P0）**：写说明文本 + 规划 ≤2min 视频脚本
  （静默 EIP-712、内嵌钱包交易）。

### Day 2 — 打通主赛道完整演示链 + 一个高价值插件
- [ ] **T6 Monad 上端到端冒烟**：领水→发币/买卖→**毕业**→AMM 交易→hook 创作者费，
  全程实链截图/录屏；修 Monad 特有 bug（getLogs 100 块、写路径填充缓存）。
- [x] **T7（可选但加分）打通 Monad 预测市场**：✅ 2026-10-11 已在 Monad testnet
  开通首个市场（digest `0x7fd5…3e52`，YES/NO id 52/53，enabled），真实交易冒烟通过
  （deposit→买 YES/NO→卖回，价格曲线正确），链下标题元数据已写入 Supabase。
  详见 `docs/2026-12-08-monad-testnet-deployment.md` §3b。**剩：端到端走一遍
  endMarket→finalize→claimReward/claimFailedToken 结算（demo 录像时）。**
- [x] **T8 MetaMask Agent Wallet Plugin（P1）**：✅ 已实现于
  `hackathon/metamask-agent-plugin/`（npm 包 `mm-plugin-popo`，8 个 `mm popo …`
  命令：markets/market/quote/vault/position/deposit/predict/trade）。所有写交易走
  `ctx.walletExecutor`（wallet-submit，BYOK/server 均走 Agent Wallet MFA+policy），读用
  `publicClient(10143)`；Hatch 用链上 preview+滑点保护，预测用与链上一致的 k·√supply+c
  精确求和自动备付。`npm run build`（tsc+oclif manifest）通过，曲线值与链上完全一致。
  提交素材：`hackathon/bounty-submissions/metamask-agent-plugin.md`。
  **剩：评审机装 `mm` beta 后 `mm plugins install file:$PWD` 实测 + 录屏（本机未装 mm）。**
- [ ] **T9 技术 Demo 视频（≤3min）**：按 `hackathon/DEMO-SCRIPT.md` 在 Monad 实录。

### Day 3 — 一个数据向 bounty + 全部材料收口
- [x] **T10 Envio（P1）**：✅ 已实现于 `hackathon/envio-indexer/`（HyperIndex v2，项目名
  `popomonad`）。Hatch/PredictionMarket 两个逻辑合约共用钻石地址，索引 8 个交易事件 →
  7 个分析实体（Trader/Memecoin/MemecoinHolder/HatchTrade/PredictionMarket/
  PredictionPosition/PredictionTrade），start_block=70016287，`envio codegen` + `tsc
  --noEmit` 均通过。提交素材：`hackathon/bounty-submissions/envio.md`。
  **剩：用户起 Postgres（Docker）后 `npm run dev` 实跑 + GraphQL 截图/录屏。**
- [ ] Perpl Analytics（P1，备选，Envio 完成后视时间再做）：独立暗色 dashboard（协议级+钱包级）。
- [x] **T11 Alchemy（P1 $1k credits）**：✅ 代码已完成且 env 门控（`app/src/lib/alchemy.ts` +
  `app/src/hooks/use-alchemy-monad.ts`，`main.tsx` 接入）。两项真实服务：① Alchemy Supernode
  作为 Monad 首选 JSON-RPC（viem 读 + Privy embedded 交易），公共 RPC/dRPC 自动降级；② Enhanced
  API（`alchemy_getTokenBalances` / `alchemy_getAssetTransfers`）读 $P 余额与转账历史。
  **剩：用户到 https://www.alchemy.com/monad 申请免费 key → 设 `VITE_ALCHEMY_API_KEY` →
  重新构建 → 录短视频。** 提交文案：`hackathon/bounty-submissions/alchemy.md`。
- [ ] **T12 Nansen（若 key/Monad 覆盖验证通过）**：详情页加 smart-money/资金流模块。
- [ ] **T13 视频批量生产**：Pitch ≤2min + 各 bounty ≤2min（Privy / Agent Plugin /
  Envio / Alchemy…）+ 可选 30s Ad。**统一排期，集中录制。**
- [ ] **T14 提交表单逐项填写**：按下文 §6 字段清单，把每个勾选 bounty 的文本/URL 补齐；
  上传 logo；填 live link + judge 账号。
- [ ] **T15 缓冲**：留给真实跨链（Aurora）/CRE 等 P2 项——只有 Day2 提前完成才启动，
  否则不碰。

### 明确不做（本窗口）
Agora 移动交易 App、Kuru Consumer Trading App、Dynamic、Mera 两个（全账户层/PRF）、
KIMI（除非决定要那条 AI 线并接受博客交付）。

---

## 6. 提交表单字段清单（勾选 bounty 后 portal 会逐题要求）

| Bounty | 必填字段（type） |
|---|---|
| Community Team | Which community（community 下拉，必须在名单内） |
| Privy | 如何有意义集成（text）；demo video（url，可选但强烈建议） |
| Agent Wallet Plugin | trader 能力（text）；**SKILL.md 链接（url）**；demo ≤5min（text 里放视频） |
| Envio | 如何驱动真实数据功能（text）；demo video（url，可选） |
| Alchemy | 集成了哪些 Alchemy 服务（text）；demo video（url，可选） |
| Nansen | 集成了哪些 endpoint/MCP/CLI（text）；demo（url，可选） |
| Kuru New Assets | 新资产类别+需求+发行/赎回/结算（text）；法律/运营+流动性策略（text）；赛后路线图（text） |
| Perpl Analytics | dashboard URL（url）；demo video（url） |
| Perpl Bot | demo video（url）；bot/系统 URL（url）—— 都要真实链上活动 |
| Aurora | 集成哪个 Intents 产品（text）；跨链流 demo video（url，可选） |
| Chainlink CRE | 如何把 CRE 用作编排层（text）；**demo video（url，必填）** |
| Agora | 核心功能（text，强调 Mera+AUSD+Perpl）；demo video（url，PWA 可） |
| Dynamic | 集成说明（text）；demo（url，可选） |
| KIMI | **已发布文章 URL（url，必填）** |
| Mera UX | Mera 作为全账户层说明（text）；demo（url，可选，需过无状态测试） |
| Mera PRF | 非账户用途说明（text）；demo（url，可选，需过跨设备测试） |

---

## 7. 风险与注意

1. **时间风险（最高）**：~3 天，视频 + 表单 + 多 bounty 联调很容易挤爆。严守
   "主赛道 + P0 + P1×2~3"，P2 仅在有余力时上。
2. **Supabase token 401**：链下演示（faucet/索引/缓存）不解锁，demo 与多个 bounty
   都会瘸腿。Day1 必须解决。
3. **默认链是 Arc**：评委打开若不在 Monad，会直接判定不符"deployed on Monad"。
   需要 Monad 默认的演示构建与清晰访问说明。
4. **预测市场在 Monad 未开通**：Agent Plugin / Kuru New Assets 都吃这个叙事，
   要做先补市场（T7）。
5. **账号层一致性**：Privy 与 Dynamic/Mera 互斥，不要在主产品混用，避免破坏
   "所有业务签名走 Privy 内嵌钱包"的既有约束。
6. **bounty 叠加规则**：All-tracks 可与主赛道叠加；其他 track 专属 bounty 不能与
   Track01 组合（Agora 跨境支付 / Cleanverse / Hunyuan / Qwen 已排除）。
7. **真实成交证据**：Perpl Bot、Aurora 都要求真实链上/跨链活动，mock 不合格；
   测试网也要留下真实交易 hash，预留联调时间。
8. 所有新 edge 部署带 `--no-verify-jwt`（自定义 session token 非标准 JWT，函数内自鉴权）。
