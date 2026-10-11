import "../../lib/node-compat.js";
import { type CommandIO, PluginCommand } from "@metamask/agent-wallet/plugin";
import { formatEther } from "viem";
import { CONTRACTS, ERC20_ABI, VAULT_ABI } from "../../lib/contracts.js";
import { activeAddress, monadClient } from "../../lib/sdk.js";

type VaultResult = {
  chainId: number;
  wallet: string;
  /** Raw ERC-20 $P held by the wallet (not yet deposited). */
  erc20BalanceP: string;
  /** $P the diamond is allowed to pull on deposit (ERC-20 allowance). */
  erc20AllowanceP: string;
  /** Internal vault $P (ERC-6909 id 1) — this is what trading spends. */
  vaultBalanceP: string;
  /** Internal vault spend allowance granted to the diamond (for trades). */
  vaultAllowanceP: string;
};

/**
 * `mm popo vault` — show wallet $P (raw ERC-20) and internal vault $P.
 * Trades spend the INTERNAL vault balance, so run `mm popo deposit` first.
 */
export default class PoPoVaultCommand extends PluginCommand<VaultResult> {
  static override description =
    "Show your raw ERC-20 $P balance and your internal PoPo vault $P balance (what trading actually spends).";
  static override examples = ["<%= config.bin %> popo vault", "<%= config.bin %> popo vault --json"];
  static override requiresAuth = true;
  protected readonly pluginCommandId = "popo:vault";

  async execute(_io: CommandIO): Promise<VaultResult> {
    const wallet = activeAddress(this);
    const client = monadClient(this);
    const diamond = CONTRACTS.diamond;

    const [erc20, erc20Allow, vault, vaultAllow] = await Promise.all([
      client.readContract({
        address: CONTRACTS.usdp,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet],
      }) as Promise<bigint>,
      client.readContract({
        address: CONTRACTS.usdp,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [wallet, diamond],
      }) as Promise<bigint>,
      client.readContract({
        address: diamond,
        abi: VAULT_ABI,
        functionName: "balanceOf",
        args: [CONTRACTS.quoteTokenId, wallet],
      }) as Promise<bigint>,
      client.readContract({
        address: diamond,
        abi: VAULT_ABI,
        functionName: "allowance",
        args: [CONTRACTS.quoteTokenId, wallet, diamond],
      }) as Promise<bigint>,
    ]);

    return {
      chainId: CONTRACTS.chainId,
      wallet,
      erc20BalanceP: formatEther(erc20),
      erc20AllowanceP: formatEther(erc20Allow),
      vaultBalanceP: formatEther(vault),
      vaultAllowanceP: formatEther(vaultAllow),
    };
  }
}
