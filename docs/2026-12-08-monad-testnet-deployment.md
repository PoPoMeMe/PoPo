# PoPo.meme on Monad Testnet — Deployment & Verification

> Updated: 2026-12-08 (application/edge status refreshed through 2026-10-11)
> Network: **Monad Testnet, chainId `10143` (`0x279f`)**, parallel EVM, gas token MON
> RPC: `https://testnet-rpc.monad.xyz` (backup `https://monad-testnet.drpc.org`)
> Explorer: <https://testnet.monadexplorer.com> · Faucet: <https://faucet.monad.xyz>

## 1. Deployed contracts (all live, verified over public RPC)

| Contract | Address | Deployment block |
| --- | --- | --- |
| **PoPoApp (Diamond, 19 facets)** | `0xa08e66FD7f19C22Fe44928518DFe6A867B0E4c07` | 70,016,287 |
| USDPApp ($P, 18 decimals, vault quote underlying) | `0xf8D44b7682fe1f2D3d5089DCA3510D830675C662` | 70,015,903 |
| PPTApp (platform token) | `0xF1cbd96fbF971Cf8c00399564256556aef730407` | 70,015,914 |
| PFTApp (losing-side compensation SBT) | `0xEE172A8486454ff5f01593Cb62B70CAFD8BC1c9E` | 70,015,938 |
| Create2Deployer (shared singleton) | `0xCA1E405289335507782ad322d67916e7517953C2` | 70,016,319 |
| CreatorFeeHookDefault (graduated-pool creator fee) | `0xA3f017FAC5D0105e258C1c87F4898852e17f4044` | CREATE2 |
| EpisodeBuybackRouter (daily buyback) | `0xDD91C29F40af463B42871a010cAFbddD90892266` | 70,016,371 |

- Deployer: `0xc081A98B8824f582Ddd697EeA62432e7ab23B1c0`
- PoPoApp CREATE tx: [`0xb827f4c0…aca6ac`](https://testnet.monadexplorer.com/tx/0xb827f4c084b741bc0d84e715e31a253c12de87f33e50ed6ff5d57a309aaca6ac)

## 2. Verification (reproducible from any public RPC)

1. `eth_chainId` → `0x279f` = **10143**.
2. DiamondLoupe `facets()` → **19 facets**: the 7 base facets
   (DiamondCut / DiamondLoupe / AccessControl / Ownable / EIP712 / Pausable / TTOQManager)
   plus ERC6909, Vault, PPHatchSwap, PoolManager, Migration, Router, Admin,
   Market, Episode, Referral, PlatformFee and Funding — the same full suite
   deployed on our other chains.
3. `getConfig()` on-chain parameters:
   - virtual reserves 1,073,000,000 / 5,000; real token reserves 793,100,000; total supply 1,000,000,000
   - **graduation threshold 14,000 $P**; platform fee 100 bps, creator fee 50 bps;
     AMM fee 25 bps, tickSpacing 60, protocol fee 5 bps, **AMM creator fee 5 bps**
   - **creation fee 2 $P** (Monad deployment value); creator reserve cap/default **10%**,
     cliff **30 days**, vesting **60 days**
   - USDP registered as the vault quote underlying (`quoteId = 1`)
4. Roles verified via `hasRole` / `canCall`: deployer and the operations
   wallet `0x85A6…D598` hold ROLE_90 (SUPER_ADMIN) + ROLE_4.

## 3. Seeded application state (2026-10-11)

- **50 demo movie coins are live on chain**, tokenId **2–51** (creation fee
  2 $P each, minted → deposited into the vault → ERC-6909 approve → `createToken`,
  resumable batch script). Token art is served from public storage; the Explore
  page lists all 50 via the indexed cache.
- **Frontend**: Monad Testnet is wired into the contract registry
  (hatchDiamond + USDP at 10143), the network selector and Privy
  `supportedChains`; the Hatch index is enabled for `monadTestnet`
  (`quoteTokenId=1`). Because Monad limits `eth_getLogs` to **100 blocks per
  call**, the chunked log reader and billing/referral reconcilers use the same
  100-block span + serial throttle strategy as on Arc.
- **Edge backend**: the shared on-chain registry includes 10143
  (`referralStartBlock` / `lpStartBlock` = 70,016,287; multicall3 verified),
  and the registry-derived functions — faucet, referral-indexer,
  hatch-lp-indexer, token list, affiliate services — are redeployed against
  Monad. `POST {chainId:10143}` on the referral/LP indexers returns
  `caught_up`.
- **Faucet ready**: the faucet hot wallet holds ROLE_1 (mint) on the Monad
  USDPApp plus MON for gas, so the `/faucet` page can drip gas + $P.

## 4. Live prediction market (2026-10-11)

The first real prediction market was opened on-chain and exercised end to end:

- **Market digest**: `0x7fd5153590607951f0abdd92f39ba4422d3bad94d319558d46f96ad52c15a3e52`
- Question: **“Will PoPo.meme graduate a coin on Monad before 2026 ends?”** (category: Crypto)
- Curve: `k = 0.8e18`, `c = 1.8e18`, platform fee 100 bps, reward pool 1,000 $P
- YES/NO are soulbound ERC-6909 ids **52 / 53**; status **enabled / live**; first share price 2.6 $P
- `createMarket` tx: `0x1dc3e754…2be7c0`; `adminEnableMarket` tx: `0xfa2194c3…38a69a`
- Markets never move funds: rewards and trading settle internally in vault $P (`quoteId = 1`).
- Smoke test with real transactions: `approve USDP → deposit(1, 20) → buy YES →
  buy NO (second share prices at 0.8·√2+1.8 ≈ 2.9314) → sell YES` — supplies
  returned to 0/1 and vault accounting balanced. Buy/sell/vault settlement all pass.

> Settlement is admin-only by design: `endMarket(digest, winningId)` →
> `adminFinalizeMarket(digest)`, then winners `claimReward` and losers
> `claimFailedToken` (1:1 PFT compensation SBT).

## 5. Privy embedded-wallet fix specific to Monad testnet

Deposits from the Privy embedded wallet initially failed with a misleading
`Signer had insufficient balance` / JSON-RPC `-32602`. Root cause: Privy's
bundled chain list contains Monad **mainnet** but not testnet (10143), so its
server-side pre-flight had no RPC endpoint for the chain. Fix: define the
10143 chain in-app with an explicit `rpcUrls.privyWalletOverride`
(`testnet-rpc.monad.xyz` primary, `monad-testnet.drpc.org` backup) and pass it
through `PrivyProvider.supportedChains`. Direct viem calls confirmed chainId
`0x279f` on both endpoints; `tsc` and production build pass. Business
signatures still use the embedded wallet only.

## 6. Reproduction (from the full monorepo)

```bash
cd smart-contract
NETWORK=monad_testnet_10143 npm run deploy:PPApp     # USDP/PPT/PFT prerequisites
NETWORK=monad_testnet_10143 npm run deploy:PoPoApp   # 01–08: facets, config, hook, buyback
# Grant the ops wallet ROLE_4/90 (dry-run by default; SEND=1 broadcasts)
SEND=1 npx hardhat run scripts/grant-monad-admin-role.ts --network monad_testnet_10143
```

## 7. Why Monad

The exact same unforked EIP-2535 Diamond + ERC-6909 vault + v4-style
PoolManager codebase deploys on **Monad's parallel EVM with zero chain-specific
contract changes** and passes full on-chain verification — evidence that the
architecture is portable to high-throughput, low-fee, sub-second-block
execution environments. Monad testnet is the sixth EVM environment in the
PoPo.meme deployment matrix (alongside X Layer, Sei, Mantle Sepolia,
Robinhood Chain and Arc). The consumer workload — dozens of coins trading and
graduating, plus event indexing over short blocks — is precisely the kind that
benefits from parallel execution.
