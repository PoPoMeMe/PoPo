# Snippet — Prediction Market: YES/NO Shares on a √ Curve

> Excerpts from `PPApp/Market/Facet.sol` + `Market/Base.sol`.
> Outcome shares are ERC-1155 tokens; price follows `price = k·√supply + c`.

## Pricing

A single-curve, parimutuel-style book: the marginal price of the next share
rises with the square root of current supply, so early positions are cheap and
prices move smoothly toward saturation.

```solidity
// price = k * sqrt(supply) + c
function _calcPrice(bytes32 digest, uint256 supply) internal view returns (uint256) {
    Market memory market = s.marketMap[digest];
    uint256 k = market.k;
    uint256 c = market.c;
    return (k * Math.sqrt(supply * 10 ** (s.usdpDecimals * 2)))
        / (10 ** s.usdpDecimals) + c;
}
```

## Lifecycle with role separation

Distinct selectors, independently role-gated in the facet initializer:

```solidity
function PPApp_MarketFacet_init(uint8 roleA, uint8 roleB, uint8 roleC)
    external onlyInitializing
{
    _setFunctionAccess(this.adminEnableMarket.selector,    roleA, true);
    _setFunctionAccess(this.adminWithdrawPlatformFee.selector, roleA, true);
    _setFunctionAccess(this.adminFinalizeMarket.selector,  roleA, true);

    _setFunctionAccess(this.createMarket.selector,  roleB, true);
    _setFunctionAccess(this.updateMarket.selector,  roleB, true);
    _setFunctionAccess(this.endMarket.selector,     roleB, true);

    _setFunctionAccess(this.disableMarket.selector, roleC, true);
}
```

Flow: **create → admin enable (review gate) → trade → end (set winning
nftId) → admin finalize → claims**. Market identity is a `digest`; duplicate
creation is rejected. Each market gets two ERC-1155 ids:

```solidity
marketData.yesNftId = ++_ds._idx;
marketData.noNftId  = ++_ds._idx;
```

## Buy / sell

```solidity
function buy(bytes32 digest, uint256 nftId) external {
    Market storage market = _requireActive(digest, nftId);

    uint256 currentSupply = market.yesNftId == nftId ? market.yesSupply : market.noSupply;
    if (market.yesNftId == nftId) market.yesSupply = currentSupply + 1;
    else                          market.noSupply  = currentSupply + 1;

    uint256 price = _calcPrice(digest, currentSupply + 1);
    IERC20(s.usdpAddress).transferFrom(msg.sender, address(this), price);

    uint256 platformFee = (price * market.platformFeeBps) / 10000;
    market.poolTotalAmount     += price - platformFee;
    market.platformFeeAmount  += platformFee;
    _mint(msg.sender, nftId, 1, "");
}

function sell(bytes32 digest, uint256 nftId) external {
    // ...burn 1 share, decrement supply, pay current curve price...
    // Round-trip sells pay 2x platform fee (anti-spam / LPs-for-buyers design).
    uint256 platformFee = (2 * (price * market.platformFeeBps)) / 10000;
    IERC20(s.usdpAddress).transfer(msg.sender, price - platformFee);
    market.poolTotalAmount -= price - platformFee;
}
```

## Settlement

After finalization, winning-share holders burn shares and receive their pro-rata
share of **both** the ERC20 reward pool and the $P trading pool; the losing side
burns for a compensation token.

```solidity
function claimReward(bytes32 digest) external {
    Market storage market = _requireFinalized(digest);
    uint256 nftBalance = _balanceOf(msg.sender, market.resultNftId);
    _burn(msg.sender, market.resultNftId, nftBalance);

    uint256 resultSupply = market.yesNftId == market.resultNftId
        ? market.yesSupply : market.noSupply;

    // (1) pro-rata reward ERC20
    uint256 rewardAmount = (nftBalance * market.rewardTotalAmount) / resultSupply;
    IERC20(market.rewardERC20Token).transfer(msg.sender, rewardAmount);

    // (2) pro-rata share of the $P trading pool
    uint256 pcTokenAmount = (nftBalance * market.poolTotalAmount) / resultSupply;
    IERC20(s.usdpAddress).transfer(msg.sender, pcTokenAmount);
}

function claimFailedToken(bytes32 digest) external {
    uint256 failedNftId = market.yesNftId == market.resultNftId
        ? market.noNftId : market.yesNftId;
    uint256 nftBalance = _balanceOf(msg.sender, failedNftId);
    _burn(msg.sender, failedNftId, nftBalance);
    IERC20(s.pftAddress).transfer(msg.sender, nftBalance);   // 1 compensation token / share
}
```

## Judge Q&A

- **How is the result decided?** A role-gated `endMarket(digest, resultNftId)`
  pins the winning side; finalization is a separate step, so end-and-dispute
  policy can be split across keys. Public applications for markets live in the
  signed Supabase layer and are reviewed before `adminEnableMarket`.
- **Why √ pricing?** Bounded, monotone marginal price without maintaining an
  order book; sells unwind on the same curve, and the pool pays winners
  parimutuel-style.
- **Why ERC-1155?** Both outcomes (and later markets) share one contract;
  wallets/exchanges see standard balance/transfer semantics for positions.
