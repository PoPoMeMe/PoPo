# Snippet — Bonding Curve: pricing, buy & sell

> Excerpt from `PoPoApp/PPHatchSwap/Base.sol` (internal helpers).
> Boilerplate, events and storage declarations omitted.

## Why it matters

The curve is the launch-phase market maker. It must:

- price symmetrically in both directions with integer-only math;
- round **in the pool's favor** on every division (an exploitable drain
  otherwise);
- keep *virtual* reserves (pricing) and *real* reserves (payable bounds)
  consistent after fees;
- split fees for platform, creator and referrals without ever double-counting;
- detect the graduation threshold atomically inside the buy.

## Curve math

```solidity
uint256 internal constant BPS = 10_000;

/// @dev ceil division for k/x; favors the reserves on both buy and sell.
function _ceilDiv(uint256 a_, uint256 b_) internal pure returns (uint256) {
    return b_ == 0 ? 0 : (a_ + b_ - 1) / b_;
}

/// @dev Given a gross quote amount, returns tokens out and both fees.
function _quoteBuy(IAppStorage.PPHatchSwapToken memory t_, uint256 quoteAmount_)
    internal pure
    returns (uint256 tokenAmount, uint256 platformFee, uint256 creatorFee)
{
    platformFee = (quoteAmount_ * t_.platformFeeBps) / BPS;
    creatorFee  = (quoteAmount_ * t_.creatorFeeBps)  / BPS;
    uint256 netQuote = quoteAmount_ - platformFee - creatorFee;

    tokenAmount = t_.virtualTokenReserves
        - _ceilDiv(t_.k, t_.virtualQuoteReserves + netQuote);
}

/// @dev Given a token amount, returns net quote out and both fees.
function _quoteSell(IAppStorage.PPHatchSwapToken memory t_, uint256 tokenAmount_)
    internal pure
    returns (uint256 quoteOut, uint256 platformFee, uint256 creatorFee)
{
    uint256 grossQuote = t_.virtualQuoteReserves
        - _ceilDiv(t_.k, t_.virtualTokenReserves + tokenAmount_);
    platformFee = (grossQuote * t_.platformFeeBps) / BPS;
    creatorFee  = (grossQuote * t_.creatorFeeBps)  / BPS;
    quoteOut = grossQuote - platformFee - creatorFee;
}
```

Key idea: `k = virtualTokenReserves · virtualQuoteReserves` is fixed at creation;
the curve is the classic `xy = k` hyperbola expressed against virtual reserves,
and only `netQuote` (after fees) moves the invariant.

## Buy (fee split → settlement → reserves → graduation flag)

```solidity
function _buy(uint256 tokenId_, uint256 quoteAmount_, uint256 minTokensOut_, address buyer_)
    internal
{
    if (quoteAmount_ == 0) revert PPHatchSwap_ZeroAmount();
    IAppStorage.PPHatchSwapToken storage t = s.ppHatchSwapTokens[tokenId_];
    _requireCurveOpen(t, tokenId_);

    (uint256 tokenAmount, uint256 platformFee, uint256 creatorFee) =
        _quoteBuy(t, quoteAmount_);
    if (tokenAmount == 0) revert PPHatchSwap_ZeroTokensReceived();
    if (tokenAmount < minTokensOut_) revert PPHatchSwap_SlippageExceeded(minTokensOut_, tokenAmount);
    if (tokenAmount > t.realTokenReserves)
        revert PPHatchSwap_InsufficientRealTokenReserves(tokenId_);

    uint256 netQuote = quoteAmount_ - platformFee - creatorFee;

    // Referral shares are carved out of the platform-fee portion.
    uint256 referralReserved = _accrueReferralFee(buyer_, platformFee, 0);

    // Internal ERC-6909 settlement: pull quote, hand over tokens.
    _spendAllowance(buyer_, address(this), s.config.quoteId, quoteAmount_);
    _transfer(buyer_, address(this), s.config.quoteId, quoteAmount_);
    _transfer(address(this), buyer_, tokenId_, tokenAmount);

    t.virtualQuoteReserves += netQuote;
    t.virtualTokenReserves -= tokenAmount;
    t.realQuoteReserves    += netQuote;
    t.realTokenReserves    -= tokenAmount;
    // Platform keeps only what wasn't reserved for referrals.
    t.accumulatedPlatformFee += platformFee - referralReserved;
    t.accumulatedCreatorFee  += creatorFee;
    s.creatorRewards[tokenId_] += creatorFee;

    emit Buy(buyer_, tokenId_, tokenAmount, quoteAmount_, platformFee, creatorFee);

    // Graduation is detected on the buy that crosses the threshold.
    if (!t.complete && t.realQuoteReserves >= t.graduationThreshold) {
        t.complete = true;
        emit BondingCurveComplete(tokenId_, t.realQuoteReserves);
    }
}
```

## Creation: supply partition with creator vesting

The entire supply is minted once to the Diamond. The portion sold on the curve
is `realTokenReserves`; a configurable percentage is reserved for the creator
under cliff + linear vesting; everything else is permanently locked.

```solidity
uint256 reservedAmount = (totalSupply * reservePctBps_) / BPS;
_mint(address(this), tokenId, totalSupply);

s.ppHatchSwapTokens[tokenId] = IAppStorage.PPHatchSwapToken({
    virtualTokenReserves: cfg.defaultVirtualTokenReserves,
    virtualQuoteReserves: cfg.defaultVirtualQuoteReserves,
    realTokenReserves:    cfg.defaultRealTokenReserves,
    k: cfg.defaultVirtualTokenReserves * cfg.defaultVirtualQuoteReserves,
    status: IAppStorage.TokenStatus.Active,
    graduationThreshold:  cfg.defaultGraduationThreshold,
    // ...fees, flags, timestamps
});
```

Vesting clock starts only at graduation:

```solidity
function _vestedDays(uint256 elapsed_, uint64 cliffDays_) internal pure returns (uint256) {
    uint256 cliff = uint256(cliffDays_) * 86_400;
    if (elapsed_ <= cliff) return 0;
    return (elapsed_ - cliff) / 86_400;
}
```

## Judge Q&A

- **Why ceiling division?** Rounding against the trader on both buy and sell
  prevents repeated rounding dust extraction; reserves always stay solvent.
- **Why virtual + real reserves?** Virtual reserves shape early price
  discovery; real reserves cap payouts so the contract can never deliver more
  quote/tokens than it holds.
- **Where do referrals come from?** Only the platform fee — creator and LP
  economics are untouched, and the reserved amount is subtracted from what the
  platform can later withdraw.
