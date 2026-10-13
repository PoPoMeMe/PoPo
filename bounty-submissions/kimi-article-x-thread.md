# KIMI bounty — X thread (English, 8 tweets)

> How to use: post tweets 1→8 as one thread (reply each to the previous one).
> Handles to double-check before posting: @Kimi_Moonshot / @Moonshot_HQ,
> @monad. Attach the screenshot `kimi-ui-result.png` to tweet 5.
> Keep every claim live by shipping the frontend before posting (the Edge
> Function is already deployed).

---

**Tweet 1 (hook)**

We didn't bolt a chatbot onto PoPo.meme.

We put @Kimi_Moonshot's KIMI model inside the core loop: creating a prediction market.

Type one rough idea → KIMI drafts an objectively resolvable YES/NO market, ready to go on-chain on @monad testnet.

Here's how we built it and why it matters 🧵

---

**Tweet 2 (the problem)**

A prediction market is only as good as its resolution rule.

"Will X become big?" is untradeable — it's subjective.
A real market needs a binary question, a deadline, and a public, authoritative source an admin can actually settle against.

Most users can't write that. That was our biggest market-creation bottleneck.

---

**Tweet 3 (what KIMI does)**

KIMI now powers our "AI market drafter":

In: a free-form topic ("Will a major AI lab ship a flagship model this month?")
Out: strict JSON — title, description, category, an objective resolution rule, the authoritative source, tags, and an initial lean with reasoning.

No chat window. A structured engine in the create-market form.

---

**Tweet 4 (how it's wired)**

- Frontend → Supabase Edge Function `prediction-market-draft`
- Server-side OpenAI-compatible call to KIMI (`kimi-k2.7-code`, `response_format: json_object`)
- Key never touches the browser (env-only)
- Auth: our standard EIP-712 PoPoAuth signed by the Privy embedded wallet (or a silent session token) + per-wallet rate limit

The JSON maps 1:1 onto the market meta that gets hashed and committed on-chain.

---

**Tweet 5 (the value, 1/2)**

KIMI enforces settleability by design:
• forces a binary, specific question with a deadline
• names an objective public source (e.g. official lab announcements / Reuters / The Verge)
• rejects opinion-based wording
• picks category + discovery tags

Users go from blank page to a clean, reviewable draft in seconds — and market quality/admission is far more consistent for review.

[📸 attach screenshot: kimi-ui-result.png]

---

**Tweet 6 (the value, 2/2 — human stays in control)**

AI drafts; the human decides.

Nothing is auto-signed or auto-paid. The user reviews and edits every field, then submits the on-chain transaction through Privy. Markets still go through admin review before going live.

KIMI removes the writing friction — it never removes the user's or the protocol's control.

---

**Tweet 7 (engineering notes)**

Two things that made it production-grade:
1️⃣ org concurrency is capped at 1 → KIMI returns 429 mid-burst; we retry with backoff
2️⃣ picked the fast reasoning model so a full structured draft returns in ~5–30s even from a global edge runtime, well inside timeout

Strict JSON extraction + field validation also guard against malformed model output.

---

**Tweet 8 (close / CTA)**

KIMI turned our hardest onboarding wall — writing a market that can actually be resolved — into a one-line prompt.

Live on Monad testnet in PoPo.meme's create-market flow. Try drafting a market 🔮

Built with @Kimi_Moonshot × @monad

#KIMI #MoonshotAI #Monad #PoPo #AI #predictionmarkets
