# Bounty 录屏统一 Runbook（Monad Metropolis）

> 生成于 2026-10-12。本文件只做“照做即可”的录制与提交指引；服务**当前已在运行**，
> 按约定不主动重启/启动服务，需要你本人操作的步骤已标注 🧑。

| Bounty | 奖金 | 视频 | 后端现状 |
|---|---|---|---|
| MetaMask Agent Wallet Plugin | **$2,500** | **必填 ≤5min** | CLI + 插件已装，guard 严格 MFA，真实成交已验证 |
| Privy | $5,000 | 可选 ≤2min | app 全站 Privy 内嵌钱包 + EIP-712 |
| Envio HyperIndex | $1,000 | 可选 ≤2min | **indexer + Hasura 已在跑，已追到链头** |
| Alchemy | $1,000 credits | 可选 | key 已生效，`/faucet` 面板已上线（5173） |

---

## 0. 当前环境（已确认 running，无需再启动）

- **App dev server（用这个）**：http://localhost:**5173** ← 普通 `vite`，启动晚于 `.env.local`，Alchemy key 已加载。
- http://localhost:**5174** 是 **E2E 模式**（`vite.e2e.config.ts`），**录屏不要用它**。
- **Docker 29.5.3** running；容器 `envio-postgres`（:5433）、`envio-hasura`（:8080, healthy）。
- **Envio indexer**：`envio dev`（pid 97397）已在同步，`chain_id=10143`，start 70016287，
  latest_processed_block **70,442,952** 且持续前进。
- **Alchemy key**：`app/.env.local` 内 `VITE_ALCHEMY_API_KEY`（26 位，已验证 chainId `0x279f`）。
- Agent Wallet：地址 `0xb81fCEe70017317F79C169B3727193a786bFc88D`，trading mode **guard**，
  policy 严格（空 allowlist / 不含链 10143 / rolling_24h=0）→ **每笔写操作都要邮件 MFA**。
  持仓：market 0 YES=2；金库 61.3275084 $P；钱包 999,900 $P。

🧑 **唯一可能要做的服务动作**：若 5173 页面看着是旧的，在浏览器硬刷新（Cmd+Shift+R）；
`.env.local` 的 key 在 03:54 启动前就存在，无需重启。只有当你改了 `.env.local` 才需重启 dev server。

🧑 终端跑 `mm` 网络命令前先设代理（Node v24.19.0）：
```bash
export NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7897 HTTP_PROXY=http://127.0.0.1:7897 ALL_PROXY=http://127.0.0.1:7897
```

---

## 1. MetaMask Agent Wallet 视频（必填，≤5 分钟）— 核心，先录

严格 guard，**每笔都点邮件**，这是要证明的卖点（no bypass of signing/policy/MFA）。
分镜细节见 [`VIDEO-SCRIPT.md`](./VIDEO-SCRIPT.md)。建议节奏：

1. `mm plugins list` → popo installed；`mm popo markets`（**未登录公共读**）；
   `mm popo quote --kind predict --market 0 --outcome yes --side buy --amount 1`。
2. `mm wallet trading-mode get` → **guard**；展示严格 policy（空 allowlist）。
3. 🧑 发起并**逐笔点邮件**（每条 MFA 10 分钟过期；首笔新链邮件里勾 **Trust Monad Testnet**）：
   - 若需再领：`mm popo faucet`（EIP-712，MFA）
   - `mm popo deposit 50`（可能内部 approve + deposit 两条 MFA）
   - `mm popo predict buy 0 no 1`（位置参数；会触发 approve MFA + buy MFA）
4. 每步用 `mm wallet requests list` / `watch <id>` 展示 AWAITING_MFA→approved；
   成交后 `mm popo position 0` / `mm popo vault`，并打开 explorer tx。
5. 强调：全程无 beast、无白名单、无自动放行、插件不碰私钥/token。

> 提交链接（已 push 到 PoPoMeMe/PoPo@main）：
> - 插件：`hackathon/metamask-agent-plugin/`
> - **必填 SKILL.md**：https://github.com/PoPoMeMe/PoPo/blob/main/skills/popo/SKILL.md （已验证 200）

---

## 2. Alchemy 视频（可选，~2 分钟）

🧑 Chrome 打开（用 5173，先连 Privy 并切到 Monad Testnet）：

```
http://localhost:5173/10143/faucet
```

1. 页面底部出现 **「Alchemy Supernode · Monad」** 卡片（只在 10143 + 有 key 时渲染）。
2. 展示 **$P token balance**（来自 `alchemy_getTokenBalances`，应为 999,900 $P）。
3. 展示 **Recent $P transfers**（来自 `alchemy_getAssetTransfers`），能看到 faucet mint
   `0xcffa39500ad667b8…`，每行有 in/out + explorer 链接；点 Refresh。
4. （可选）做一笔 Hatch/prediction 交易，说明交易经 Alchemy-first RPC 提交，再指 explorer。
5. 代码佐证：`app/src/lib/alchemy.ts`（env 门控 + public/dRPC fallback）、
   `app/src/pages/faucet.tsx` 的 `AlchemyMonadPanel`、`app/src/main.tsx`。

生产：🧑 在 Vercel 设置 `VITE_ALCHEMY_API_KEY` 并重新构建（Vite 构建期内联）。

---

## 3. Envio 视频（可选，~2 分钟）

Hasura/GraphQL 已在跑，无需再 `npm run dev`。

🧑 浏览器打开 Hasura：

```
http://localhost:8080
```

1. Console → API/GraphiQL（无 admin secret）。
2. 跑下面查询，展示实时数据（61 coins / 24 traders / 703 hatch trades / 7 markets，链头前进）：

```graphql
query Overview {
  Memecoin(limit: 500) { id }
  Trader(limit: 1000) { id }
  HatchTrade(limit: 1000) { id }
  PredictionMarket { id digest yesSupply noSupply tradeCount }
  chain_metadata { chain_id start_block latest_processed_block }
}
```

3. 证明端到端：查最新 PredictionTrade，能看到 **MM 插件那笔**
   `0x14bbadb4…`（block 70202021，buy yes 2，quote 38672491599734362682）：

```graphql
query CrossBounty {
  PredictionTrade(limit: 5, order_by: { blockNumber: desc }) {
    side outcome shares quoteP blockNumber transactionHash
  }
}
```

4. 代码佐证：`hackathon/envio-indexer/`（`config.yaml`、`schema.graphql`、
   `src/EventHandlers/Hatch.ts`、`PredictionMarket.ts`）。

---

## 4. Privy 视频（可选，≤2 分钟）

在 http://localhost:5173 用普通（非 MM）演示，突出**业务签名只走 Privy 内嵌钱包**：
登录 → `/10143/faucet` 领 $P（EIP-712 PoPoAuth 静默签名）→ Deposit → Hatch/Prediction 交易
（Privy 交易确认弹窗）。要点见 `bounty-submissions/privy.md`。外部钱包仅用于充值，不做业务签名。

---

## 5. 录屏注意

- macOS 屏幕录制权限：🧑 首次录制在「系统设置 → 隐私与安全性 → 屏幕录制」给录制器授权。
- Demo 录制固定 1440×900，Chrome viewport 钉死，避免灰边（历史坑）。
- 终端字号调大；每笔 MFA 之间动作慢一点，给邮件和链确认留时间。
- MM 视频是**唯一必填**；其它三个可选，按精力补。

## 6. 提交前 checklist（🧑 最终 Submit 由你点）

- [ ] MM 视频上传（YouTube unlisted / Loom），≤5min，体现每笔邮件 MFA + guard + explorer。
- [ ] MM 表单：repo + **SKILL.md 链接** + 视频，答案用 `FORM-ANSWERS.md`。
- [ ] Alchemy：Vercel 设 `VITE_ALCHEMY_API_KEY` 重新构建（如要线上演示）。
- [ ] Envio / Privy / Alchemy 可选视频上传并填各自表单。
- [ ] 公开仓库确认无密钥（已扫；`.env.local` 不入库）。
