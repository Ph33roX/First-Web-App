import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { bets } from "@/lib/db";
import { getDb } from "@/lib/db/client";
import { checkBetSchema } from "@/lib/validation";
import { BetNotMaturedError, settleBet } from "@/lib/services/settle-bet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = checkBetSchema.parse(body);
    const db = getDb();

    const bet = await db.query.bets.findFirst({ where: eq(bets.id, id) });

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.status === "completed") {
      return NextResponse.json(bet);
    }

    const updated = await settleBet(bet);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to check bet", error);
    if (error instanceof Error && "issues" in error) {
      return NextResponse.json({ error: (error as any).issues }, { status: 422 });
    }
    if (error instanceof BetNotMaturedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to check bet" }, { status: 500 });
  }
}
