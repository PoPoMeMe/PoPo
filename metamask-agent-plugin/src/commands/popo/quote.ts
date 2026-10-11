import "../../lib/node-compat.js";
import {
  type CommandIO,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { formatEther, isHex, parseEther } from "viem";
import { CONTRACTS, HATCH_ABI, MARKET_ABI } from "../../lib/contracts.js";
import { curveBuySum, curveSellSum, priceAt } from "../../lib/curve.js";
import { monadClient } from "../../lib/sdk.js";

const inputs = {
  kind: {
    type: InputFieldType.Select,
    flag: "kind",
    message: "What to quote",
    required: true,
    prompt: false,
    options: [
      { label: "YES/NO prediction shares", value: "predict" },
      { label: "Hatch meme coin", value: "hatch" },
    ],
  },
  market: {
    type: InputFieldType.Text,
    flag: "market",
    message: "Prediction market index or 0x… digest (kind=predict)",
    required: false,
    prompt: false,
  },
  side: {
    type: InputFieldType.Select,
    flag: "side",
    message: "Buy or sell",
    required: false,
    prompt: false,
    options: [
      { label: "buy", value: "buy" },
      { label: "sell", value: "sell" },
    ],
  },
  outcome: {
    type: InputFieldType.Select,
    flag: "outcome",
    message: "YES or NO (kind=predict)",
    required: false,
    prompt: false,
    options: [
      { label: "YES", value: "yes" },
      { label: "NO", value: "no" },
    ],
  },
  token: {
    type: InputFieldType.Text,
    flag: "token",
    message: "Hatch token id (kind=hatch)",
    required: false,
    prompt: false,
  },
  amount: {
    type: InputFieldType.Text,
    flag: "amount",
    message: "Amount (shares for predict; $P spend for hatch buy / tokens for hatch sell)",
    required: true,
    prompt: false,
  },
} satisfies InputSchema;

type QuoteResult = {
  kind: "predict" | "hatch";
  side: "buy" | "sell";
  amount: string;
  totalCostP?: string;
  payoutP?: string;
  tokenAmount?: string;
  feesP?: string;
  note: string;
};

/**
 * `mm popo quote <predict|hatch> … --amount N` — price a trade WITHOUT sending.
 * Prediction cost is computed on-chain via getMarket(targetSupply); Hatch uses
 * previewBuy/previewSell.
 */
export default class PoPoQuoteCommand extends PluginCommand<QuoteResult> {
  static override description =
    "Quote a prediction YES/NO share purchase or a Hatch meme-coin trade without submitting a transaction.";
  static override examples = [
    "<%= config.bin %> popo quote --kind predict --market 0 --outcome yes --amount 5",
    "<%= config.bin %> popo quote --kind predict --market 0x7fd5…3e52 --side sell --outcome no --amount 2",
    "<%= config.bin %> popo quote --kind hatch --token 3 --side buy --amount 10",
  ];
  // Pure quote/preview read: works unauthenticated (no wallet required). All
  // inputs are flags (no positional args): a required arg cannot follow an
  // optional positional arg in oclif, which these interleaved fields would do.
  static override requiresAuth = false;
  static override requiresInit = false;
  static override flags = schemaToFlags(inputs);
  static override args = {};
  protected readonly pluginCommandId = "popo:quote";

  async execute(io: CommandIO): Promise<QuoteResult> {
    const v = await io.resolveInputs(inputs);
    const client = monadClient(this);
    const side = (v.side as string) ?? "buy";

    if (v.kind === "predict") {
      const amount = BigInt(v.amount as string);
      if (!v.market) throw new Error("--market <index|digest> is required for a prediction quote.");
      const outcome = ((v.outcome as string) ?? "yes").toLowerCase();

      let digest: `0x${string}`;
      if (isHex(v.market as string) && (v.market as string).length === 66) {
        digest = v.market as `0x${string}`;
      } else {
        const [found] = (await client.readContract({
          address: CONTRACTS.diamond,
          abi: MARKET_ABI,
          functionName: "getMarketList",
          args: [BigInt(v.market as string), 1n],
        })) as readonly `0x${string}`[];
        if (!found) throw new Error(`No market at index ${v.market as string}.`);
        digest = found;
      }

      const [market] = (await client.readContract({
        address: CONTRACTS.diamond,
        abi: MARKET_ABI,
        functionName: "getMarket",
        args: [digest, 0n],
      })) as unknown as [
        { yesNftId: bigint; noNftId: bigint; yesSupply: bigint; noSupply: bigint; k: bigint; c: bigint },
        unknown,
      ];

      if (side === "buy") {
        const supply = outcome === "yes" ? market.yesSupply : market.noSupply;
        // targetSupply = supply + amount => price of the LAST share bought.
        const lastPrice = priceAt(market.k, market.c, supply + amount);

        // Exact total = sum over every curve point (floor sqrt, matches chain).
        const total = curveBuySum(market.k, market.c, supply, amount);
        return {
          kind: "predict",
          side: "buy",
          amount: amount.toString(),
          totalCostP: formatEther(total),
          note: `Last-share price ${formatEther(lastPrice)} $P at supply ${(
            supply + amount
          ).toString()}; k·√supply + c summed over ${amount.toString()} shares (buy fee included in fill price).`,
        };
      }

      // Sell: on-chain prices supplies [supply-amount+1 .. supply], i.e. the
      // top `amount` curve points, then applies the doubled sell fee.
      const supply = outcome === "yes" ? market.yesSupply : market.noSupply;
      if (amount > supply) throw new Error(`Only ${supply.toString()} shares outstanding on that side.`);
      const gross = curveSellSum(market.k, market.c, supply, amount);
      return {
        kind: "predict",
        side: "sell",
        amount: amount.toString(),
        payoutP: formatEther(gross),
        note: "Gross redemption before the doubled on-chain sell fee; the settled amount is slightly lower.",
      };
    }

    // Hatch quote
    if (!v.token) throw new Error("--token <id> is required for a Hatch quote.");
    const tokenId = BigInt(v.token as string);
    if (side === "buy") {
      const spend = parseEther(v.amount as string);
      const [tokenAmount, platformFee, creatorFee] = (await client.readContract({
        address: CONTRACTS.diamond,
        abi: HATCH_ABI,
        functionName: "previewBuy",
        args: [tokenId, spend],
      })) as [bigint, bigint, bigint];
      return {
        kind: "hatch",
        side: "buy",
        amount: v.amount as string,
        tokenAmount: tokenAmount.toString(),
        feesP: formatEther(platformFee + creatorFee),
        note: "Spend is $P from your internal vault balance; amount is raw ERC-6909 meme-token units.",
      };
    }

    const tokenAmount = BigInt(v.amount as string);
    const [quoteOut, platformFee, creatorFee] = (await client.readContract({
      address: CONTRACTS.diamond,
      abi: HATCH_ABI,
      functionName: "previewSell",
      args: [tokenId, tokenAmount],
    })) as [bigint, bigint, bigint];
    return {
      kind: "hatch",
      side: "sell",
      amount: tokenAmount.toString(),
      payoutP: formatEther(quoteOut),
      feesP: formatEther(platformFee + creatorFee),
      note: "Net $P returned to your internal vault balance after fees.",
    };
  }
}
