# Snippet — Diamond Storage & Bitmask Per-Selector Access Control

> Excerpts from the shared `facets/AccessControl/Base.sol` and the EIP-2535
> facet pattern. This is the security backbone every business facet inherits.

## Per-function role mask

Roles are bits in a `bytes32`; every function selector stores a mask of roles
allowed to call it. `canCall` is a single AND — and is what the frontend queries
on chain to decide what UI to show (no client-side admin lists).

```solidity
uint8 internal constant ROLE_SUPER_ADMIN = 0;

function _setFunctionAccess(bytes4 functionSig, uint8 role, bool enabled)
    internal
{
    // Never strip the super admin from access-management selectors.
    if (!enabled && role == ROLE_SUPER_ADMIN &&
        (functionSig == IAccessControlFacet.setFunctionAccess.selector ||
         functionSig == IAccessControlFacet.setUserRole.selector))
    {
        revert AccessControl_CannotRevokeSuperAdmin();
    }

    if (enabled)
        AccessControlStorage.load().functionRoles[functionSig] |= bytes32(1 << role);
    else
        AccessControlStorage.load().functionRoles[functionSig] &= ~bytes32(1 << role);

    emit FunctionAccessChanged(functionSig, role, enabled);
}

function _setUserRole(address user, uint8 role, bool enabled) internal {
    if (enabled) AccessControlStorage.load().userRoles[user] |= bytes32(1 << role);
    else        AccessControlStorage.load().userRoles[user] &= ~bytes32(1 << role);
    emit UserRoleUpdated(user, role, enabled);
}

function _canCall(address user, bytes4 functionSig) internal view returns (bool) {
    return (_userRoles(user) & _functionRoles(functionSig) != bytes32(0))
        || _hasRole(user, ROLE_SUPER_ADMIN);
}

function _hasRole(address user, uint8 role) internal view returns (bool) {
    return _userRoles(user) & bytes32(1 << role) != bytes32(0);
}
```

Business selectors are protected with a `protected` modifier that resolves the
*actual called* selector (`msg.sig`) against the role map — so a facet cannot be
tricked into running a privileged internal path via a different exposed entry.

Facet initialization wires each selector to its role once, at deployment:

```solidity
function PPApp_MarketFacet_init(uint8 roleA, uint8 roleB, uint8 roleC)
    external onlyInitializing
{
    _setFunctionAccess(this.adminEnableMarket.selector,        roleA, true);
    _setFunctionAccess(this.adminWithdrawPlatformFee.selector, roleA, true);
    _setFunctionAccess(this.createMarket.selector,             roleB, true);
    _setFunctionAccess(this.disableMarket.selector,            roleC, true);
    // ...
}
```

## AppStorage pattern

All facets share one storage struct at a compile-time-fixed slot, avoiding
storage collisions across upgrades:

```solidity
struct AppStorage {
    PPHatchSwapConfig config;

    mapping(uint256 => PPHatchSwapToken) ppHatchSwapTokens;
    uint256[] ppHatchSwapTokenIds;
    uint256 totalPPHatchSwapTokens;

    mapping(uint256 => uint256) creatorRewards;        // tokenId => claimable
    mapping(uint256 => address) creatorFeeRecipient;
    mapping(uint256 => CreatorVesting) creatorVesting;

    // referrals
    mapping(address => address) referralParent;
    mapping(address => bool)    referralGold;
    mapping(address => bool)    referralTraded;
    mapping(address => uint256) referralRewards;

    // episodes / buyback
    mapping(uint256 => uint256) episodeBuybackTreasury;
    mapping(uint256 => uint64)  episodeLastBuybackDay;
    // ...pools, ticks, vault ids, prediction markets...
}

library StorageSlot {
    bytes32 internal constant APP_STORAGE_POSITION =
        keccak256("popo.appstorage.v1");
}

contract AppStorage {
    AppStorage internal s;   // facets read/write through `s`
}
```

(Names shown are representative of the real layout; the full struct and all
facets are omitted from this pack.)

## Why it matters for judges

- **Least privilege across keys**: e.g. role B can create/update/end markets;
  role A enables and finalizes; role C can emergency-disable. Compromising an
  ops key cannot withdraw fees.
- **Self-protecting admin**: the super-admin role cannot be removed from the
  access-management selectors — no accidental brick.
- **Client follows the chain**: the UI calls
  `canCall(user, selector)` (via the AccessControl facet) and shows admin
  controls only when the chain says so; spoofing the client gains nothing.
- **Upgradable without liquidity migration**: DiamondCut can replace a facet's
  implementation while every pool position, id balance and market keeps living
  at the same address/storage.
