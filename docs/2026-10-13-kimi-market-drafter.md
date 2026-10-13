# KIMI（Moonshot AI）集成说明 — AI 预测市场草拟器

日期：2026-10-13
状态：Edge Function 已上线并端到端验证通过；前端已本地提交（`app@38e0929`），随下一次 release 发布到生产。

## 1. 目标与 bounty 对齐

KIMI bounty（Best Builds Powered by KIMI）要求：

1. KIMI **真正驱动一个核心功能**（不是挂聊天框）；
2. 在 **Monad 上可 demo**；
3. 额外发布一篇文章讲怎么用 KIMI、带来什么价值。

我们把 KIMI 接入**预测市场创建**这一核心流程：用户给一个一句话话题，KIMI 生成一份可客观结算的
YES/NO 市场草稿（标题 / 描述 / 分类 / 客观判定规则 / 权威结算来源 / 标签 / 初步倾向）。
草稿字段与上链的 `MarketMeta` 一一对应，不是聊天框，而是结构化的「市场草拟引擎」。
仅在 Monad Testnet（`chainId === 10143`）的创建市场表单中显示。

## 2. 架构

```
CreateMarketForm (Monad /10143/prediction/create)
  └─ KimiMarketDrafter  ──invokeAuthedFunction──▶ Edge: prediction-market-draft
        (src/components/prediction/kimi-market-drafter.tsx)      │
        (src/lib/prediction-market-draft.ts)                     ├─ authorizeWrite
                                                                 │   (Privy session bearer 或
                                                                 │    EIP-712 PoPoAuth 签名)
                                                                 ├─ 每钱包限流（8 次/分钟）
                                                                 └─ _shared/kimi.ts
                                                                       └─ OpenAI 兼容
                                                                          POST {KIMI_BASE_URL}/chat/completions
                                                                          model = KIMI_MODEL
                                                                          response_format=json_object
```

- 前端：`app/src/components/prediction/kimi-market-drafter.tsx`、`app/src/lib/prediction-market-draft.ts`；
  挂载点 `app/src/components/prediction/create-market-form.tsx`（Monad 门控）。
- 后端：`app/supabase/functions/prediction-market-draft/index.ts`、`app/supabase/functions/_shared/kimi.ts`。
- KIMI key 仅存在于服务端 Supabase Secret，浏览器永远拿不到。
- 鉴权复用全站规范：Privy 内嵌钱包静默 session，或 EIP-712 `PoPoAuth` 签名；
  与其它用户写操作一致（见 `functions/_shared/auth.ts`、`_shared/session.ts`）。
- 草拟只产出文本，**不写库、不上链、不付款**；用户仍需审阅/编辑并自行签名提交，
  市场仍需管理员审核后 `adminEnableMarket` 才公开。

## 3. 环境变量（Supabase Secret，仅服务端）

| 名称 | 值 | 说明 |
| --- | --- | --- |
| `KIMI_API_KEY` | `sk-…`（已设置，勿入库） | platform.moonshot.cn key |
| `KIMI_BASE_URL` | `https://api.moonshot.cn/v1` | 国内网关；国际版换对应域名 |
| `KIMI_MODEL` | `kimi-k2.7-code` | 快速推理模型；也可用 `kimi-k2.6`（慢） |
| `KIMI_TIMEOUT_MS` | `90000`（实际默认代码 60000） | 边缘到国内网关留足时间 |

默认值写在 `_shared/kimi.ts`：base `https://api.moonshot.cn/v1`、model `kimi-k2.7-code`。

## 4. 模型特性与踩坑

- 平台该 key 仅可见 `kimi-k2.6`、`kimi-k2.7-code` 两个模型。
- 两者都是**推理模型**：
  - 只允许 `temperature = 1`，传 `0.3/0.4` 会 400（`invalid temperature`）。代码因此**不传 temperature**。
  - 输出前会消耗大量 `reasoning_tokens`，`max_tokens` 给小了会出现 `content=""`、`finish_reason=length`。
- 延迟差异很大：
  - `kimi-k2.6`：约 35s（本地直连国内网关），经 Supabase 孟买边缘节点跨境常 >90s 被 abort → 502。
  - `kimi-k2.7-code`：结构化 JSON 草拟约 **5–30s**，跨境边缘稳定返回，已选为生产默认。
- 组织**并发上限 = 1**：并发第二个请求返回
  `429 rate_limit_reached_error (max organization concurrency: 1)`。代码做 3 次指数退避重试。
- 用 `response_format: { type: "json_object" }` 强制 JSON，同时代码再做一次「首个 `{...}` 块」
  防御性提取，并对 `title/category/lean/tags` 做归一化与白名单校验。
- prompt 明确禁止臆造话题里没有的历史价格、具体日期、数字，并保留话题原始时间措辞
  （"this month/quarter"），避免模型自作主张锚到旧日期。

## 5. 部署

Edge 已部署（`--no-verify-jwt`，函数内自行鉴权）：

```bash
supabase secrets set \
  KIMI_API_KEY='sk-…' KIMI_MODEL='kimi-k2.7-code' \
  KIMI_BASE_URL='https://api.moonshot.cn/v1' KIMI_TIMEOUT_MS='90000' \
  --project-ref novxohcvvpoqcfkpsvcj

supabase functions deploy prediction-market-draft \
  --project-ref novxohcvvpoqcfkpsvcj --no-verify-jwt
```

`supabase/deploy.sh` 的 FUNCTIONS 列表已加入 `prediction-market-draft`。
前端随正常 release 流程发布（本地提交 `app@38e0929`，未 push）。

## 6. 验证结果（真实，非 mock）

- 未鉴权调用 → `401 Unauthorized: missing session or signature`（鉴权闸门有效）。
- 用已登录 Privy 内嵌钱包（`0x27724973F99D01a37F6dD2a517936be13c53f2a8`）经浏览器会话调用线上 Edge：
  `HTTP 200`，`provider=kimi`、`model=kimi-k2.7-code`，返回完整草稿。
- 本地 UI 实走：输入话题 → Drafting… → 草稿卡（标题/CRYPTO/描述/客观 Resolution rule/标签/Apply to form）。
- 截图：`hackathon/bounty-submissions/assets/kimi/kimi-ui-result.png`。

示例（话题 "Will a major AI lab release a next-gen flagship model this month?"）：
category=`Tech`，resolutionSource=`Official announcements from OpenAI, Anthropic, Google DeepMind,
Meta AI, xAI, and reporting by The Verge, TechCrunch, Reuters`，lean=`uncertain`。

## 7. 对外文章

英文 X 长线程（8 条）：`hackathon/bounty-submissions/kimi-article-x-thread.md`。
发布后把**已发布文章/X 线程 URL**回填到 Metropolis KIMI 提交表单的 `url`（必填）字段。
