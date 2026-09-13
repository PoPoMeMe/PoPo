# Snippet — Two-Level Referrals with Frozen Gold Tiers

> Excerpt from `PPHatchSwapApp/Referral/Base.sol`.
> Growth mechanic funded exclusively from the **platform fee**, with tier rates
> snapshotted at binding time.

## Rules

- A trader has at most **one** direct referrer edge.
- Binding is allowed only **before the trader's first fee-paying trade**.
- Self-reference, duplicate binding and cycles (up to 8 hops) are rejected.
- If the referrer is a paid **gold** subscriber at bind time, the edge is frozen
  as gold and keeps gold rates forever — later expiry does not retroactively
  downgrade anyone.
- Rewards are carved from the platform fee at trade time and credited inside
  the same Diamond (claimable as quote id, then unwrappable to $P).

## Binding

```solidity
uint256 internal constant MAX_REFERRAL_BPS     = 5_000; // 50% hard cap / share
uint256 internal constant DEFAULT_DIRECT_BPS   = 500;   // 5%
uint256 internal constant DEFAULT_INDIRECT_BPS = 300;   // 3%
uint256 internal constant GOLD_DIRECT_BPS      = 1_000; // 10%
uint256 internal constant GOLD_INDIRECT_BPS    = 600;   // 6%

function _bindReferral(address trader, address referrer) internal {
    if (trader == referrer) revert Referral_SelfReferral();
    if (s.referralParent[trader] != address(0))
        revert Referral_AlreadyBound(s.referralParent[trader]);
    if (s.referralTraded[trader]) revert Referral_AlreadyTraded();

    // Cycle check: the referrer must not sit below the trader in the tree.
    address cursor = referrer;
    for (uint256 depth = 0; depth < 8 && cursor != address(0); ++depth) {
        if (cursor == trader) revert Referral_CyclicReferral();
        cursor = s.referralParent[cursor];
    }

    bool gold = s.referralGoldUntil[referrer] >= block.timestamp;
    s.referralParent[trader] = referrer;
    s.referralGold[trader]   = gold;           // tier frozen on the edge
    emit ReferralBound(trader, referrer, s.referralParent[referrer], gold);
}
```

## Fee carve-out at trade time

```solidity
/// @dev kind: 0 = curve trade, 1 = AMM market trade
function _accrueReferralFee(address trader, uint256 platformFee, uint8 kind)
    internal returns (uint256 reserved)
{
    _markTraded(trader);                       // closes the binding window
    address direct = s.referralParent[trader];
    if (direct == address(0) || platformFee == 0) return 0;

    (uint256 directBps, uint256 indirectBps) =
        s.referralGold[trader] ? _goldBps() : _defaultBps();

    uint256 directAmount = (platformFee * directBps) / REFERRAL_BPS;
    address indirect = s.referralParent[direct];
    uint256 indirectAmount = indirect != address(0)
        ? (platformFee * indirectBps) / REFERRAL_BPS : 0;

    if (directAmount > 0) {
        s.referralRewards[direct]     += directAmount;
        s.referralTotalEarned[direct] += directAmount;
        reserved += directAmount;
    }
    if (indirectAmount > 0) {
        s.referralRewards[indirect]     += indirectAmount;
        s.referralTotalEarned[indirect] += indirectAmount;
        reserved += indirectAmount;
    }
    // Caller MUST deduct `reserved` from the platform fee it accrues.
}
```

The curve buy applies the return value directly:

```solidity
uint256 referralReserved = _accrueReferralFee(buyer_, platformFee, 0);
t.accumulatedPlatformFee += platformFee - referralReserved;
```

## Why it matters

- **Fund integrity**: pending referral rewards count against admin-withdrawable
  platform fees, so reserved money can never be withdrawn twice.
- **No retroactive games**: freezing the tier on the edge removes the
  subscribe-before-withdraw / expire-after-bind timing attacks.
- **One-way binding window**: `referralTraded` flips on the first fee-bearing
  trade, so an existing trader can never be "captured" by a referrer.
- **Economically bounded**: each share caps at 50% and `direct + indirect` must
  stay under 100%; configuration is validated before storage.
