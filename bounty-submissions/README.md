# Monad Metropolis Bounty — Execution Status (2026-10-11)

Track: **Onchain Finance & Trading** ｜ Deadline: **2026-10-14 03:59 UTC**
Team: **PoPo.meme** (`predpred`) ｜ Plan doc: `docs/2026-10-11-monad-metropolis-bounty-plan.md`

## ✅ Done in this session (code + docs, no credentials needed)

| # | Bounty | Tier | Artifact | Status |
| --- | --- | --- | --- | --- |
| T7 | (track support) Prediction market on Monad | — | live market digest `0x7fd5…3e52`, YES/NO 52/53, smoke-tested | **shipped on-chain** |
| T8 | **MetaMask Agent Wallet** — Best use of Agent Wallet | P1 $5k | `metamask-agent-plugin/` (`mm-plugin-popo`, 8 commands) | **built, builds clean**; needs `mm` beta install + video |
| T10 | **Envio HyperIndex** | P1 $5k | `envio-indexer/` (`popomonad`, 8 events → 7 entities) | **built, codegen + tsc clean**; needs `envio dev` (Postgres) + video |
| P0 | **Privy** — beyond authentication | P0 $5k | `bounty-submissions/privy.md` | integration already in app; **needs only the ≤2min video + links** |
| T11 | **Alchemy** — Supernode RPC + Enhanced token APIs | P1 $1k credits | `app/src/lib/alchemy.ts`, `app/src/hooks/use-alchemy-monad.ts`, wired in `main.tsx`; `bounty-submissions/alchemy.md` | **built & env-gated; add `VITE_ALCHEMY_API_KEY`, rebuild, demo** |
| — | submission copy | — | `metamask-agent-plugin.md`, `envio.md` in this folder | drafts ready, insert video/repo links |

## 🔑 Blocked on YOU (accounts / keys / actions)

1. ~~Community Team (P0 $5k)~~ — **decided: SKIP** (we do not belong to any of
   the 60 onboarded clubs/DAOs).
2. **Supabase management token 401** — run `supabase login` so the
   faucet/referral/billing edges can redeploy (`./supabase/deploy.sh`, new
   edges with `--no-verify-jwt`).
3. **Alchemy key (P1 $1k credits)** — code is DONE and env-gated. Create a
   free key at https://www.alchemy.com/monad, set `VITE_ALCHEMY_API_KEY` in
   Vercel + `.env.local`, rebuild → Supernode becomes primary Monad RPC and the
   wallet balance/activity Enhanced APIs activate. Then record the short demo.
4. **Nansen (P1 $5k)** — needs an API key (https://docs.nansen.ai) and Monad
   coverage confirmation; higher effort, do only if key available.
5. **Perpl API (P1 $5k)** — it is a trading bot **on Perpl's own CLOB**, with
   required real on-chain trading activity and a video. Different venue from
   PoPo; high effort + needs funded execution. Recommend skip unless you want
   that strategy. See https://docs.perpl.xyz/resources/for-developers.
6. **Demo env** — Monad-testnet default demo build + judge test accounts
   (faucet $P), started manually by you per team rule (agents don't start
   services).
7. **Videos + form** — T13/T14: pitch ≤2min, per-bounty ≤2min; fill each
   bounty's required fields (the `requirements` list is captured in
   `bounty-submissions/*.md`).

## Recommendation

Hold the line: **track + Privy + Agent Wallet Plugin + Envio + Alchemy** is a
strong, fully-built story (~$16k eligible) with no more credentials beyond the
free Alchemy key. Community skipped. Skip Perpl/Nansen/Dynamic/Mera/Agora/KIMI.
