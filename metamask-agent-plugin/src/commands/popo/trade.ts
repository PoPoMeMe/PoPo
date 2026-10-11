import {
  type CommandIO,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { formatEther, isHex, maxUint256, parseEther } from "viem";
import {
  CONTRACTS,
  ERC20_ABI,
  HATCH_ABI,
  VAULT_ABI,
} from "../../lib/contracts.js";
import {
  activeAddress,
  encode,
  monadClient,
  submitThroughAgentWallet,
  type SubmitOutcome,
} from "../../lib/sdk.js";

// Default slippage tolerance when --min-out is omitted.
const DEFAULT_SLIPPAGE_BPS = 100n; // 1%

const inputs = {
  side: {
    type: InputFieldType.Select,
    flag: "side",
    message: "Buy or sell",
    required: true,
    prompt: false,
    index: 0,
    options: [
      { label: "buy", value: "buy" },
      { label: "sell", value: "sell" },
    ],
  },
  token: {
    type: InputFieldType.Text,
    flag: "token",
    message: "Hatch token id",
    required: true,
    prompt: false,
    index: 1,
  },
  amount: {
    type: InputFieldType.Text,
    flag: "amount",
    message: "Buy: $P to spend. Sell: number of meme tokens.",
    required: true,
    prompt: false,
    index: 2,
  },
  slippageBps: {
    type: InputFieldType.Text,
    flag: "slippage-bps",
    message: "Slippage tolerance in bps (default 100 = 1%)",
    required: false,
    prompt: false,
  },
  autoFund: {
    type: InputFieldType.Boolean,
    flag: "auto-fund",
    message: "Auto ERC-20 approve + deposit when vault $P is short (buy only)",
    required: false,
    prompt: false,
    default: true,
  },
} satisfies InputSchema;

type TradeResult = {
  side: "buy" | "sell";
  tokenId: string;
  amount: string;
  tx: SubmitOutcome;
};

/**
 * `mm popo trade <buy|sell> <tokenId> <amount>`
 *
 * Trade a Hatch bonding-curve meme coin on PoPo.meme (Monad testnet). Buys
 * spend internal vault $P (quoteId=1); sells return net $P to the vault. All
 * transactions go through the Agent Wallet executor (MFA + policy enforced).
 */
export default class PoPoTradeCommand extends PluginCommand<TradeResult> {
  static override description =
    "Buy or sell a Hatch meme coin on its bonding curve (Monad testnet), routed through Agent Wallet.";
  static override examples = [
    "<%= config.bin %> popo trade buy 3 10",
    "<%= config.bin %> popo trade sell 3 1000000000000000000 --slippage-bps 50",
  ];
  static override requiresAuth = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);
  protected readonly pluginCommandId = "popo:trade";

  async execute(io: CommandIO): Promise<TradeResult> {
    const v = await io.resolveInputs(inputs);
    const side = v.side as "buy" | "sell";
    const tokenId = BigInt(v.token as string);
    const wallet = activeAddress(this);
    const client = monadClient(this);
    const diamond = CONTRACTS.diamond;
    const slippage = v.slippageBps ? BigInt(v.slippageBps as string) : DEFAULT_SLIPPAGE_BPS;
    void isHex; // reserved for future address-based lookup

    if (side === "buy") {
      const spend = parseEther(v.amount as string);

      const [tokensOut] = (await client.readContract({
        address: diamond,
        abi: HATCH_ABI,
        functionName: "previewBuy",
        args: [tokenId, spend],
      })) as [bigint, bigint, bigint];
      const minOut = (tokensOut * (10_000n - slippage)) / 10_000n;

      await this.ensureVaultBalance(io, wallet, spend + (spend / 1000n) + 1n);
      await this.ensure6909Allowance(io, wallet, CONTRACTS.quoteTokenId, spend);

      const tx = await submitThroughAgentWallet(
        this,
        io,
        "popo:trade",
        encode("hatch", diamond, "buy", [tokenId, spend, minOut]),
        {
          title: `Buy Hatch token #${tokenId.toString()}`,
          description: `Spend ${formatEther(spend)} $P on the bonding curve (min ${minOut.toString()} out).`,
        },
      );
      return { side, tokenId: tokenId.toString(), amount: v.amount as string, tx };
    }

    // sell
    const tokenAmount = BigInt(v.amount as string);
    const [quoteOut] = (await client.readContract({
      address: diamond,
      abi: HATCH_ABI,
      functionName: "previewSell",
      args: [tokenId, tokenAmount],
    })) as [bigint, bigint, bigint];
    const minQuoteOut = (quoteOut * (10_000n - slippage)) / 10_000n;

    // Selling pulls the meme token (its own 6909 id = tokenId) from the trader.
    await this.ensure6909Allowance(io, wallet, tokenId, tokenAmount);

    const tx = await submitThroughAgentWallet(
      this,
      io,
      "popo:trade",
      encode("hatch", diamond, "sell", [tokenId, tokenAmount, minQuoteOut]),
      {
        title: `Sell Hatch token #${tokenId.toString()}`,
        description: `Sell ${tokenAmount.toString()} base units for ≥ ${formatEther(minQuoteOut)} $P to vault.`,
      },
    );
    return { side, tokenId: tokenId.toString(), amount: tokenAmount.toString(), tx };
  }

  /** Ensure the diamond can spend an internal ERC-6909 id (vault $P or token). */
  private async ensure6909Allowance(
    io: CommandIO,
    wallet: `0x${string}`,
    id: bigint,
    needed: bigint,
  ): Promise<void> {
    const client = monadClient(this);
    const diamond = CONTRACTS.diamond;
    const allowance = (await client.readContract({
      address: diamond,
      abi: VAULT_ABI,
      functionName: "allowance",
      args: [wallet, diamond, id],
    })) as bigint;
    if (allowance >= needed && allowance > 0n) return;
    await submitThroughAgentWallet(
      this,
      io,
      "popo:trade",
      encode("vault", diamond, "approve", [diamond, id, maxUint256]),
      {
        title: `Approve ERC-6909 id ${id.toString()} for trading`,
        description: "One-time allowance so the PoPo facet can move this internal balance.",
      },
    );
  }

  /** Top up the vault from raw ERC-20 $P when a buy's spend exceeds vault $P. */
  private async ensureVaultBalance(
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
      args: [wallet, CONTRACTS.quoteTokenId],
    })) as bigint;
    if (vaultBal >= need) return;

    const shortfall = need - vaultBal;
    const erc20Bal = (await client.readContract({
      address: CONTRACTS.usdp,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [wallet],
    })) as bigint;
    if (erc20Bal < shortfall) {
      throw new Error(
        `Need ${formatEther(need)} vault $P but hold ${formatEther(vaultBal)} vault + ${formatEther(
          erc20Bal,
        )} raw $P. Deposit or claim faucet $P first.`,
      );
    }

    const erc20Allow = (await client.readContract({
      address: CONTRACTS.usdp,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [wallet, diamond],
    })) as bigint;
    if (erc20Allow < shortfall) {
      await submitThroughAgentWallet(
        this,
        io,
        "popo:trade",
        encode("erc20", CONTRACTS.usdp, "approve", [diamond, maxUint256]),
        { title: "Approve $P for auto deposit", description: "Allow the vault to pull $P." },
      );
    }
    await submitThroughAgentWallet(
      this,
      io,
      "popo:trade",
      encode("vault", diamond, "deposit", [CONTRACTS.quoteTokenId, shortfall]),
      {
        title: `Deposit ${formatEther(shortfall)} $P into vault`,
        description: "Auto top-up so the Hatch buy can settle.",
      },
    );
  }
}
