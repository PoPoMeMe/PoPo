import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { formatEther } from "viem";
import { CONTRACTS, MARKET_ABI } from "../../lib/contracts.js";
import { activeAddress, monadClient } from "../../lib/sdk.js";

type OnchainMarket = {
  digest: `0x${string}`;
  resultNftId: bigint;
  rewardERC20Token: `0x${string}`;
  rewardTotalAmount: bigint;
  yesNftId: bigint;
  noNftId: bigint;
  isEnabled: boolean;
  isEnded: boolean;
  isFinalized: boolean;
  yesSupply: bigint;
  noSupply: bigint;
  k: bigint;
  c: bigint;
  poolTotalAmount: bigint;
  platformFeeBps: bigint;
  platformFeeAmount: bigint;
  rewardTotalPayout: bigint;
  pcPayout: bigint;
  ptTokenPayout: bigint;
};

type PriceMeta = {
  targetSupplyPrice: bigint;
  currentYesPrice: bigint;
  currentNoPrice: bigint;
};

type MarketRow = {
  index: number;
  digest: string;
  yesNftId: string;
  noNftId: string;
  yesSupply: string;
  noSupply: string;
  yesPriceP: string;
  noPriceP: string;
  poolTotalP: string;
  enabled: boolean;
  ended: boolean;
};

type MarketsResult = {
  chainId: number;
  diamond: string;
  total: number;
  activeWallet: string;
  markets: MarketRow[];
};

/**
 * `mm popo markets` — list every prediction market on PoPo.meme (Monad
 * testnet) with live YES/NO supplies, next-share price and pot size. Read-only.
 */
export default class PoPoMarketsCommand extends PluginCommand<MarketsResult> {
  static override description =
    "List PoPo.meme YES/NO prediction markets on Monad testnet with live prices and pot size.";

  static override examples = [
    "<%= config.bin %> popo markets",
    "<%= config.bin %> popo markets --json",
  ];

  static override requiresAuth = true;

  protected readonly pluginCommandId = "popo:markets";

  async execute(_io: CommandIO): Promise<MarketsResult> {
    const wallet = activeAddress(this);
    const client = monadClient(this);

    const total = (await client.readContract({
      address: CONTRACTS.diamond,
      abi: MARKET_ABI,
      functionName: "totalMarket",
    })) as bigint;

    const totalNum = Number(total);
    const digests =
      totalNum === 0
        ? []
        : ((await client.readContract({
            address: CONTRACTS.diamond,
            abi: MARKET_ABI,
            functionName: "getMarketList",
            args: [0n, total],
          })) as readonly `0x${string}`[]);

    const markets: MarketRow[] = [];
    for (let i = 0; i < digests.length; i++) {
      const digest = digests[i];
      const [market, price] = (await client.readContract({
        address: CONTRACTS.diamond,
        abi: MARKET_ABI,
        functionName: "getMarket",
        // targetSupply 0 => price quote at supply 0; we show next-share prices.
        args: [digest, 0n],
      })) as [OnchainMarket, PriceMeta];

      markets.push({
        index: i,
        digest,
        yesNftId: market.yesNftId.toString(),
        noNftId: market.noNftId.toString(),
        yesSupply: market.yesSupply.toString(),
        noSupply: market.noSupply.toString(),
        yesPriceP: formatEther(price.currentYesPrice),
        noPriceP: formatEther(price.currentNoPrice),
        poolTotalP: formatEther(market.poolTotalAmount),
        enabled: market.isEnabled,
        ended: market.isEnded,
      });
    }

    return {
      chainId: CONTRACTS.chainId,
      diamond: CONTRACTS.diamond,
      total: totalNum,
      activeWallet: wallet,
      markets,
    };
  }
}
