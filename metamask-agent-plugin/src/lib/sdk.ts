import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { encodeFunctionData, type Abi, type Address } from "viem";
import {
  CONTRACTS,
  ERC20_ABI,
  HATCH_ABI,
  MARKET_ABI,
  VAULT_ABI,
  txUrl,
} from "./contracts.js";

/** Resolve the active EVM wallet address from the Agent Wallet state. */
export function activeAddress(cmd: PluginCommand<unknown, unknown>): Address {
  const state = cmd.ctx.walletStateManager.read();
  const addr = [...state.byokWallets, ...state.remoteWallets][0]?.address;
  if (!addr) throw new Error("No active Agent Wallet found. Run `mm wallet` setup first.");
  return addr as Address;
}

/** Authenticated viem public client for Monad testnet (host-managed RPC). */
export function monadClient(cmd: PluginCommand<unknown, unknown>) {
  return cmd.ctx.publicClient(CONTRACTS.chainId);
}

export type AbiName = "erc20" | "vault" | "hatch" | "market";

const ABIS: Record<AbiName, Abi> = {
  erc20: ERC20_ABI as unknown as Abi,
  vault: VAULT_ABI as unknown as Abi,
  hatch: HATCH_ABI as unknown as Abi,
  market: MARKET_ABI as unknown as Abi,
};

export type PreparedTx = {
  to: Address;
  data: `0x${string}`;
};

/** Encode a diamond/ERC-20 call without sending it. */
export function encode(
  abiName: AbiName,
  to: Address,
  fn: string,
  args: readonly unknown[],
): PreparedTx {
  const data = encodeFunctionData({
    abi: ABIS[abiName],
    functionName: fn,
    args,
  });
  return { to, data };
}

export type SubmitOutcome = {
  hash: string;
  status: string;
  explorer: string;
};

/**
 * Submit ONE transaction through the MetaMask Agent Wallet executor.
 *
 * This is the only path that moves funds: it goes through the Agent Wallet, so
 * the host enforces MFA + allow/policy rules. The plugin never touches a
 * private key or an external signer — `executor` handles both BYOK and
 * server-wallet modes.
 */
export async function submitThroughAgentWallet(
  cmd: PluginCommand<unknown, unknown>,
  io: CommandIO,
  source: string,
  tx: PreparedTx,
  intent: { title: string; description: string },
): Promise<SubmitOutcome> {
  const executor = await cmd.ctx.walletExecutor(io, source);
  const result = await executor(
    {
      kind: "transaction",
      chainId: CONTRACTS.chainId,
      transaction: {
        to: tx.to,
        data: tx.data,
        value: 0n,
      },
      intent,
    },
    { waitForReceipt: true },
  );

  if (result.kind !== "transaction" || !result.hash) {
    const code = (result as { failureCode?: string }).failureCode;
    const desc = (result as { failureDescription?: string }).failureDescription;
    throw new Error(
      `Transaction not submitted (status=${result.status}${code ? `, code=${code}` : ""}${
        desc ? `, ${desc}` : ""
      }). If it is awaiting approval, run \`mm wallet requests\` to approve it.`,
    );
  }

  return { hash: result.hash, status: result.status, explorer: txUrl(result.hash) };
}
