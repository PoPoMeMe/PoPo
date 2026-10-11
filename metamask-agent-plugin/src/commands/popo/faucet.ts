import "../../lib/node-compat.js";
import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { getAddress } from "viem";
import { CONTRACTS } from "../../lib/contracts.js";
import {
  activeAddress,
  buildPoPoAuthTypedData,
  signThroughAgentWallet,
} from "../../lib/sdk.js";

type FaucetResult = {
  wallet: string;
  chainId: number;
  amountP: string;
  txHash?: string;
  recipient?: string;
  status?: unknown;
};

/**
 * `mm popo faucet` — claim PoPo's testnet $P drip through the existing
 * Supabase Edge Function. The drip is minted by the platform hot wallet, so
 * the Agent Wallet needs no gas for this step. The Agent Wallet still signs
 * the replay-protected PoPoAuth EIP-712 authorization, proving address control.
 */
export default class PoPoFaucetCommand extends PluginCommand<FaucetResult> {
  static override description =
    "Claim PoPo testnet $P on Monad testnet via an Agent Wallet-approved PoPoAuth signature (no gas needed for the drip).";
  static override examples = ["<%= config.bin %> popo faucet", "<%= config.bin %> popo faucet --json"];
  static override requiresAuth = true;
  protected readonly pluginCommandId = "popo:faucet";

  async execute(io: CommandIO): Promise<FaucetResult> {
    const wallet = getAddress(activeAddress(this));
    const timestampMs = Date.now();
    const payload = { chainId: CONTRACTS.chainId };
    const typedData = buildPoPoAuthTypedData({ address: wallet, timestampMs, payload });

    const { signature, status: signStatus } = await signThroughAgentWallet(
      this,
      io,
      "popo:faucet",
      typedData,
      {
        title: "Claim PoPo Monad testnet $P",
        description:
          "Sign PoPoAuth to claim the once-daily testnet $P drip. This is not a transaction and cannot move funds.",
      },
    );

    const response = await fetch(CONTRACTS.faucetFunctionUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: wallet.toLowerCase(),
        timestampMs,
        timestamp: timestampMs,
        signature,
        domainChainId: CONTRACTS.chainId,
        ...payload,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        `Faucet claim failed: HTTP ${response.status} ${JSON.stringify(data)}`,
      );
    }

    return {
      wallet,
      chainId: CONTRACTS.chainId,
      amountP: String((data as { amountP?: string }).amountP ?? ""),
      txHash: (data as { txHash?: string }).txHash,
      recipient: (data as { recipient?: string }).recipient,
      status: { signStatus, response: data },
    };
  }
}
