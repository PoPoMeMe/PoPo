# Snippet — ERC-6909 Vault: One Internal Ledger for Every Asset

> Excerpt from `PPHatchSwapApp/Vault/Base.sol` + the shared `ERC6909` facet.
> The Vault bridges whitelisted ERC20s (the $P underwriting) and internal
> multi-token ids; every launched meme coin is *also* just an id minted on this
> same ledger.

## The model

```
external ERC20 $P  ──deposit──►  6909 id (quoteId), 1:1 backed
◄──withdraw (burn id)──

launched coin X  ──mint total supply to Diamond at creation──►  6909 id = tokenId
curve trades / AMM swaps / referrals / episodes / buyback = internal transfers of ids
```

Invariant the rest of the system relies on: **the quote id is never minted by
the curve** — it enters only through deposits backed 1:1 by real ERC20 $P. That
single fact is what makes fee accounting, migration delta-netting and
admin withdrawals all sound.

## Registration & wrapping

```solidity
function _registerUnderlying(address underlying_) internal returns (uint256 id) {
    if (s.underlyingWhitelist[underlying_])
        revert Vault_UnderlyingAlreadyRegistered(underlying_);

    id = _allocateId();                       // shares the id space with coins
    s.idToUnderlying[id] = underlying_;
    s.underlyingToId[underlying_] = id;
    s.underlyingWhitelist[underlying_] = true;

    (string memory n, string memory sym, uint8 dec) = _readErc20Meta(underlying_);
    _setTokenMeta(id, n, sym, "", dec);
    emit UnderlyingAdded(underlying_, id);
}

function _deposit(uint256 id_, uint256 amount_) internal {
    address underlying = _requireUnderlying(id_);
    IERC20(underlying).safeTransferFrom(msg.sender, address(this), amount_);
    _mint(msg.sender, id_, amount_);          // internal credit appears instantly
    emit Deposited(msg.sender, underlying, id_, amount_);
}

function _withdraw(uint256 id_, uint256 amount_) internal {
    address underlying = _requireUnderlying(id_);
    _burn(msg.sender, id_, amount_);
    IERC20(underlying).safeTransfer(msg.sender, amount_);
    emit Withdrawn(msg.sender, underlying, id_, amount_);
}
```

Metadata reads are defensive against non-standard tokens:

```solidity
function _readErc20Meta(address u)
    internal view returns (string memory n, string memory sym, uint8 dec)
{
    try IERC20Metadata(u).name() returns (string memory v) { n = v; } catch {}
    try IERC20Metadata(u).symbol() returns (string memory v) { sym = v; } catch {}
    dec = 18;
    try IERC20Metadata(u).decimals() returns (uint8 v) { dec = v; } catch {}
}
```

## Internal-only allowance primitive

Every business flow settles through the same `_spendAllowance` + `_transfer`
pair (the curve buy shown earlier, the AMM `settle`, episode purchases,
referral claims). There are no external ERC20 approvals to individual pool
contracts — the Diamond is the only spender a user ever approves, and only when
wrapping/unwrapping.

## Why it matters

- **Gas**: a curve buy, AMM swap, fee split and referral credit are all balance
  updates in one storage domain — no token-call hops.
- **Security surface**: one ledger, one allowance model, one place that can
  touch real ERC20s (the vault wrapper). Business facets cannot call arbitrary
  token contracts.
- **Atomicity**: the graduation seed and the buyback router can settle
  multi-step operations with signed deltas inside an `unlock` session because
  "currency" is an id, not an external contract.
- **Uniform UX**: users see both their $P vault balance and their meme coin
  balances through the same multi-token interface and one deposit/withdraw
  boundary.

## Judge Q&A

- **Can the protocol print $P?** No. Quote balances only change via deposit
  (with ERC20 pulled in) or withdrawal (burn + payout); curve/AMM math only
  moves existing quote balances between accounts and the fee ledger.
- **Why ERC-6909 and not ERC-1155?** 6909 is the fungible-only, gas-cheaper
  standard with the allowance/operator model DeFi settlement expects; ids are
  shared between wrapped underlyings and launched coins.
