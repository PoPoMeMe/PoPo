import {
  indexer,
  type EvmOnEventContext,
  type Trader,
  type Memecoin,
  type MemecoinHolder,
  type HatchTrade,
} from "envio";

const ZERO = 0n;

type Ctx = EvmOnEventContext;

function traderId(address: string): string {
  return address.toLowerCase();
}

async function ensureTrader(ctx: Ctx, address: string, block: number): Promise<Trader> {
  const id = traderId(address);
  const existing = await ctx.Trader.get(id);
  if (existing) return existing;
  const row: Trader = {
    id,
    address: address.toLowerCase(),
    firstSeenBlock: block,
    totalSpentP: ZERO,
    totalReceivedP: ZERO,
    hatchTrades: 0,
    predictionTrades: 0,
  };
  ctx.Trader.set(row);
  return row;
}

// ---- TokenCreated ----
indexer.onEvent(
  { contract: "Hatch", event: "TokenCreated" },
  async ({ event, context }) => {
    const p = event.params;
    const tokenId = p.tokenId;
    context.Memecoin.set({
      id: tokenId.toString(),
      tokenId,
      name: p.name,
      symbol: p.symbol,
      uri: p.uri,
      creator: p.creator.toLowerCase(),
      createdAtBlock: event.block.number,
      graduated: false,
      reservedAmount: p.reservedAmount,
      cliffDays: BigInt(p.cliffDays),
      vestDays: BigInt(p.vestDays),
      holders: 0,
      tokenCirculating: ZERO,
      buyVolumeP: ZERO,
      sellVolumeP: ZERO,
      feesP: ZERO,
      tradeCount: 0,
      lastPriceP: ZERO,
    });
  },
);

// ---- BondingCurveComplete ----
indexer.onEvent(
  { contract: "Hatch", event: "BondingCurveComplete" },
  async ({ event, context }) => {
    const token = await context.Memecoin.get(event.params.tokenId.toString());
    if (!token) return;
    context.Memecoin.set({ ...token, graduated: true });
  },
);

// ---- Buy ----
indexer.onEvent({ contract: "Hatch", event: "Buy" }, async ({ event, context }) => {
  const p = event.params;
  const tokenId = p.tokenId;
  const tokenIdStr = tokenId.toString();
  const token = await context.Memecoin.get(tokenIdStr);
  if (!token) return; // defensive; tokens are always created before buys

  await ensureTrader(context, p.buyer, event.block.number);
  const trader = (await context.Trader.get(traderId(p.buyer)))!;

  // Holder position (buyer receives token units).
  const holderId = `${traderId(p.buyer)}-${tokenIdStr}`;
  const holder =
    (await context.MemecoinHolder.get(holderId)) ??
    ({
      id: holderId,
      trader_id: trader.id,
      token_id: tokenIdStr,
      balance: ZERO,
    } as MemecoinHolder);

  const prevBalance = holder.balance;
  const nextBalance = prevBalance + p.tokenAmount;
  context.MemecoinHolder.set({ ...holder, balance: nextBalance });

  const fee = p.platformFee + p.creatorFee;
  const holders = prevBalance === ZERO ? token.holders + 1 : token.holders;

  context.Memecoin.set({
    ...token,
    holders,
    tokenCirculating: token.tokenCirculating + p.tokenAmount,
    buyVolumeP: token.buyVolumeP + p.quoteCost,
    feesP: token.feesP + fee,
    tradeCount: token.tradeCount + 1,
    lastPriceP: p.tokenAmount > 0n ? (p.quoteCost * 10n ** 18n) / p.tokenAmount : token.lastPriceP,
  });

  context.Trader.set({
    ...trader,
    totalSpentP: trader.totalSpentP + p.quoteCost,
    hatchTrades: trader.hatchTrades + 1,
  });

  const trade: HatchTrade = {
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    trader_id: trader.id,
    token_id: tokenIdStr,
    side: "buy",
    tokenAmount: p.tokenAmount,
    quoteP: p.quoteCost,
    platformFeeP: p.platformFee,
    creatorFeeP: p.creatorFee,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    timestamp: BigInt(event.block.timestamp),
  };
  context.HatchTrade.set(trade);
});

// ---- Sell ----
indexer.onEvent({ contract: "Hatch", event: "Sell" }, async ({ event, context }) => {
  const p = event.params;
  const tokenIdStr = p.tokenId.toString();
  const token = await context.Memecoin.get(tokenIdStr);
  if (!token) return;

  await ensureTrader(context, p.seller, event.block.number);
  const trader = (await context.Trader.get(traderId(p.seller)))!;

  const holderId = `${traderId(p.seller)}-${tokenIdStr}`;
  const holder = await context.MemecoinHolder.get(holderId);
  if (holder) {
    const nextBalance = holder.balance > p.tokenAmount ? holder.balance - p.tokenAmount : ZERO;
    context.MemecoinHolder.set({ ...holder, balance: nextBalance });
    if (nextBalance === ZERO) {
      context.Memecoin.set({ ...token, holders: Math.max(0, token.holders - 1) });
    }
  }

  const fee = p.platformFee + p.creatorFee;
  const freshToken = (await context.Memecoin.get(tokenIdStr))!;
  context.Memecoin.set({
    ...freshToken,
    tokenCirculating:
      freshToken.tokenCirculating > p.tokenAmount
        ? freshToken.tokenCirculating - p.tokenAmount
        : ZERO,
    sellVolumeP: freshToken.sellVolumeP + p.quoteOut,
    feesP: freshToken.feesP + fee,
    tradeCount: freshToken.tradeCount + 1,
    lastPriceP:
      p.tokenAmount > 0n ? (p.quoteOut * 10n ** 18n) / p.tokenAmount : freshToken.lastPriceP,
  });

  context.Trader.set({
    ...trader,
    totalReceivedP: trader.totalReceivedP + p.quoteOut,
    hatchTrades: trader.hatchTrades + 1,
  });

  context.HatchTrade.set({
    id: `${event.chainId}-${event.block.number}-${event.logIndex}`,
    trader_id: trader.id,
    token_id: tokenIdStr,
    side: "sell",
    tokenAmount: p.tokenAmount,
    quoteP: p.quoteOut,
    platformFeeP: p.platformFee,
    creatorFeeP: p.creatorFee,
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
    timestamp: BigInt(event.block.timestamp),
  });
});
