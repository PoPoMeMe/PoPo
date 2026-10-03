# Snippet — Graduation: Curve → Concentrated Liquidity

> Excerpt from `PoPoApp/Migration/Base.sol`.
> Permissionless `migrate(tokenId)`: anyone can trigger it once the curve is
> complete. No router, no LP tokens, no settle transfers.

## The problem

When the bonding curve completes, its reserves must seed a Uniswap-v4-style
concentrated-liquidity pool at exactly the curve's implied price, otherwise
graduation is a risk-free arbitrage. The migration runs **inside one Diamond**
that hosts both the curve state and the PoolManager facet, so it uses
v4-router-style external self-calls plus flash accounting.

## Exact sqrt-price from curve reserves (512-bit precision)

```solidity
/// @dev Integer square root via MSB-seeded Newton iteration (Babylonian method).
function _sqrt(uint256 x) internal pure returns (uint256 y) {
    if (x == 0) return 0;
    // Seed with 2^ceil(bitLength(x)/2), always >= sqrt(x).
    y = 2 ** ((uint256(uint8(x.mostSignificantBit())) + 1) / 2 + 1);
    // Eight Newton rounds are sufficient for 256-bit convergence.
    y = (y + x / y) / 2; y = (y + x / y) / 2; y = (y + x / y) / 2;
    y = (y + x / y) / 2; y = (y + x / y) / 2; y = (y + x / y) / 2;
    y = (y + x / y) / 2; y = (y + x / y) / 2;
    while (y > x / y) y = (y + x / y) / 2; // walk down to floor(sqrt(x))
}

/// @dev sqrtPriceX96 = sqrt(tokenReserve / quoteReserve) * 2^96
function _sqrtPriceFromReserves(uint256 tokenReserve_, uint256 quoteReserve_)
    internal pure returns (uint160)
{
    uint256 ratioX192 = FullMath.mulDiv(tokenReserve_, 1 << 192, quoteReserve_);
    return uint160(_sqrt(ratioX192));
}
```

`mulDiv` computes the `2^192` numerator product at 512-bit intermediate width;
`y*y` is deliberately never formed (overflow avoidance).

## Maximal full-range liquidity from both reserves

```solidity
/// @dev L = min(L0, L1), mirroring v3-periphery LiquidityAmounts.
///   L0 constrained by quote (currency0), L1 by token (currency1).
function _liquidityFromAmounts(
    uint160 sqrtPriceX96_, uint160 sqrtPriceAX96_, uint160 sqrtPriceBX96_,
    uint256 amount0_, uint256 amount1_
) internal pure returns (uint128) {
    uint256 liq0 = FullMath.mulDiv(
        FullMath.mulDiv(amount0_, sqrtPriceX96_, sqrtPriceBX96_ - sqrtPriceX96_),
        sqrtPriceBX96_, FixedPoint96.Q96);
    uint256 liq1 = FullMath.mulDiv(
        amount1_, FixedPoint96.Q96, sqrtPriceX96_ - sqrtPriceAX96_);
    return uint128(liq0 < liq1 ? liq0 : liq1);
}
```

A full-range position over `[MIN_TICK, MAX_TICK]` reproduces constant-product
behavior while the price stays in range — so post-graduation trading behaves
continuously with the curve.

## The migration flow

```solidity
function _migrate(uint256 tokenId_) internal returns (bytes32 poolId, uint128 liquidity) {
    PPHatchSwapToken storage t = s.ppHatchSwapTokens[tokenId_];
    if (t.status != TokenStatus.Active) revert MigrationFacet_NotActive(tokenId_);
    if (!t.complete) revert MigrationFacet_NotComplete(tokenId_);

    uint256 tokenReserve = t.realTokenReserves;
    uint256 quoteReserve = t.realQuoteReserves;

    // 1. Graduate first: status + vesting clock start.
    _markGraduated(tokenId_);

    // 2. Seed price: currency1/currency0 = token/quote.
    uint160 sqrtPriceX96 = _sqrtPriceFromReserves(tokenReserve, quoteReserve);

    // 3. Canonical ordering: currency0 = quote (smaller id), currency1 = token.
    PoolKey memory key = PoolKey({
        currency0: s.config.quoteId, currency1: tokenId_,
        fee: s.config.defaultAmmFeeBps,
        tickSpacing: s.config.defaultAmmTickSpacing,
        hooks: s.config.defaultGraduationHook
    });

    // initializePool MUST run while the manager is locked (outside unlock).
    (poolId, ) = IPoolManagerFacet(address(this))
        .initializePool(key, sqrtPriceX96, '');

    // 4. Full-range bounds aligned to tick spacing.
    int24 tickLower = TickMath.minUsableTick(s.config.defaultAmmTickSpacing);
    int24 tickUpper = TickMath.maxUsableTick(s.config.defaultAmmTickSpacing);
    liquidity = _liquidityFromAmounts(sqrtPriceX96,
        TickMath.getSqrtPriceAtTick(tickLower),
        TickMath.getSqrtPriceAtTick(tickUpper),
        quoteReserve, tokenReserve);

    // 5. unlock session: the Diamond is locker + callback recipient.
    IPoolManagerFacet(address(this)).unlock(
        abi.encode(MigrateCallbackData(tokenId_, key, liquidity, tickLower, tickUpper)));
}
```

## Callback: mint seed LP and net deltas to zero

```solidity
function unlockCallback(bytes calldata data_) external override returns (bytes memory) {
    // Only within an unlock session AND only a self-Diamond call:
    // prevents hook/external replay of a seeded position.
    _requireUnlocked();
    if (msg.sender != address(this)) revert MigrationFacet_CallbackUnauthorized(msg.sender);

    MigrateCallbackData memory cb = abi.decode(data_, (MigrateCallbackData));

    (int256 delta0, int256 delta1, , ) = IPoolManagerFacet(address(this))
        .modifyLiquidity(cb.key, ModifyLiquidityParams({
            tickLower: cb.tickLower, tickUpper: cb.tickUpper,
            liquidityDelta: int256(uint256(cb.liquidity)),
            salt: bytes32(0), hookData: ''
        }));

    // Reserves already live on the Diamond's 6909 balance — no settle/take
    // token movement needed: zero the deltas directly.
    _accountDelta(address(this), cb.key.currency0, -delta0);
    _accountDelta(address(this), cb.key.currency1, -delta1);
    return '';
}
```

## Judge Q&A

- **Who owns the seed LP?** The Diamond itself — equivalent to burning LP
  ownership; the position can never be withdrawn, which is exactly the intended
  permanent liquidity guarantee for graduated coins.
- **Why self-calls?** `PoolKey` is assembled in memory but the internal
  initializers take `calldata`; an external self-call re-enters through the
  facet with proper calldata while `msg.sender == address(this)` unlocks the
  manager-only paths.
- **Price continuity?** The seeded sqrt-price is algebraically the curve price
  `tokenReserve/quoteReserve`; tests assert no arbitrage gap across graduation.
