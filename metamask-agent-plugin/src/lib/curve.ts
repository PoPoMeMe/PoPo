/**
 * Off-chain replica of the prediction-market curve `price = k·√supply + c`
 * (Solidity 0.8.20 OZ Math.sqrt, floor). $P uses 18 decimals, shares are
 * 0-decimal, so the contract computes `k * sqrt(supply * 1e36) / 1e18 + c`.
 *
 * These helpers MUST match `MarketBase._calcPrice` / `_curveSum`.
 */

const SCALE = 10n ** 18n;

export function floorSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** Price of filling the curve point at the given (post-fill) supply. */
export function priceAt(k: bigint, c: bigint, supply: bigint): bigint {
  const root = floorSqrt(supply * SCALE * SCALE); // sqrt(supply) * 1e18
  return (k * root) / SCALE + c;
}

/**
 * Exact summed BUY cost: prices at supplies (fromSupply+1 .. fromSupply+amount).
 */
export function curveBuySum(k: bigint, c: bigint, fromSupply: bigint, amount: bigint): bigint {
  let sum = 0n;
  for (let i = 1n; i <= amount; i++) sum += priceAt(k, c, fromSupply + i);
  return sum;
}

/**
 * Exact summed SELL gross redemption: prices at supplies
 * (fromSupply-amount+1 .. fromSupply) — the top `amount` curve points.
 */
export function curveSellSum(k: bigint, c: bigint, fromSupply: bigint, amount: bigint): bigint {
  let sum = 0n;
  for (let i = 0n; i < amount; i++) sum += priceAt(k, c, fromSupply - i);
  return sum;
}
