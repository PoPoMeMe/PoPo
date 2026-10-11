# Privy Bounty Submission — PoPo.meme

> **Track:** Onchain Finance & Trading (Monad testnet, chainId 10143)
> **Bounty:** Build something cool using Privy — beyond authentication
> **Team:** PoPo.meme (`predpred`)

## What we built

PoPo.meme uses **Privy embedded wallets as the backbone of every on-chain and
off-chain authenticated action**, far beyond sign-in. Privy is not an auth gate
in front of an app that could work without it — the whole trading product is
built on the Privy wallet.

The product: a meme-coin launch + bonding-curve trading platform with an
integrated YES/NO prediction market, live on Monad testnet. Users sign in with
email/social and get a Privy embedded wallet; they can then deposit, trade
meme coins, trade prediction shares, run agent flows, and manage a gasless
profile — all from that wallet.

## Where Privy is used beyond authentication

1. **All on-chain transactions are signed and sent by the embedded wallet.**
   The app uses Privy's `useSendTransaction` / `walletClient.sendTransaction`
   to submit every state-changing call — Hatch meme-coin buy/sell, prediction
   YES/NO `buyAmount`/`sellAmount`, vault deposit/withdraw, market creation,
   ERC-20 and ERC-6909 approvals, episodes, referrals.
   - ~19 call sites use the `useSendTransaction` hook; `sendTransaction`
     appears across ~75 component/hook locations.
2. **Silent EIP-712 typed-data signing powers the entire off-chain write
   layer.** Every user-originated Supabase write (profile edits, market
   applications, social/earn actions) is authorized with a Privy
   `useSignTypedData` EIP-712 signature (`eth_signTypedData_v4`), which a
   Supabase Edge Function verifies via `ecrecover` (`_shared/auth.ts`). No
   bearer tokens, no trusting a self-reported address.
3. **Privy access tokens authenticate server/edge calls.** `getAccessToken()`
   (14 call sites) is attached to privileged API/edge requests, combining
   wallet-signature auth with Privy session auth.
4. **Embedded wallet is the canonical account across networks.** The same
   Privy wallet is used on Monad testnet, Arc testnet and local Hardhat with a
   single chain abstraction (`SELECTABLE_NETWORK_KEYS`), with external wallets
   reserved only for top-ups.

We also maintain a maintained `pnpm patch` for Privy 3.40.0 (embedded-wallet
transaction-modal hook crash + skipping the redundant success screen), showing
deep integration with the SDK rather than a toy use.

## Privy SDK surface used

- `PrivyProvider`, `usePrivy`, `useLogin`, `useLogout`
- `useSendTransaction` (embedded wallet) — all contract transactions
- `useSignTypedData` (`uiOptions.showWalletUIs: false`) for silent EIP-712
  signatures
- `getAccessToken()` for edge/API authorization
- `@privy-io/react-auth` ^3.40.0, embedded EOA wallets (not smart-wallet only)

## Repo / code pointers

- Provider wiring: `app/src/main.tsx` / `app/src/providers/` (PrivyProvider
  config, embedded wallet, supported chains incl. Monad testnet 10143).
- Transactions: `app/src/hooks/use-pp-hatch-swap.ts`,
  `app/src/hooks/use-prediction.ts`,
  `app/src/components/hatch/amm-trade-panel.tsx`,
  `app/src/components/market/market-swap-panel.tsx`.
- Silent typed-data signatures: profile/earn/market-application hooks and the
  Edge Function verifier `supabase/functions/_shared/auth.ts`.

## Deliverables mapping

- **Working product deployed on Monad testnet** — PoPoApp Diamond
  `0xa08e66FD7f19C22Fe44928518DFe6A867B0E4c07`, live Hatch trading and a live
  enabled prediction market.
- **Public repo / README** — see project root and `README.md`.
- **≤2 min demo video** — *(link to insert)* shows: email login → embedded
  wallet appears → deposit → trade a meme coin and YES/NO shares → a silent
  EIP-712 profile/market write, with the Privy provider and Monad network
  visible.
- **Monad network in the wallet UI** — Monad testnet (10143) is a selectable
  network inside the Privy-backed app.
- **Public GitHub link + team contact** — *(links to insert)*.

## Demo script (2 minutes)

1. Sign in with email → Privy embedded wallet is created/shown, network set to
   Monad testnet.
2. Show the wallet has no separate extension — it is Privy's embedded wallet.
3. Deposit test $P and buy a Hatch meme coin (Privy `sendTransaction`).
4. Buy YES shares in the live prediction market (Privy transaction).
5. Edit profile / apply for a market and show the **silent** EIP-712 signature
   authorizing the edge write (`useSignTypedData`, no popup spam).
6. Show the same Privy address on the Monad explorer.
