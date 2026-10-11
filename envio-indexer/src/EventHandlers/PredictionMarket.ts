import {
  indexer,
  type EvmOnEventContext,
  type Trader,
  type PredictionMarket,
  type PredictionPosition,
  type PredictionTrade,
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

/**
 * Resolve (market, outcome) for a trade. We don't index the CreateMarket event
 * (it embeds a full Market struct tuple), so the YES/NO nft ids are learned
 * from the first two distinct nft ids observed for a digest: the smaller id is
 * YES and the larger is NO, matching contract assignment order (yesNftId is
 * minted before noNftId). The market row is created lazily on first trade.
 */
async function resolveMarket(
  ctx: Ctx,
  digest: string,
  nftId: bigint,
): Promise<{ market: PredictionMarket; outcome: "yes" | "no" }> {
  let market = await ctx.PredictionMarket.get(digest);
  if (!market) {
    market = {
      id: digest,
      digest,
      yesNftId: nftId,
      noNftId: ZERO,
      yesSupply: ZERO,
      noSupply: ZERO,
      buyVolumeP: ZERO,
      sellVolumeP: ZERO,
      feesP: ZERO,
      tradeCount: 0,
    };
  }

  let resolved = market;
  if (market.noNftId === ZERO && nftId !== market.yesNftId) {
    // Second distinct id observed: smaller is YES, larger is NO.
    if (nftId < market.yesNftId) {
      resolved = { ...market, noNftId: market.yesNftId, yesNftId: nftId };
    } else {
      resolved = { ...market, noNftId: nftId };
    }
  }
  const outcome: "yes" | "no" = nftId === resolved.yesNftId ? "yes" : "no";
  return { market: resolved, outcome };
}

function updateSupply(
  market: PredictionMarket,
  outcome: "yes" | "no",
  side: "buy" | "sell",
  shares: bigint,
): PredictionMarket {
  const isYes = outcome === "yes";
  const cur = isYes ? market.yesSupply : market.noSupply;
  const next = side === "buy" ? cur + shares : cur > shares ? cur - shares : ZERO;
  return isYes ? { ...market, yesSupply: next } : { ...market, noSupply: next };
}

async function applyPosition(
  ctx: Ctx,
  trader: Trader,
  digest: string,
  outcome: "yes" | "no",
  side: "buy" | "sell",
  shares: bigint,
): Promise<void> {
  const id = `${trader.id}-${digest}`;
  const pos =
    (await ctx.PredictionPosition.get(id)) ??
    ({
      id,
      trader_id: trader.id,
      market_id: digest,
      yesShares: ZERO,
      noShares: ZERO,
    } as PredictionPosition);

  const current = outcome === "yes" ? pos.yesShares : pos.noShares;
  const next =
    side === "buy" ? current + shares : current > shares ? current - shares : ZERO;
  ctx.PredictionPosition.set(
    outcome === "yes" ? { ...pos, yesShares: next } : { ...pos, noShares: next },
  );
}

type TradeArgs = {
  traderAddress: string;
  digest: string;
  nftId: bigint;
  shares: bigint;
  targetSupply: bigint;
  quote: bigint;
  fee: bigint;
  side: "buy" | "sell";
  blockNumber: number;
  logIndex: number;
  chainId: number;
  txHash: string;
  timestamp: bigint;
};

async function recordTrade(ctx: Ctx, a: TradeArgs): Promise<void> {
  await ensureTrader(ctx, a.traderAddress, a.blockNumber);
  const trader = (await ctx.Trader.get(traderId(a.traderAddress)))!;

  const { market, outcome } = await resolveMarket(ctx, a.digest, a.nftId);
  let updated = updateSupply(market, outcome, a.side, a.shares);
  updated = {
    ...updated,
    buyVolumeP: a.side === "buy" ? updated.buyVolumeP + a.quote : updated.buyVolumeP,
    sellVolumeP: a.side === "sell" ? updated.sellVolumeP + a.quote : updated.sellVolumeP,
    feesP: updated.feesP + a.fee,
    tradeCount: updated.tradeCount + 1,
  };
  ctx.PredictionMarket.set(updated);

  await applyPosition(ctx, trader, a.digest, outcome, a.side, a.shares);

  const row: PredictionTrade = {
    id: `${a.chainId}-${a.blockNumber}-${a.logIndex}`,
    trader_id: trader.id,
    market_id: a.digest,
    side: a.side,
    outcome,
    nftId: a.nftId,
    shares: a.shares,
    quoteP: a.quote,
    platformFeeP: a.fee,
    targetSupply: a.targetSupply,
    blockNumber: a.blockNumber,
    transactionHash: a.txHash,
    timestamp: a.timestamp,
  };
  ctx.PredictionTrade.set(row);

  ctx.Trader.set({
    ...trader,
    totalSpentP:
      a.side === "buy" ? trader.totalSpentP + a.quote : trader.totalSpentP,
    totalReceivedP:
      a.side === "sell" ? trader.totalReceivedP + a.quote : trader.totalReceivedP,
    predictionTrades: trader.predictionTrades + 1,
  });
}

indexer.onEvent(
  { contract: "PredictionMarket", event: "Buy" },
  async ({ event, context }) => {
    const p = event.params;
    await recordTrade(context, {
      traderAddress: p.buyer,
      digest: p.digest,
      nftId: p.nftId,
      shares: 1n,
      targetSupply: p.targetSupply,
      quote: p.price,
      fee: p.platformFee,
      side: "buy",
      blockNumber: event.block.number,
      logIndex: event.logIndex,
      chainId: event.chainId,
      txHash: event.transaction.hash,
      timestamp: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "PredictionMarket", event: "Sell" },
  async ({ event, context }) => {
    const p = event.params;
    await recordTrade(context, {
      traderAddress: p.seller,
      digest: p.digest,
      nftId: p.nftId,
      shares: 1n,
      targetSupply: p.targetSupply,
      quote: p.price,
      fee: ZERO, // single Sell event has no fee field
      side: "sell",
      blockNumber: event.block.number,
      logIndex: event.logIndex,
      chainId: event.chainId,
      txHash: event.transaction.hash,
      timestamp: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "PredictionMarket", event: "BuyBatch" },
  async ({ event, context }) => {
    const p = event.params;
    await recordTrade(context, {
      traderAddress: p.buyer,
      digest: p.digest,
      nftId: p.nftId,
      shares: p.amount,
      targetSupply: p.targetSupply,
      quote: p.totalPrice,
      fee: p.platformFee,
      side: "buy",
      blockNumber: event.block.number,
      logIndex: event.logIndex,
      chainId: event.chainId,
      txHash: event.transaction.hash,
      timestamp: BigInt(event.block.timestamp),
    });
  },
);

indexer.onEvent(
  { contract: "PredictionMarket", event: "SellBatch" },
  async ({ event, context }) => {
    const p = event.params;
    await recordTrade(context, {
      traderAddress: p.seller,
      digest: p.digest,
      nftId: p.nftId,
      shares: p.amount,
      targetSupply: p.targetSupply,
      quote: p.totalOut,
      fee: ZERO, // SellBatch carries no separate fee field (fee already deducted)
      side: "sell",
      blockNumber: event.block.number,
      logIndex: event.logIndex,
      chainId: event.chainId,
      txHash: event.transaction.hash,
      timestamp: BigInt(event.block.timestamp),
    });
  },
);
