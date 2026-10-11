/**
 * PoPo.meme deployment addresses + minimal ABIs.
 *
 * Every facet lives behind ONE Diamond (EIP-2535) on Monad testnet (chainId
 * 10143): Hatch bonding-curve trades, prediction markets and the $P vault are
 * all methods on the same diamond address. The prediction market settles in the
 * diamond's internal vault $P (ERC-6909 quote id 1), NOT a standalone ERC-20.
 *
 * Addresses are sourced from the canonical on-chain deployment:
 *   docs/2026-12-08-monad-testnet-deployment.md
 */

export const MONAD_TESTNET_CHAIN_ID = 10143;

export const CONTRACTS = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  /** PoPoApp Diamond — Hatch + Market + Vault share this single address. */
  diamond: "0xa08e66FD7f19C22Fe44928518DFe6A867B0E4c07",
  /** ERC-20 $P (USDP). */
  usdp: "0xf8D44b7682fe1f2D3d5089DCA3510D830675C662",
  /** Failure-compensation soulbound token (PFT). */
  pft: "0xEE172A8486454ff5f01593Cb62B70CAFD8BC1c9E",
  /** ERC-6909 internal quote token id used by the vault ($P). */
  quoteTokenId: 1n,
  explorer: "https://testnet.monadexplorer.com",
  /** Existing PoPo testnet faucet Edge Function (mints $P server-side). */
  faucetFunctionUrl:
    "https://novxohcvvpoqcfkpsvcj.supabase.co/functions/v1/testnet-faucet-claim",
  faucetAction: "testnet-faucet-claim",
  /**
   * Public read RPCs. Read-only commands use these directly (the Agent Wallet
   * host's gateway RPC requires a logged-in project id, which a public market
   * listing should not need). Write commands still go through walletExecutor.
   * Override with POPO_MONAD_RPC_URL for a private/Alchemy endpoint.
   */
  rpcUrls: [
    process.env.POPO_MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
    "https://monad-testnet.drpc.org",
  ],
} as const;

export function txUrl(hash: string): string {
  return `${CONTRACTS.explorer}/tx/${hash}`;
}

export function addressUrl(addr: string): string {
  return `${CONTRACTS.explorer}/address/${addr}`;
}

/** Vault: deposit ERC-20 $P into the internal 6909 balance before trading. */
export const VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "id", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Hatch bonding curve (meme coins). quoteId = 1 (internal vault $P). */
export const HATCH_ABI = [
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "quoteAmount", type: "uint256" },
      { name: "minTokensOut", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sell",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "tokenAmount", type: "uint256" },
      { name: "minQuoteOut", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "previewBuy",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "quoteAmount", type: "uint256" },
    ],
    outputs: [
      { name: "tokenAmount", type: "uint256" },
      { name: "platformFee", type: "uint256" },
      { name: "creatorFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "previewSell",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "tokenAmount", type: "uint256" },
    ],
    outputs: [
      { name: "quoteOut", type: "uint256" },
      { name: "platformFee", type: "uint256" },
      { name: "creatorFee", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getTokenInfo",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "creator", type: "address" },
      { name: "virtualTokenReserves", type: "uint256" },
      { name: "virtualQuoteReserves", type: "uint256" },
      { name: "realTokenReserves", type: "uint256" },
      { name: "realQuoteReserves", type: "uint256" },
      { name: "graduationThreshold", type: "uint256" },
      { name: "complete", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getTokenCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Prediction market (YES/NO shares, soulbound ERC-6909 per market). */
export const MARKET_ABI = [
  {
    type: "function",
    name: "totalMarket",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMarketList",
    stateMutability: "view",
    inputs: [
      { name: "start", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [
      { name: "digest", type: "bytes32" },
      { name: "targetSupply", type: "uint256" },
    ],
    outputs: [
      {
        name: "market",
        type: "tuple",
        components: [
          { name: "digest", type: "bytes32" },
          { name: "resultNftId", type: "uint256" },
          { name: "rewardERC20Token", type: "address" },
          { name: "rewardTotalAmount", type: "uint256" },
          { name: "yesNftId", type: "uint256" },
          { name: "noNftId", type: "uint256" },
          { name: "isEnabled", type: "bool" },
          { name: "isEnded", type: "bool" },
          { name: "isFinalized", type: "bool" },
          { name: "yesSupply", type: "uint256" },
          { name: "noSupply", type: "uint256" },
          { name: "k", type: "uint256" },
          { name: "c", type: "uint256" },
          { name: "poolTotalAmount", type: "uint256" },
          { name: "platformFeeBps", type: "uint256" },
          { name: "platformFeeAmount", type: "uint256" },
          { name: "rewardTotalPayout", type: "uint256" },
          { name: "pcPayout", type: "uint256" },
          { name: "ptTokenPayout", type: "uint256" },
        ],
      },
      {
        name: "priceMeta",
        type: "tuple",
        components: [
          { name: "targetSupplyPrice", type: "uint256" },
          { name: "currentYesPrice", type: "uint256" },
          { name: "currentNoPrice", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "buyAmount",
    stateMutability: "nonpayable",
    inputs: [
      { name: "digest", type: "bytes32" },
      { name: "nftId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sellAmount",
    stateMutability: "nonpayable",
    inputs: [
      { name: "digest", type: "bytes32" },
      { name: "nftId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Minimal ERC-20 $P ABI (for the raw balance + approval before deposit). */
export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;
