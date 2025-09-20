import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";

import { fromZonedTime } from "date-fns-tz";

import { bets, db, type Bet, type BetResult } from "@/lib/db";
import {
  InvalidPriceError,
  calculateReturn,
  getQuoteOnOrBefore,
  resolveToTradingDay,
  toQuoteSnapshot,
  tradingDayKey
} from "@/lib/finance";
import {
  YahooNoDataError,
  YahooSymbolNotFoundError,
  YahooTransientError
} from "@/lib/yahoo";

export class BetNotMaturedError extends Error {
  constructor() {
    super("Bet end date has not passed");
    this.name = "BetNotMaturedError";
  }
}

export type SettlementPending = {
  status: "PENDING";
  bet: Bet;
  reason: string;
};

export type SettlementResult =
  | { status: "SETTLED"; bet: Bet }
  | { status: "INVALID"; bet: Bet }
  | SettlementPending;

type DbClient = typeof db;

const MARKET_TIME_ZONE = "America/New_York";

function normalizeDate(value: Date | string) {
  if (value instanceof Date) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fromZonedTime(`${value}T00:00:00`, MARKET_TIME_ZONE);
  }

  return new Date(value);
}

async function markInvalid(client: DbClient, bet: Bet, reason: string) {
  const now = new Date();
  const [updated] = await client
    .update(bets)
    .set({
      status: "INVALID",
      settledAt: now,
      settlementTxId: randomUUID(),
      settlementError: reason,
      result: null
    })
    .where(and(eq(bets.id, bet.id), isNull(bets.settledAt)))
    .returning();

  if (updated) {
    return { status: "INVALID" as const, bet: updated };
  }

  const existing = await client.query.bets.findFirst({ where: eq(bets.id, bet.id) });
  return { status: "INVALID" as const, bet: existing ?? bet };
}

async function markPending(client: DbClient, bet: Bet, reason: string): Promise<SettlementPending> {
  const [updated] = await client
    .update(bets)
    .set({ settlementError: reason })
    .where(eq(bets.id, bet.id))
    .returning();

  return {
    status: "PENDING" as const,
    reason,
    bet: updated ?? bet
  };
}

async function markSettled(client: DbClient, bet: Bet, result: BetResult) {
  const now = new Date();
  const [updated] = await client
    .update(bets)
    .set({
      status: "SETTLED",
      settledAt: now,
      settlementTxId: randomUUID(),
      result,
      settlementError: null
    })
    .where(and(eq(bets.id, bet.id), isNull(bets.settledAt)))
    .returning();

  if (updated) {
    return { status: "SETTLED" as const, bet: updated };
  }

  const existing = await client.query.bets.findFirst({ where: eq(bets.id, bet.id) });
  return { status: "SETTLED" as const, bet: existing ?? bet };
}

export async function computeBetResult(bet: Bet) {
  const startDate = normalizeDate(bet.startDate);
  const endDate = normalizeDate(bet.endDate);

  const startTradingDay = resolveToTradingDay(startDate, "next");
  const endTradingDay = resolveToTradingDay(endDate, "prev");

  if (startTradingDay.getTime() > endTradingDay.getTime()) {
    throw new InvalidPriceError("No trading days exist in the requested range");
  }

  const latestTradingDay = resolveToTradingDay(new Date(), "prev");
  if (endTradingDay.getTime() > latestTradingDay.getTime()) {
    throw new BetNotMaturedError();
  }

  const [startQuoteA, startQuoteB, endQuoteA, endQuoteB] = await Promise.all([
    getQuoteOnOrBefore(bet.tickerA, startTradingDay),
    getQuoteOnOrBefore(bet.tickerB, startTradingDay),
    getQuoteOnOrBefore(bet.tickerA, endTradingDay),
    getQuoteOnOrBefore(bet.tickerB, endTradingDay)
  ]);

  if (tradingDayKey(startQuoteA.date) !== tradingDayKey(startTradingDay)) {
    throw new InvalidPriceError(`Missing start price for ${bet.tickerA}`);
  }
  if (tradingDayKey(startQuoteB.date) !== tradingDayKey(startTradingDay)) {
    throw new InvalidPriceError(`Missing start price for ${bet.tickerB}`);
  }
  if (tradingDayKey(endQuoteA.date) !== tradingDayKey(endTradingDay)) {
    throw new YahooTransientError(`Awaiting close data for ${bet.tickerA}`);
  }
  if (tradingDayKey(endQuoteB.date) !== tradingDayKey(endTradingDay)) {
    throw new YahooTransientError(`Awaiting close data for ${bet.tickerB}`);
  }

  const aReturn = calculateReturn(startQuoteA, endQuoteA);
  const bReturn = calculateReturn(startQuoteB, endQuoteB);

  let winner: BetResult["winner"] = "Tie";
  const diff = Math.abs(aReturn.raw - bReturn.raw);
  if (diff > 1e-6) {
    winner = aReturn.raw > bReturn.raw ? "A" : "B";
  }

  const result: BetResult = {
    a: {
      ticker: bet.tickerA,
      start: toQuoteSnapshot(startQuoteA),
      end: toQuoteSnapshot(endQuoteA),
      raw: aReturn.raw,
      rounded: aReturn.rounded
    },
    b: {
      ticker: bet.tickerB,
      start: toQuoteSnapshot(startQuoteB),
      end: toQuoteSnapshot(endQuoteB),
      raw: bReturn.raw,
      rounded: bReturn.rounded
    },
    winner
  };

  return result;
}

export async function settleBet(bet: Bet, client: DbClient = db): Promise<SettlementResult> {
  try {
    const result = await computeBetResult(bet);
    return await markSettled(client, bet, result);
  } catch (error) {
    if (error instanceof BetNotMaturedError) {
      throw error;
    }
    if (error instanceof YahooTransientError) {
      return markPending(client, bet, error.message);
    }
    if (error instanceof YahooSymbolNotFoundError || error instanceof YahooNoDataError) {
      return markInvalid(client, bet, error.message);
    }
    if (error instanceof InvalidPriceError) {
      return markInvalid(client, bet, error.message);
    }
    throw error;
  }
}
