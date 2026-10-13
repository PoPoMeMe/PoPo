# Monad Metropolis Bounty — Execution Status (2026-10-11)

Track: **Onchain Finance & Trading** ｜ Deadline: **2026-10-14 03:59 UTC**
Team: **PoPo.meme** (`predpred`) ｜ Plan doc: `docs/2026-10-11-monad-metropolis-bounty-plan.md`

## ✅ Done in this session (code + docs, no credentials needed)

| # | Bounty | Tier | Artifact | Status |
| --- | --- | --- | --- | --- |
| T7 | (track support) Prediction market on Monad | — | live market digest `0x7fd5…3e52`, YES/NO 52/53, smoke-tested | **shipped on-chain** |
| T8 | **MetaMask Agent Wallet** — Best Agent Wallet Plugin | **$2,500** | `metamask-agent-plugin/` (`mm-plugin-popo`, 9 commands) + `skills/popo/SKILL.md` | **full live write loop verified on Monad via guarded server wallet** — faucet EIP-712 mint `0xcffa…6ac93`, approve `0x34526e…`, deposit 100 `0xce5f26…`, 6909 approve `0xcf4fad…`, `predict buy 0 yes 2` `0x14bbad…` (success, YES=2, vault 100→61.3275084 $P); **per-tx email MFA kept (required — no bypass of signing/policy/MFA)**. Remaining: record REQUIRED ≤5min video + submit SKILL.md url |
| T10 | **Envio HyperIndex** — Best Use of Envio | **$1,000** | `envio-indexer/` (`popomonad`, 8 events → 7 entities) | **built, codegen + tsc clean**; needs `envio dev` (Postgres) + optional ≤2min video |
| P0 | **Privy** — beyond authentication | P0 $5k | `bounty-submissions/privy.md` | integration already in app; **needs only the ≤2min video + links** |
| T11 | **Alchemy** — Supernode RPC + Enhanced token APIs | P1 $1k credits | `app/src/lib/alchemy.ts`, `app/src/hooks/use-alchemy-monad.ts`, wired in `main.tsx`; `bounty-submissions/alchemy.md` | **key verified live on Monad** (chainId `0x279f`, real balances/transfers); set key in Vercel + rebuild for prod |

**Ready-to-paste kits:** `FORM-ANSWERS.md` (every bounty's exact form text +
links), `VIDEO-SCRIPT.md` (per-second shot lists for all 6 clips).
| — | submission copy | — | `metamask-agent-plugin.md`, `envio.md` in this folder | drafts ready, insert video/repo links |

## 🔑 Blocked on YOU (accounts / keys / actions)

1. ~~Community Team (P0 $5k)~~ — **decided: SKIP** (we do not belong to any of
   the 60 onboarded clubs/DAOs).
2. **Supabase management token 401** — run `supabase login` so the
   faucet/referral/billing edges can redeploy (`./supabase/deploy.sh`, new
   edges with `--no-verify-jwt`).
3. **Alchemy key (P1 $1k credits)** — code DONE, env-gated, and the testnet key
   `VITE_ALCHEMY_API_KEY` is set in `app/.env.local` and **verified live** on
   Monad (chainId/head match public RPC; Enhanced balance + transfers return
   real data). Remaining: set the same var in **Vercel**, rebuild, and record
   the short demo. Key is testnet-only per owner.
4. **Nansen (P1 $5k)** — needs an API key (https://docs.nansen.ai) and Monad
   coverage confirmation; higher effort, do only if key available.
5. **Perpl API (P1 $5k)** — it is a trading bot **on Perpl's own CLOB**, with
   required real on-chain trading activity and a video. Different venue from
   PoPo; high effort + needs funded execution. Recommend skip unless you want
   that strategy. See https://docs.perpl.xyz/resources/for-developers.
6. **Demo env** — Monad-testnet default demo build + judge test accounts
   (faucet $P), started manually by you per team rule (agents don't start
   services).
7. **Videos + form** — pitch ≤2min; per-bounty video limits differ: Privy/Envio/Alchemy ≤2min (optional), **MetaMask ≤5min and REQUIRED (plus required SKILL.md url)**; fill each
   bounty's required fields (the `requirements` list is captured in
   `bounty-submissions/*.md`).

## Infrastructure status (re-verified 2026-10-11)

- **Supabase token in `app/.env.local` works** (`SUPABASE_ACCESS_TOKEN`, project
  `novxohcvvpoqcfkpsvcj` ACTIVE_HEALTHY). **54 edge functions are already
  deployed**, all `verify_jwt=false`, including faucet/referral/billing/prediction.
- **Monad faucet chain path is live:** hot wallet `0x911d…4ae57` holds
  `hasRole(...,1)=true` (mint ROLE_1) on USDPApp `0xf8D4…C662`, 0.185 MON gas,
  edge responds to chainId 10143 (reaches EIP-712 auth → 401 without signature,
  not "chain unavailable"). No redeploy needed.

## Recommendation

Hold the line: **track + Privy + Agent Wallet Plugin + Envio + Alchemy + KIMI** is a
strong, fully-built story. Community skipped. Skip Perpl/Nansen/Dynamic/Mera/Agora.

**KIMI is now included (2026-10-13):** real AI market drafter shipped in the core
prediction-market creation flow on Monad; edge function deployed and verified; English
X thread published: https://x.com/PoPoMeMe3000/status/2110057346135433627 —
see `kimi-article-x-thread.md` and `assets/kimi/`.
