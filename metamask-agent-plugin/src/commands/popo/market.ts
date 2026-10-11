import "../../lib/node-compat.js";
import {
  type CommandIO,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { formatEther, isHex } from "viem";
import { CONTRACTS, MARKET_ABI } from "../../lib/contracts.js";
import { monadClient } from "../../lib/sdk.js";

type MarketDetail = [
  {
    digest: `0x${string}`;
    resultNftId: bigint;
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
    rewardTotalAmount: bigint;
  },
  { targetSupplyPrice: bigint; currentYesPrice: bigint; currentNoPrice: bigint },
];

async function readMarket(
  client: ReturnType<typeof monadClient>,
  digest: `0x${string}`,
): Promise<MarketDetail> {
  return (await client.readContract({
    address: CONTRACTS.diamond,
    abi: MARKET_ABI,
    functionName: "getMarket",
    args: [digest, 0n],
  })) as unknown as MarketDetail;
}

const inputs = {
  market: {
    type: InputFieldType.Text,
    flag: "market",
    message: "Market index (0-based) or 0x… digest",
    required: true,
    prompt: false,
    index: 0,
  },
} satisfies InputSchema;

type MarketDetailResult = {
  digest: string;
  enabled: boolean;
  ended: boolean;
  finalized: boolean;
  yes: { nftId: string; supply: string; nextPriceP: string };
  no: { nftId: string; supply: string; nextPriceP: string };
  feeBps: string;
  potP: string;
  accruedFeesP: string;
  rewardPoolP: string;
};

/** `mm popo market <index|digest>` — full detail for one prediction market. */
export default class PoPoMarketCommand extends PluginCommand<MarketDetailResult> {
  static override description = "Show one PoPo.meme prediction market (by index or digest).";
  static override examples = [
    "<%= config.bin %> popo market 0",
    "<%= config.bin %> popo market 0x7fd5…3e52",
    "<%= config.bin %> popo market 0 --json",
  ];
  // Pure on-chain read: works unauthenticated (no wallet required).
  static override requiresAuth = false;
  static override requiresInit = false;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);
  protected readonly pluginCommandId = "popo:market";

  async execute(io: CommandIO): Promise<MarketDetailResult> {
    const { market: ref } = await io.resolveInputs(inputs);
    const client = monadClient(this);

    let digest: `0x${string}`;
    if (isHex(ref) && ref.length === 66) {
      digest = ref as `0x${string}`;
    } else {
      const index = BigInt(ref);
      const [found] = (await client.readContract({
        address: CONTRACTS.diamond,
        abi: MARKET_ABI,
        functionName: "getMarketList",
        args: [index, 1n],
      })) as readonly `0x${string}`[];
      if (!found) throw new Error(`No market at index ${ref}.`);
      digest = found;
    }

    const [m, p] = await readMarket(client, digest);
    return {
      digest,
      enabled: m.isEnabled,
      ended: m.isEnded,
      finalized: m.isFinalized,
      yes: {
        nftId: m.yesNftId.toString(),
        supply: m.yesSupply.toString(),
        nextPriceP: formatEther(p.currentYesPrice),
      },
      no: {
        nftId: m.noNftId.toString(),
        supply: m.noSupply.toString(),
        nextPriceP: formatEther(p.currentNoPrice),
      },
      feeBps: m.platformFeeBps.toString(),
      potP: formatEther(m.poolTotalAmount),
      accruedFeesP: formatEther(m.platformFeeAmount),
      rewardPoolP: formatEther(m.rewardTotalAmount),
    };
  }
}
