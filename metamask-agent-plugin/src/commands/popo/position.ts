import "../../lib/node-compat.js";
import {
  type CommandIO,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { isHex } from "viem";
import { CONTRACTS, MARKET_ABI } from "../../lib/contracts.js";
import { activeAddress, monadClient } from "../../lib/sdk.js";

const inputs = {
  market: {
    type: InputFieldType.Text,
    flag: "market",
    message: "Market index (0-based) or 0x… digest",
    required: false,
    prompt: false,
    index: 0,
  },
} satisfies InputSchema;

type Position = {
  digest: string;
  yesShares: string;
  noShares: string;
};

type PositionResult = {
  wallet: string;
  positions: Position[];
};

/** `mm popo position [market]` — your YES/NO share balances (soulbound ERC-6909). */
export default class PoPoPositionCommand extends PluginCommand<PositionResult> {
  static override description =
    "Show your YES/NO prediction shares across all markets (or one market).";
  static override examples = [
    "<%= config.bin %> popo position",
    "<%= config.bin %> popo position 0",
    "<%= config.bin %> popo position 0x7fd5…3e52 --json",
  ];
  static override requiresAuth = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);
  protected readonly pluginCommandId = "popo:position";

  async execute(io: CommandIO): Promise<PositionResult> {
    const { market: ref } = await io.resolveInputs(inputs);
    const wallet = activeAddress(this);
    const client = monadClient(this);

    const resolveDigest = async (index: bigint): Promise<`0x${string}`> => {
      const [found] = (await client.readContract({
        address: CONTRACTS.diamond,
        abi: MARKET_ABI,
        functionName: "getMarketList",
        args: [index, 1n],
      })) as readonly `0x${string}`[];
      if (!found) throw new Error(`No market at index ${index}.`);
      return found;
    };

    let digests: `0x${string}`[];
    if (ref) {
      digests = [isHex(ref) && ref.length === 66 ? (ref as `0x${string}`) : await resolveDigest(BigInt(ref))];
    } else {
      const total = (await client.readContract({
        address: CONTRACTS.diamond,
        abi: MARKET_ABI,
        functionName: "totalMarket",
      })) as bigint;
      digests =
        total === 0n
          ? []
          : ([...(await client.readContract({
              address: CONTRACTS.diamond,
              abi: MARKET_ABI,
              functionName: "getMarketList",
              args: [0n, total],
            }))] as `0x${string}`[]);
    }

    const positions: Position[] = [];
    for (const digest of digests) {
      const [market] = (await client.readContract({
        address: CONTRACTS.diamond,
        abi: MARKET_ABI,
        functionName: "getMarket",
        args: [digest, 0n],
      })) as unknown as [{ yesNftId: bigint; noNftId: bigint }, unknown];

      const [yesShares, noShares] = await Promise.all([
        client.readContract({
          address: CONTRACTS.diamond,
          abi: MARKET_ABI,
          functionName: "balanceOf",
          args: [market.yesNftId, wallet],
        }) as Promise<bigint>,
        client.readContract({
          address: CONTRACTS.diamond,
          abi: MARKET_ABI,
          functionName: "balanceOf",
          args: [market.noNftId, wallet],
        }) as Promise<bigint>,
      ]);

      if (yesShares > 0n || noShares > 0n) {
        positions.push({
          digest,
          yesShares: yesShares.toString(),
          noShares: noShares.toString(),
        });
      }
    }

    return { wallet, positions };
  }
}
