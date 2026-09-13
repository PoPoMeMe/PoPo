# Snippet — v4-style PoolManager, Swap Loop & Creator Fee Hook

> Excerpts from `PPHatchSwapApp/PoolManager/Base.sol`,
> `PoolManager/HookDispatcher.sol`, `hooks/CreatorFeeHook.sol`.
> Purpose-built against the internal ERC-6909 ledger (not an external-AMM fork).

## 1. Hook permissions live in the hook address

Hooks don't register capabilities — their **low 14 address bits** are the
permission mask, produced by CREATE2 address mining. The manager checks a bit
before even calling the contract.

```solidity
uint160 constant AFTER_SWAP_FLAG                  = 1 << 6;
uint160 constant AFTER_SWAP_RETURNS_DELTA_FLAG    = 1 << 2;

function hasPermission(address hooks, uint160 flag) internal pure returns (bool) {
    return uint160(hooks) & flag != 0;
}

function validateHook(PoolKey calldata key) internal view {
    address hooks = key.hooks;
    if (hooks == address(0)) return;                 // no hooks is valid
    if (uint160(hooks) & ALL_HOOKS_MASK == 0 || hooks.code.length == 0) {
        PoolManagerFacet_HookAddressNotValid.selector.revertWith(hooks);
    }
}
```

Every dispatch validates both the call result and the returned selector,
bubbling hook failures with an ERC-7751-style wrapped error:

```solidity
function _callHook(address hooks, bytes memory payload, bytes4 expectedSelector)
    internal returns (bytes memory returndata)
{
    (bool success, bytes memory rd) = hooks.call(payload);
    if (!success) CustomRevert.bubbleUpAndRevertWith(
        hooks, bytes4(payload), PoolManagerFacet_HookCallFailed.selector);
    if (returndata.length < 32) PoolManagerFacet_InvalidHookResponse.selector.revertWith();
    if (abi.decode(rd, (bytes4)) != expectedSelector)
        PoolManagerFacet_InvalidHookResponse.selector.revertWith();
    return rd;
}
```

## 2. The swap loop (ticks, steps, protocol fees, crossing)

```solidity
function _swap(PoolKey calldata key, SwapParams memory params)
    internal returns (int256 delta0, int256 delta1)
{
    _requireUnlocked();                       // swaps only inside unlock session
    Pool storage pool = s.pools[_toPoolId(key)];
    if (pool.sqrtPriceX96 == 0) revert PoolManagerFacet_PoolNotInitialized(...);
    // price-limit must be on the correct side of the current price
    ...

    HookDispatcher.beforeSwap(key, params);
    uint160 sqrtPriceX96Before = pool.sqrtPriceX96;   // snapshot for hook fee tier
    bool exactInput = params.amountSpecified < 0;

    while (state.amountSpecifiedRemaining != 0
        && state.sqrtPriceX96 != params.sqrtPriceLimitX96)
    {
        (step.tickNext, step.initialized) = pool.tickBitmap
            .nextInitializedTickWithinOneWord(state.tick, key.tickSpacing, params.zeroForOne);
        step.sqrtPriceNextX96 = TickMath.getSqrtPriceAtTick(step.tickNext);

        (state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount) =
            SwapMath.computeSwapStep(state.sqrtPriceX96,
                SwapMath.getSqrtPriceTarget(params.zeroForOne, step.sqrtPriceNextX96,
                    params.sqrtPriceLimitX96),
                state.liquidity, state.amountSpecifiedRemaining,
                uint24(uint24(key.fee) * 100) /* bps → pips */);

        if (state.liquidity > 0) {
            // protocol fee split, LP fee growth per unit liquidity
            uint256 protocolFee = pool.protocolFeeBps >= key.fee
                ? step.feeAmount
                : FullMath.mulDiv(step.feeAmount, pool.protocolFeeBps, key.fee);
            state.feeGrowthGlobalX128 +=
                FullMath.mulDiv(step.feeAmount - protocolFee, FixedPoint128.Q128, state.liquidity);
        }

        // crossing an initialized tick updates active liquidity
        if (state.sqrtPriceX96 == step.sqrtPriceNextX96 && step.initialized) {
            int128 liquidityNet = pool.ticks.cross(step.tickNext, /* fee growth sides */);
            if (params.zeroForOne) liquidityNet = -liquidityNet;
            state.liquidity = LiquidityMath.addDelta(state.liquidity, liquidityNet);
        }
    }
    ...
}
```

After the loop, the **afterSwap hook returns a delta** that the manager folds
into the swapper's currency0 (quote) obligation and credits to the *same*
creator ledger used by the bonding curve — so creator fees are unified across
both market phases and claimed through one function:

```solidity
int128 hookDelta =
    HookDispatcher.afterSwap(key, params, delta0, delta1, sqrtPriceX96Before);
if (hookDelta > 0) {
    uint256 creatorFee = uint256(int256(hookDelta));
    amount0 -= creatorFee.toInt256();
    delta0 = amount0;
    s.creatorRewards[key.currency1] += creatorFee;   // currency1 = launched token id
}
_accountDelta(msg.sender, key.currency0, amount0);
_accountDelta(msg.sender, key.currency1, amount1);
```

Settlement itself is pure internal 6909 movement, allowed only while unlocked:

```solidity
function _settle(uint256 currencyId, uint256 amount) internal {
    _requireUnlocked();
    _transfer(msg.sender, address(this), currencyId, amount);
    _accountDelta(msg.sender, currencyId, amount.toInt256());
}
function _take(uint256 currencyId, address recipient, uint256 amount) internal {
    _requireUnlocked();
    _transfer(address(this), recipient, currencyId, amount);
    _accountDelta(msg.sender, currencyId, -amount.toInt256());
}
```

## 3. CreatorFeeHook: market-cap-tiered fees, pre-trade tier lookup

The hook is deployed at an address ending `0x44` (`AFTER_SWAP |
AFTER_SWAP_RETURNS_DELTA`), keeps **no per-pool state**, and reads tier config
from the Diamond on every swap.

```solidity
uint160 public constant ADDRESS_FLAGS = (1 << 6) | (1 << 2);

/// marketCap = totalSupply · price, without ever computing sqrtPrice² (overflow)
function marketCap(uint256 tokenTotalSupply, uint160 sqrtPriceX96)
    public pure returns (uint256)
{
    uint256 supplyAtPrice = FullMath.mulDiv(
        tokenTotalSupply, uint256(sqrtPriceX96), uint256(1) << 96);
    return FullMath.mulDiv(
        supplyAtPrice, uint256(sqrtPriceX96), uint256(1) << 96);
}

function creatorFeeBpsAt(CreatorFeeTier[] memory tiers, uint256 marketCap_)
    public pure returns (uint24)
{
    for (uint256 i = 0; i < tiers.length; ++i)
        if (marketCap_ <= tiers[i].mcUpper) return tiers[i].creatorFeeBps;
    return 0;
}

function afterSwap(
    address sender, PoolKey calldata key, SwapParams calldata,
    int256 delta0, int256, uint160 sqrtPriceX96Before, bytes calldata
) external returns (bytes4 selector, int128 hookDelta) {
    if (msg.sender != poolManager) revert CreatorFeeHook_OnlyPoolManager();
    selector = IPPHatchSwapHook.afterSwap.selector;
    if (delta0 == 0) return (selector, 0);

    PPHatchSwapConfig memory cfg = IPPHatchSwapFacet(poolManager).getConfig();
    // Tier is evaluated at the PRE-TRADE price snapshot.
    uint256 mc  = marketCap(cfg.tokenTotalSupply, sqrtPriceX96Before);
    uint24 bps  = creatorFeeBpsAt(cfg.ammCreatorFeeTiers, mc);
    if (bps == 0) return (selector, 0);

    uint256 fee = (_abs(delta0) * bps) / 10_000;
    if (fee > uint256(int256(type(int128).max)))   // defensive clamp
        fee = uint256(int256(type(int128).max));
    emit CreatorFeeCollected(key.currency1, sender, _abs(delta0), fee, mc);
    hookDelta = int128(int256(fee));
}
```

## Judge Q&A

- **Why address-bit permissions?** Configuring hooks in storage is itself an
  upgrade/attack surface; tying capabilities to a mined address makes the
  capability set immutable and self-authenticating at call time.
- **Why pre-trade price for the fee tier?** A large swap could otherwise push
  the pool into a lower-fee market-cap band and underpay on the move that caused
  it. `sqrtPriceX96Before` closes that.
- **Why return a delta instead of pulling tokens?** The swapper already owes the
  pool inside the flash session; adding the creator fee to the same currency0
  delta settles both in one transfer with no extra allowance.
- **How do creators claim AMM fees?** The manager writes to
  `creatorRewards[tokenId]`, identical to curve fees — one claim path, one
  balance source.
