# 5-Minute Live Demo Script

A judge-ready flow. Everything runs on a public testnet with the Privy embedded
wallet (email login, no extension setup), with a local chain as fallback.
Pre-fund the demo wallet beforehand; keep the vault pre-loaded with some $P.

## Timing

| Time | Beat | What to show / say |
|------|------|--------------------|
| 0:00 | **Login** | "Email login — Privy creates an embedded wallet in the browser. No seed phrase, no extension. External wallets are funding-only; every business action signs with this embedded wallet." |
| 0:30 | **Network switch** | Use the sidebar switcher. "The `/:chainId` URL drives all reads instantly; writes wait for the wallet to catch up, so we can never trade on the wrong chain." |
| 0:50 | **Create a coin** | Hatch → Create: name, symbol, image, reserve % (creator vesting), confirm one tx paying the small creation fee. "The whole supply is minted to the Diamond: sale reserves, creator reserve under cliff+linear vesting, and the remainder permanently locked." |
| 1:30 | **Trade the curve** | Open the coin, buy. Point at price chart and trade list. "xy=k virtual-reserve curve with integer rounding in the pool's favor; platform + creator fees on every swap, plus a two-level referral cut taken only from the platform fee." Sell once to show symmetric pricing and the slippage minimum input. |
| 2:20 | **Referral** | Open your invite link in a second session, buy once. "The edge binds before first trade; gold rates are frozen at bind time — no retroactive games." Show pending reward in the first account. |
| 2:50 | **Graduate** | Drive `realQuoteReserves` across the threshold (or use a pre-seeded coin). Call migrate. "One permissionless transaction: the same contract seeds a v4-style concentrated-liquidity pool at the exact curve price and locks a full-range LP position owned by the Diamond forever. No router, no LP token, no settle transfers." |
| 3:30 | **Post-graduation fee hook** | Buy on the AMM. "This pool's hook address ends in the permission bits 0x44; its afterSwap delta charges a creator fee based on market-cap tier measured at the *pre-trade* price — a swap can't push itself into a cheaper tier. The creator earns forever." |
| 4:00 | **Episode + buyback burn** | Creator view: upload a short paid episode. Fan session: unlock it ($P) and watch (mention P2P offload if peers exist). Trigger daily buyback on the coin page. "Episode revenue splits creator/platform/buyback. Anyone may trigger one buy-and-burn per UTC day through a stateless router with a hard −5% price limit — bought coins are burned in the same transaction. Content consumption becomes buy pressure." |
| 4:40 | **Prediction market** | Open an enabled market, buy a YES share. "ERC-1155 YES/NO shares priced by k·√x + c; admin review is a separate on-chain role, and winners later claim pro-rata from both the reward and trading pools." |
| 4:55 | **Close** | One sentence: "Launch, trade, graduate, earn, publish content, and burn — all on one Diamond, one ledger, one embedded wallet." |

## Backup beats (if something stalls)

- **Don't wait for the threshold live** — keep a pre-graduated coin pinned in a
  browser tab; switch networks/tabs to show the AMM + hook fee instantly.
- **No video peers** — skip P2P claims; describe the byte-offload diagram
  (`diagrams/architecture.md`) instead.
- **Referral second session inconvenient** — show the code path / pending
  balance in the first account and explain the frozen-tier rule verbally.
- **Prediction market admin step missing** — show a market already enabled;
  note the selector-level role split (`create` vs `enable` vs `finalize`).

## Talking points for Q&A

1. **Why not just use Uniswap?** We built the v4-style core against an internal
   ERC-6909 multi-token ledger on purpose: zero-hop settlement between curve,
   pool, referrals, episodes and buybacks, one approval surface, and atomic
   migration with no external router custody.
2. **Where's the backend trust?** Supabase Auth is off. Every write Edge
   Function reconstructs an EIP-712 digest and runs ecrecover with a 10-minute
   replay window; the browser never sees the service key.
3. **Who are admins?** Whoever the on-chain AccessControl facet allows per
   selector — the UI asks `canCall(address, selector)`, there is no allowlist to
   spoof.
4. **Rug protection?** Seed liquidity is locked to the Diamond, creator reserve
   tokens vest only after graduation (cliff + linear), and fees are
   deterministic bps / tier config, not withdrawable LP ownership.
5. **What's genuinely novel in one line?** A coin launch whose post-launch
   content business (paid episodes) funds a permissionless, slippage-guarded
   daily burn of that same coin, with creator fees continuing automatically on
   the graduated AMM.

## Accounts / data to prepare beforehand

- 2 email logins (creator + fan), funded wallets, vault deposits.
- 1 coin mid-curve, 1 coin at threshold, 1 already graduated with the hook.
- 1 prediction market in `enabled` state and 1 finalized market for claim demo.
- A short MP4 (< 15 MB) for the episode upload.
