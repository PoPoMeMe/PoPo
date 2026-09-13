# Snippet — Paid Episodes & Daily Permissionless Buyback-and-Burn

> Excerpts from `PPHatchSwapApp/Episode/Base.sol` and
> `Episode/EpisodeBuybackRouter.sol`.
> Content monetization whose revenue stream is mechanically routed back into
> the creator coin's price/supply.

## 1. Token-gated purchase with a three-way split

Each coin has a list of episodes with on-chain prices; access is a permanent
mapping. The creator always has free access; even a price-0 unlock increments
the buyer count so a deleted slot can never be resurrected with different
content.

```solidity
function _purchaseEpisode(uint256 tokenId_, uint256 index_) internal {
    PPHatchSwapToken storage t = _requireToken(tokenId_);
    Episode storage ep = _requireEpisode(tokenId_, index_);
    address buyer = msg.sender;

    if (t.creator == buyer || s.episodeAccess[tokenId_][index_][buyer])
        revert EpisodeFacet_AlreadyUnlocked(tokenId_, index_, buyer);

    uint256 price = ep.price;
    if (price > 0) {
        _spendAllowance(buyer, address(this), _quoteId(), price);
        _transfer(buyer, address(this), _quoteId(), price);

        uint256 platformShare = (price * EPISODE_PLATFORM_BPS) / BPS;
        uint256 buybackShare  = (price * EPISODE_BUYBACK_BPS) / BPS;
        // Creator gets the remainder — rounding dust can never strand funds.
        uint256 creatorShare  = price - platformShare - buybackShare;

        s.episodePlatformRevenue       += platformShare;
        s.episodeBuybackTreasury[tokenId_] += buybackShare;
        s.episodeCreatorRevenue[tokenId_]  += creatorShare;
    }

    s.episodeAccess[tokenId_][index_][buyer] = true;
    s.episodeBuyerCount[tokenId_][index_]   += 1;
    emit EpisodePurchased(tokenId_, index_, buyer, price);
}
```

Access gating for the video stream is therefore decided by a contract read
(`hasAccess`), while the video bytes live in off-chain storage.

## 2. One permissionless buyback per UTC day

Anyone can trigger it — creators don't need keepers. Guards:

- coin must be `Graduated` (a real AMM pool exists);
- at most one execution per UTC day per coin;
- spend is `min(treasury, governanceCap)`;
- slippage bounded by a sqrt-price limit (**−5%**), not an easily-gamed
  `minOut`;
- partial fills accepted; unspent quote stays in the treasury;
- bought coins are burned within the same transaction.

```solidity
function _executeDailyBuyback(uint256 tokenId_)
    internal returns (uint256 quoteSpent, uint256 tokensBurned)
{
    PPHatchSwapToken storage t = _requireToken(tokenId_);
    if (t.status != TokenStatus.Graduated)
        revert EpisodeFacet_NotGraduated(tokenId_);

    uint64 day = uint64(block.timestamp / SECONDS_PER_DAY);
    if (day <= s.episodeLastBuybackDay[tokenId_])
        revert EpisodeFacet_BuybackAlreadyDone(tokenId_, day);

    uint256 cap = s.episodeDailyBuybackCap;
    uint256 treasury = s.episodeBuybackTreasury[tokenId_];
    uint256 amount = treasury < cap ? treasury : cap;

    PoolKey memory key = PoolKey({ /* quote/token pair, fee, spacing, hook */ });

    PoolState memory ps = IPoolManagerFacet(address(this)).getPoolState(key);
    // Buying token pushes sqrt price down; cap the move at -5%.
    uint160 limit = uint160(
        FullMath.mulDiv(ps.sqrtPriceX96, BPS - BUYBACK_SLIPPAGE_BPS, BPS));
    if (limit < TickMath.MIN_SQRT_PRICE + 1) limit = TickMath.MIN_SQRT_PRICE + 1;

    // Fund the stateless router; it refunds unspent quote in the same call.
    _transfer(address(this), s.episodeBuybackRouter, key.currency0, amount);
    (quoteSpent, tokensBurned) =
        IEpisodeBuybackRouter(s.episodeBuybackRouter).executeBuyback(key, amount, limit);

    s.episodeBuybackTreasury[tokenId_] -= quoteSpent;
    _burn(address(this), tokenId_, tokensBurned);   // supply actually shrinks
    s.episodeLastBuybackDay[tokenId_] = day;
    emit EpisodeBuyback(tokenId_, day, quoteSpent, tokensBurned);
}
```

## 3. Stateless router inside the flash session

The router never custody funds between transactions; it only performs the
swap + delta settlement while `unlock` is open.

```solidity
function executeBuyback(PoolKey calldata key, uint256 maxQuoteIn, uint160 sqrtPriceLimitX96)
    external returns (uint256 quoteSpent, uint256 tokensBought)
{
    if (msg.sender != diamond) revert EpisodeBuybackRouter_OnlyDiamond(msg.sender);
    bytes memory r = manager.unlock(abi.encode(key, maxQuoteIn, sqrtPriceLimitX96));
    (quoteSpent, tokensBought) = abi.decode(r, (uint256, uint256));
}

function unlockCallback(bytes calldata data) external override returns (bytes memory) {
    if (msg.sender != address(manager))
        revert EpisodeBuybackRouter_UnauthorizedCallback(msg.sender);
    (PoolKey memory key, uint256 maxQuoteIn, uint160 limit) =
        abi.decode(data, (PoolKey, uint256, uint160));

    // Exact-in: quote (currency0) -> coin (currency1), bounded by `limit`.
    (int256 d0, int256 d1) = manager.swap(key, SwapParams({
        zeroForOne: true,
        amountSpecified: -int256(maxQuoteIn),
        sqrtPriceLimitX96: limit, hookData: ''
    }));

    uint256 quoteSpent  = d0 < 0 ? uint256(-d0) : 0;   // settle owed quote
    uint256 tokensBought = d1 > 0 ? uint256(d1) : 0;   // take bought coins

    if (quoteSpent > 0) {
        IERC6909Actions(address(manager)).approve(address(manager), key.currency0, quoteSpent);
        manager.settle(key.currency0, quoteSpent);
    }
    if (tokensBought > 0)
        manager.take(key.currency1, address(manager), tokensBought); // → Diamond burn

    uint256 leftover = maxQuoteIn - quoteSpent;
    if (leftover > 0)
        IERC6909Actions(address(manager))
            .transfer(address(manager), key.currency0, leftover);  // same-call refund

    return abi.encode(quoteSpent, tokensBought);
}
```

## Flywheel economics

```
fans buy episodes ─► buyback treasury ─► daily AMM buy ─► BURN
                                          │
 creators receive per-episode revenue ◄───┴──► holders benefit from shrinking supply
```

It converts content consumption directly into permanent buy pressure with no
admin action, no keeper subsidy (anyone may call), and no funds parked in a
third-party router.
