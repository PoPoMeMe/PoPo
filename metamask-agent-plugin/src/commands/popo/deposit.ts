import "../../lib/node-compat.js";
import {
  type CommandIO,
  InputFieldType,
  type InputSchema,
  PluginCommand,
  schemaToArgs,
  schemaToFlags,
} from "@metamask/agent-wallet/plugin";
import { formatEther, maxUint256, parseEther } from "viem";
import { CONTRACTS, ERC20_ABI, VAULT_ABI } from "../../lib/contracts.js";
import {
  activeAddress,
  encode,
  monadClient,
  submitThroughAgentWallet,
  type SubmitOutcome,
} from "../../lib/sdk.js";

const MAX = maxUint256;

const inputs = {
  amount: {
    type: InputFieldType.Text,
    flag: "amount",
    message: "Amount of $P to deposit into the trading vault",
    required: true,
    prompt: false,
    index: 0,
  },
  approveTrading: {
    type: InputFieldType.Boolean,
    flag: "approve-trading",
    message: "Also set the one-time ERC-6909 allowance so trades work immediately",
    required: false,
    prompt: false,
    default: true,
  },
} satisfies InputSchema;

type Step = { step: string; hash: string; explorer: string; status: string };
type DepositResult = {
  wallet: string;
  depositedP: string;
  steps: Step[];
};

/**
 * `mm popo deposit <amount>` — move raw ERC-20 $P into the PoPo internal vault
 * (mints ERC-6909 quote balance). Hatch buys and prediction buys spend THIS
 * balance. Every transaction is routed through the Agent Wallet executor.
 *
 * Flow (only sends what's needed):
 *   1. ERC-20 approve(diamond, max) once, so the vault can pull the deposit.
 *   2. deposit(quoteId=1, amount).
 *   3. (default) ERC-6909 approve(diamond, max) so the market/hatch facets can
 *      spend the internal balance on a later trade.
 */
export default class PoPoDepositCommand extends PluginCommand<DepositResult> {
  static override description =
    "Deposit ERC-20 $P into the PoPo trading vault (required once before buying meme coins or YES/NO shares).";
  static override examples = [
    "<%= config.bin %> popo deposit 25",
    "<%= config.bin %> popo deposit 100 --no-approve-trading",
  ];
  static override requiresAuth = true;
  static override flags = schemaToFlags(inputs);
  static override args = schemaToArgs(inputs);
  protected readonly pluginCommandId = "popo:deposit";

  async execute(io: CommandIO): Promise<DepositResult> {
    const { amount: amountStr, approveTrading } = await io.resolveInputs(inputs);
    const amount = parseEther(amountStr as string);
    const wallet = activeAddress(this);
    const client = monadClient(this);
    const diamond = CONTRACTS.diamond;
    const steps: Step[] = [];

    const push = (label: string, r: SubmitOutcome) =>
      steps.push({ step: label, hash: r.hash, explorer: r.explorer, status: r.status });

    // 1) ERC-20 allowance for deposit (only if short).
    const erc20Allowance = (await client.readContract({
      address: CONTRACTS.usdp,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [wallet, diamond],
    })) as bigint;
    if (erc20Allowance < amount) {
      const r = await submitThroughAgentWallet(
        this,
        io,
        "popo:deposit",
        encode("erc20", CONTRACTS.usdp, "approve", [diamond, MAX]),
        {
          title: "Approve $P for vault deposit",
          description: `Allow PoPo diamond ${diamond} to pull ${formatEther(amount)} $P for deposit.`,
        },
      );
      push("erc20-approve", r);
    }

    // 2) deposit(id=1, amount)
    {
      const r = await submitThroughAgentWallet(
        this,
        io,
        "popo:deposit",
        encode("vault", diamond, "deposit", [CONTRACTS.quoteTokenId, amount]),
        {
          title: "Deposit $P into PoPo vault",
          description: `Deposit ${formatEther(amount)} $P (mints internal ERC-6909 trading balance).`,
        },
      );
      push("deposit", r);
    }

    // 3) one-time ERC-6909 trading allowance (default on).
    if (approveTrading !== false) {
      const vaultAllowance = (await client.readContract({
        address: diamond,
        abi: VAULT_ABI,
        functionName: "allowance",
        args: [CONTRACTS.quoteTokenId, wallet, diamond],
      })) as bigint;
      if (vaultAllowance < amount) {
        const r = await submitThroughAgentWallet(
          this,
          io,
          "popo:deposit",
          encode("vault", diamond, "approve", [diamond, CONTRACTS.quoteTokenId, MAX]),
          {
            title: "Approve vault $P for trading",
            description: "One-time allowance so the Hatch/Market facets can spend your vault $P.",
          },
        );
        push("vault-6909-approve", r);
      }
    }

    return { wallet, depositedP: formatEther(amount), steps };
  }
}
