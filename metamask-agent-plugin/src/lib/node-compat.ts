/**
 * Node compatibility shim — MUST be the first import in every command module.
 *
 * The MetaMask Agent Wallet CLI 7.1.0 bundles a web3auth "bridge" chunk that,
 * at module-eval time, runs `globalThis.window === undefined &&
 * (globalThis.window = globalThis)` and then calls `window.addEventListener`.
 * Under plain Node, `globalThis.addEventListener` does not exist, so the CLI
 * crashes with `window.addEventListener is not a function` before any plugin
 * code runs. Defining no-op event methods on `globalThis` makes the browser-ish
 * alias harmless; real transaction signing/approval is unaffected (that path
 * goes through the Agent Wallet executor, not these DOM event hooks).
 *
 * ES module imports evaluate in import order, so importing this module first in
 * each command guarantees the shim is installed before the plugin SDK's bridge
 * chunk is evaluated.
 */
type EventFn = (...args: unknown[]) => void;
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.addEventListener !== "function") {
  g.addEventListener = (() => {}) as EventFn;
  g.removeEventListener = (() => {}) as EventFn;
}
export {};
