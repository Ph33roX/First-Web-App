import { isAfter, startOfDay } from "date-fns";
import { eq } from "drizzle-orm";
import { bets, type Bet, type BetResult } from "@/lib/db";
import { getDb } from "@/lib/db/client";
import { calculateReturn, resolveTradingWindow } from "@/lib/finance";

export class BetNotMaturedError extends Error {
  constructor() {
    super("Bet end date is in the future");
    this.name = "BetNotMaturedError";
  }
}

export async function computeBetResult(bet: Bet): Promise<BetResult> {
  const today = startOfDay(new Date());
  const betEnd = startOfDay(new Date(bet.endDate));

  if (isAfter(betEnd, today)) {
    throw new BetNotMaturedError();
  }

  const [windowA, windowB] = await Promise.all([
    resolveTradingWindow(bet.tickerA, bet.startDate, bet.endDate),
    resolveTradingWindow(bet.tickerB, bet.startDate, bet.endDate)
  ]);

  const aReturn = calculateReturn(windowA.startQuote, windowA.endQuote);
  const bReturn = calculateReturn(windowB.startQuote, windowB.endQuote);

  let winner: BetResult["winner"] = "Tie";
  if (Math.abs(aReturn - bReturn) > 1e-8) {
    winner = aReturn > bReturn ? "A" : "B";
  }

  return {
    aReturn,
    bReturn,
    winner
  };
}

export async function settleBet(bet: Bet) {
  const result = await computeBetResult(bet);
  const db = getDb();
  const [updated] = await db
    .update(bets)
    .set({
      status: "completed",
      result
    })
    .where(eq(bets.id, bet.id))
    .returning();

  return updated;
}
