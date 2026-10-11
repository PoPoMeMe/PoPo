import "../../lib/node-compat.js";
import {
  type CommandIO,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { formatEther, isHex, maxUint256 } from "viem";
import { CONTRACTS, MARKET_ABI, VAULT_ABI } from "../../lib/contracts.js";
import { curveBuySum } from "../../lib/curve.js";
import {
  activeAddress,
  encode,
  monadClient,
  submitThroughAgentWallet,
  type SubmitOutcome,
} from "../../lib/sdk.js";

const MAX_BATCH = 500n;

const inputs = {
  side: {
    type: InputFieldType.Select,
    flag: "side",
    message: "Buy or sell shares",
    required: true,
    prompt: false,
    index: 0,
    options: [
      { label: "buy", value: "buy" },
      { label: "sell", value: "sell" },
    ],
  },
  market: {
    type: InputFieldType.Text,
    flag: "market",
    message: "Market index (0-based) or 0x… digest",
    required: true,
    prompt: false,
    index: 1,
  },
  outcome: {
    type: InputFieldType.Select,
    flag: "outcome",
    message: "YES or NO",
    required: true,
    prompt: false,
    index: 2,
    options: [
      { label: "YES", value: "yes" },
      { label: "NO", value: "no" },
    ],
  },
  amount: {
    type: InputFieldType.Text,
    flag: "amount",
    message: "Number of shares",
    required: true,
    prompt: false,
    index: 3,
  },
  autoFund: {
    type: InputFieldType.Boolean,
    flag: "auto-fund",
    message:
      "If vault $P is short for a buy, send the extra transactions needed (ERC-20 approve + deposit)",
    required: false,
    prompt: false,
    default: true,
  },
} satisfies InputSchema;

type PredictResult = {
  side: "buy" | "sell";
  digest: string;
  outcome: "yes" | "no";
  shares: string;
  tx: SubmitOutcome;
  vaultBalancePBefore: string;
};

/**
 * `mm popo predict <buy|sell> <index|digest> <yes|no> <shares>`
 *
 * Trade YES/NO prediction shares on PoPo.meme (Monad testnet). Buys price each
 * share at its own k·√supply + c curve point (exact summed cost) and spend the
 * trader's INTERNAL vault $P. This command:
 *   - resolves the market + side nft id,
 *   - (buy) computes the exact cost from on-chain supplies and, if the vault
 *     balance is short AND --auto-fund is set, performs ERC-20 approve +
 *     deposit to top it up,
 *   - ensures the one-time ERC-6909 allowance,
 *   - submits buyAmount / sellAmount through the Agent Wallet executor.
 */
export default class PoPoPredictCommand extends PluginCommand<PredictResult> {
  static override description =
    "Buy or sell YES/NO prediction shares on a PoPo.meme market (Monad testnet), routed through Agent Wallet.";
  static override examples = [
    "<%= config.bin %> popo predict buy 0 yes 5",
    "<%= config.bin %> popo predict sell 0x7fd5…3e52 no 2",
    "<%= config.bin %> popo predict buy 0 yes 10 --no-auto-fund",
  ];
  static override requiresAuth = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);
  protected readonly pluginCommandId = "popo:predict";

  async execute(io: CommandIO): Promise<PredictResult> {
    const v = await io.resolveInputs(inputs);
    const side = v.side as "buy" | "sell";
    const outcome = v.outcome as "yes" | "no";
    const amount = BigInt(v.amount as string);
    if (amount <= 0n) throw new Error("Amount must be > 0.");
    if (amount > MAX_BATCH) throw new Error(`Amount exceeds on-chain MAX_BATCH (${MAX_BATCH}).`);

    const wallet = activeAddress(this);
    const client = monadClient(this);
    const diamond = CONTRACTS.diamond;

    // Resolve digest.
    let digest: `0x${string}`;
    if (isHex(v.market as string) && (v.market as string).length === 66) {
      digest = v.market as `0x${string}`;
    } else {
      const [found] = (await client.readContract({
        address: diamond,
        abi: MARKET_ABI,
        functionName: "getMarketList",
        args: [BigInt(v.market as string), 1n],
      })) as readonly `0x${string}`[];
      if (!found) throw new Error(`No market at index ${v.market as string}.`);
      digest = found;
    }

    const [market] = (await client.readContract({
      address: diamond,
      abi: MARKET_ABI,
      functionName: "getMarket",
      args: [digest, 0n],
    })) as unknown as [
      {
        yesNftId: bigint;
        noNftId: bigint;
        yesSupply: bigint;
        noSupply: bigint;
        k: bigint;
        c: bigint;
        isEnabled: boolean;
        isEnded: boolean;
      },
      unknown,
    ];
    if (!market.isEnabled) throw new Error("Market is not enabled.");
    if (market.isEnded) throw new Error("Market has ended.");

    const nftId = outcome === "yes" ? market.yesNftId : market.noNftId;
    const supply = outcome === "yes" ? market.yesSupply : market.noSupply;
    if (side === "sell" && amount > supply) {
      throw new Error(`Only ${supply.toString()} ${outcome.toUpperCase()} shares exist.`);
    }

    const vaultBefore = (await client.readContract({
      address: diamond,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [CONTRACTS.quoteTokenId, wallet],
    })) as bigint;

    if (side === "buy") {
      // Exact summed cost over the next `amount` curve points. Fees are already
      // included in the on-chain curve fill price; add 0.1% headroom so the
      // internal transfer never under-pays on rounding.
      const exact = curveBuySum(market.k, market.c, supply, amount);
      const need = exact + (exact / 1000n) + 1n;
      await this.ensureFunded(io, wallet, need);
    }

    // One-time ERC-6909 trading allowance.
    await this.ensureVaultAllowance(io, wallet);

    const fn = side === "buy" ? "buyAmount" : "sellAmount";
    const tx = await submitThroughAgentWallet(
      this,
      io,
      "popo:predict",
      encode("market", diamond, fn, [digest, nftId, amount]),
      {
        title: `${side === "buy" ? "Buy" : "Sell"} ${amount} ${outcome.toUpperCase()} shares`,
        description: `PoPo.meme prediction market ${digest.slice(0, 10)}… on Monad testnet.`,
      },
    );

    return {
      side,
      digest,
      outcome,
      shares: amount.toString(),
      tx,
      vaultBalancePBefore: formatEther(vaultBefore),
    };
  }

  /** Ensure the diamond can spend the trader's internal vault $P (max, once). */
  private async ensureVaultAllowance(io: CommandIO, wallet: `0x${string}`): Promise<void> {
    const client = monadClient(this);
    const diamond = CONTRACTS.diamond;
    const allowance = (await client.readContract({
      address: diamond,
      abi: VAULT_ABI,
      functionName: "allowance",
      args: [CONTRACTS.quoteTokenId, wallet, diamond],
    })) as bigint;
    if (allowance >= maxUint256 / 2n) return;
    await submitThroughAgentWallet(
      this,
      io,
      "popo:predict",
      encode("vault", diamond, "approve", [diamond, CONTRACTS.quoteTokenId, maxUint256]),
      {
        title: "Approve vault $P for prediction trades",
        description: "One-time ERC-6909 allowance for the PoPo market facet.",
      },
    );
  }

  /**
   * Top up the internal vault when a buy needs more $P than it holds. Only fires
   * when --auto-fund is set (default). Performs ERC-20 approve + deposit.
   */
  private async ensureFunded(
    io: CommandIO,
    wallet: `0x${string}`,
    need: bigint,
  ): Promise<void> {
    const client = monadClient(this);
    const diamond = CONTRACTS.diamond;
    const vaultBal = (await client.readContract({
      address: diamond,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [CONTRACTS.quoteTokenId, wallet],
    })) as bigint;
    if (vaultBal >= need) return;

    const shortfall = need - vaultBal;
    const erc20 = (await client.readContract({
      address: CONTRACTS.usdp,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "a", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [wallet],
    })) as bigint;
    if (erc20 < shortfall) {
      throw new Error(
        `Need ${formatEther(need)} vault $P but wallet only has ${formatEther(erc20)} raw $P ` +
          `and vault holds ${formatEther(vaultBal)}. Claim test $P from the faucet first.`,
      );
    }

    const erc20Allow = (await client.readContract({
      address: CONTRACTS.usdp,
      abi: [
        {
          type: "function",
          name: "allowance",
          stateMutability: "view",
          inputs: [
            { name: "o", type: "address" },
            { name: "s", type: "address" },
          ],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "allowance",
      args: [wallet, diamond],
    })) as bigint;
    if (erc20Allow < shortfall) {
      await submitThroughAgentWallet(
        this,
        io,
        "popo:predict",
        encode("erc20", CONTRACTS.usdp, "approve", [diamond, maxUint256]),
        { title: "Approve $P for auto deposit", description: "Allow the vault to pull $P." },
      );
    }
    await submitThroughAgentWallet(
      this,
      io,
      "popo:predict",
      encode("vault", diamond, "deposit", [CONTRACTS.quoteTokenId, shortfall]),
      {
        title: `Deposit ${formatEther(shortfall)} $P into vault`,
        description: "Auto top-up so the prediction buy can settle.",
      },
    );
  }
}
