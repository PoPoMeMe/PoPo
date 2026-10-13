# KIMI bounty — X thread (English, 8 tweets)

> **PUBLISHED 2026-10-13** from PoPo.meme @PoPoMeMe3000.
> First tweet — use this as the KIMI bounty submission `url`:
> **https://x.com/PoPoMeMe3000/status/2110057346135433627**
>
> Second tweet in the thread:
> https://x.com/PoPoMeMe3000/status/2110057348404502878
>
> Image attached to tweet 1: `assets/kimi/kimi-ui-result.png`.
> Account confirmed before posting: PoPo.meme (verified) @PoPoMeMe3000.
> Every tweet was ≤280 chars. No @-mentions were used (official KIMI handle
> could not be verified), only hashtags.

---

## Posted text (exact)

**1/**
We didn't bolt a chatbot onto PoPo.meme.

We put KIMI (Moonshot AI) inside the core loop: creating a prediction market.

One rough idea → KIMI drafts an objectively resolvable YES/NO market, ready to go on-chain on Monad testnet.

How & why 🧵
*(+ screenshot `assets/kimi/kimi-ui-result.png`)*

**2/**
A market is only as good as its resolution rule.

"Will X become big?" is untradeable — subjective. A real market needs a binary question, a deadline, and a public source an admin can settle against.

Most users can't write that. It was our top creation bottleneck.

**3/**
KIMI now powers our AI market drafter.

IN: one free-form topic ("Will a major AI lab ship a flagship model this month?")
OUT: strict JSON — title, description, category, objective resolution rule, source, tags.

Not a chat window. A structured engine in the create-market form.

**4/**
How it's wired:
• Frontend → Supabase Edge Function "prediction-market-draft"
• Server-side OpenAI-compatible KIMI call (kimi-k2.7-code, JSON mode)
• API key never reaches the browser
• EIP-712 auth via Privy embedded wallet + rate limit

JSON maps 1:1 onto on-chain market meta.

**5/**
KIMI enforces settleability:
• a binary, specific question + deadline
• an objective public source (official releases / Reuters / Verge)
• rejects opinion wording
• picks category + tags

Blank page → clean, reviewable draft in seconds, with consistent markets for review.

**6/**
AI drafts; the human decides.

Nothing is auto-signed or auto-paid. The user reviews and edits every field, then submits the on-chain tx through Privy. Markets still pass admin review before going live.

KIMI removes writing friction — not control.

**7/**
Production notes:
1) KIMI caps org concurrency at 1 → mid-burst 429, so we retry with backoff
2) the fast reasoning model returns a full structured draft in ~5–30s even from a global edge runtime

Strict JSON parsing + field validation guard bad output.

**8/**
KIMI turned our hardest onboarding wall — writing a market that can actually be resolved — into a one-line prompt.

Live on Monad testnet in PoPo.meme's create-market flow. Go draft a market 🔮

#KIMI #MoonshotAI #Monad #PoPo #AI #predictionmarkets
