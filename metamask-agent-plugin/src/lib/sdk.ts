import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { createPublicClient, encodeFunctionData, fallback, http, type Abi, type Address, type PublicClient } from "viem";
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
  const addr = optionalAddress(cmd);
  if (!addr) throw new Error("No active Agent Wallet found. Run `mm login` / `mm wallet` setup first.");
  return addr;
}

/**
 * Best-effort active address for read-only commands that work without a wallet.
 * Returns null instead of throwing when no Agent Wallet is configured.
 */
export function optionalAddress(cmd: PluginCommand<unknown, unknown>): Address | null {
  try {
    const state = cmd.ctx.walletStateManager.read() as {
      selectedWallet?: {
        address?: string;
        ref?: { address?: string; _?: unknown };
      };
      remoteWallets?: { address?: string }[];
      byokWallets?: { address?: string }[];
    };

    const selectedRef = state.selectedWallet?.ref;
    const selectedAddress =
      state.selectedWallet?.address ??
      (selectedRef && !Array.isArray(selectedRef) ? selectedRef.address : undefined);

    const addr =
      selectedAddress ??
      state.remoteWallets?.find((w) => w.address)?.address ??
      state.byokWallets?.find((w) => w.address)?.address;
    cmd.ctx.logger?.debug?.(
      `popo active wallet state: selected=${JSON.stringify(state.selectedWallet ?? null)} remote=${state.remoteWallets?.length ?? 0} byok=${state.byokWallets?.length ?? 0} resolved=${addr ?? "null"}`,
    );
    return (addr as Address | undefined) ?? null;
  } catch (error) {
    cmd.ctx.logger?.debug?.(`popo active wallet read failed: ${String(error)}`);
    return null;
  }
}

/**
 * Read-only viem client for Monad testnet. We deliberately do NOT use
 * `cmd.ctx.publicClient(...)` for reads: the host gateway RPC needs a logged-in
 * project id, while public market data should be reachable without login. Uses
 * the public RPC list (Alchemy/custom via POPO_MONAD_RPC_URL) with failover.
 * (The `cmd` arg is kept for API stability and a future authenticated path.)
 */
export function monadClient(_cmd?: PluginCommand<unknown, unknown>): PublicClient {
  return createPublicClient({
    chain: {
      id: CONTRACTS.chainId,
      name: "Monad Testnet",
      nativeCurrency: { name: "Testnet MON Token", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [...CONTRACTS.rpcUrls] } },
    },
    transport: fallback(CONTRACTS.rpcUrls.map((url) => http(url))),
  }) as PublicClient;
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

export type PoPoAuthTypedData = {
  domain: { name: string; version: string; chainId: number };
  types: {
    EIP712Domain: readonly { name: string; type: string }[];
    PoPoAuth: readonly { name: string; type: string }[];
  };
  primaryType: "PoPoAuth";
  message: {
    action: string;
    wallet: Address;
    timestamp: string;
    payload: string;
  };
};

/** Byte-identical to app/supabase/functions/_shared/auth.ts. */
export function buildPoPoAuthTypedData(input: {
  address: Address;
  timestampMs: number;
  payload: Record<string, unknown>;
}): PoPoAuthTypedData {
  return {
    domain: {
      name: "PoPo.meme",
      version: "1",
      chainId: CONTRACTS.chainId,
    },
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      PoPoAuth: [
        { name: "action", type: "string" },
        { name: "wallet", type: "address" },
        { name: "timestamp", type: "uint256" },
        { name: "payload", type: "string" },
      ],
    },
    primaryType: "PoPoAuth",
    message: {
      action: "testnet-faucet-claim",
      wallet: input.address,
      timestamp: String(input.timestampMs),
      payload: JSON.stringify(input.payload, Object.keys(input.payload).sort()),
    },
  };
}

/** Ask Agent Wallet to sign an off-chain EIP-712 authorization. */
export async function signThroughAgentWallet(
  cmd: PluginCommand<unknown, unknown>,
  io: CommandIO,
  source: string,
  typedData: PoPoAuthTypedData,
  intent: { title: string; description: string },
): Promise<{ signature: string; status: string }> {
  const executor = await cmd.ctx.walletExecutor(io, source);
  const result = await executor(
    {
      // The Agent SDK's enum value is the literal "typed-data".
      kind: "typed-data" as const,
      chainId: CONTRACTS.chainId,
      typedData,
      intent,
      wait: true,
    },
    { signal: io.signal },
  );

  if (result.kind !== "signature" || !result.signature) {
    throw new Error(
      `Typed-data signature not completed (status=${result.status}${
        (result as { failureDescription?: string }).failureDescription
          ? `, ${(result as { failureDescription?: string }).failureDescription}`
          : ""
      }). Approve the Agent Wallet request and retry.`,
    );
  }

  return { signature: result.signature, status: result.status };
}

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
  const client = monadClient(cmd);
  const from = activeAddress(cmd);

  // Agent Wallet remote signing is EIP-1559 only (no legacy gasPrice). Its
  // hosted GasFeeController rejects Monad testnet (10143) with "Invalid
  // chainId" before signing, so we supply BOTH max fees and an explicit gas
  // limit sourced from the public RPC (configured for 10143 via
  // customEvmChains, see README). Base fee comes from the latest block; the
  // tip is a small fixed value. This makes the host skip its hosted gas
  // estimate for the unsupported chain.
  const block = await client.getBlock();
  const baseFee = block.baseFeePerGas ?? (await client.getGasPrice());
  const maxPriorityFeePerGas = 2_000_000_000n; // 2 gwei tip
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
  let gas: bigint;
  try {
    const estimated = await client.estimateGas({
      account: from,
      to: tx.to,
      data: tx.data,
      value: 0n,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
    gas = (estimated * 13n) / 10n; // +30% buffer for batch/approve variance
  } catch (error) {
    cmd.ctx.logger?.warn?.(`popo gas estimation failed, using fallback: ${String(error)}`);
    gas = 1_000_000n;
  }

  const result = await executor(
    {
      kind: "transaction",
      chainId: CONTRACTS.chainId,
      transaction: {
        from,
        to: tx.to,
        data: tx.data,
        value: 0n,
        maxFeePerGas,
        maxPriorityFeePerGas,
        // MetaMask TxController keys the limit as `gas`; include gasLimit too
        // in case the SDK normalizes either shape.
        gas,
        gasLimit: gas,
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
