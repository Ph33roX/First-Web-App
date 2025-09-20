import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { startOfDay, subMilliseconds } from "date-fns";
import { bets } from "@/lib/db";
import { getDb } from "@/lib/db/client";
import { BetNotMaturedError, settleBet } from "@/lib/services/settle-bet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const today = startOfDay(new Date());
  const endOfYesterday = subMilliseconds(today, 1);

  try {
    const db = getDb();
    const dueBets = await db
      .select()
      .from(bets)
      .where(and(eq(bets.status, "open"), lt(bets.endDate, endOfYesterday)));

    const settled = [] as typeof dueBets;
    for (const bet of dueBets) {
      try {
        const updated = await settleBet(bet);
        if (updated) {
          settled.push(updated);
        }
      } catch (error) {
        if (error instanceof BetNotMaturedError) {
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({ count: settled.length, bets: settled });
  } catch (error) {
    console.error("Failed to settle due bets", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Unable to settle bets" }, { status: 500 });
  }
}
