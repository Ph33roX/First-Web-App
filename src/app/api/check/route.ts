import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

import { bets } from "@/lib/db";
import { db } from "@/lib/db/client";
import { BetNotMaturedError, settleBet } from "@/lib/services/settle-bet";
import { checkBetSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    {
      status: 405,
      headers: {
        Allow: "POST"
      }
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = checkBetSchema.parse(body);

    const bet = await db.query.bets.findFirst({ where: eq(bets.id, id) });

    if (!bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.status !== "OPEN") {
      return NextResponse.json(bet, { status: 200 });
    }

    try {
      const result = await settleBet(bet);
      if (result.status === "PENDING") {
        return NextResponse.json(result, { status: 202 });
      }
      return NextResponse.json(result.bet, { status: 200 });
    } catch (error) {
      if (error instanceof BetNotMaturedError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to check bet", error);
    return NextResponse.json({ error: "Unable to check bet" }, { status: 500 });
  }
}

export async function GET() {
  return methodNotAllowed();
}

export async function PUT() {
  return methodNotAllowed();
}

export async function PATCH() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}

export async function HEAD() {
  return methodNotAllowed();
}
