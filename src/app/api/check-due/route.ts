import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import { formatISO, parseISO } from "date-fns";
import { isValid } from "date-fns";
import { z, ZodError } from "zod";

import { bets } from "@/lib/db";
import { db } from "@/lib/db/client";
import { BetNotMaturedError, settleBet } from "@/lib/services/settle-bet";
import { checkDueQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const uuidSchema = z.string().uuid();

type ParsedCursor = {
  endDate: Date;
  id: string;
  raw: string;
};

function parseCursor(value: string): ParsedCursor {
  const [datePart, idPart] = value.split("|");
  if (!datePart || !idPart) {
    throw new Error("Cursor must be in the format <endDate>|<id>");
  }

  const idResult = uuidSchema.safeParse(idPart);
  if (!idResult.success) {
    throw new Error("Cursor id must be a valid UUID");
  }

  const parsedDate = parseISO(datePart);
  if (!isValid(parsedDate)) {
    throw new Error("Cursor date must be a valid ISO date (YYYY-MM-DD)");
  }

  return { endDate: parsedDate, id: idResult.data, raw: value };
}

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
    const { searchParams } = req.nextUrl;
    const query = checkDueQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined
    });

    let cursor: ParsedCursor | null = null;
    if (query.cursor) {
      try {
        cursor = parseCursor(query.cursor);
      } catch (cursorError) {
        return NextResponse.json(
          { error: cursorError instanceof Error ? cursorError.message : "Invalid cursor" },
          { status: 400 }
        );
      }
    }
    const limit = query.limit;
    const todayIso = formatISO(new Date(), { representation: "date" });

    const result = await db.transaction(async (tx) => {
      const conditions = [
        eq(bets.status, "OPEN"),
        isNull(bets.settledAt),
        lte(bets.endDate, todayIso)
      ];

      if (cursor) {
        const cursorDateIso = formatISO(cursor.endDate, { representation: "date" });
        conditions.push(
          or(
            lt(bets.endDate, cursorDateIso),
            and(eq(bets.endDate, cursorDateIso), gt(bets.id, cursor.id))
          )
        );
      }

      const dueBets = await tx
        .select()
        .from(bets)
        .where(and(...conditions))
        .orderBy(asc(bets.endDate), asc(bets.id))
        .limit(limit)
        .for("update", { skipLocked: true });

      const summary = {
        scanned: dueBets.length,
        settled: 0,
        pending: 0,
        errors: 0
      };

      const processed: Array<{
        id: string;
        status: string;
        reason?: string | null;
      }> = [];

      for (const bet of dueBets) {
        try {
          const outcome = await settleBet(bet, tx);
          processed.push({
            id: outcome.bet.id,
            status: outcome.status,
            reason: outcome.bet.settlementError ?? null
          });

          if (outcome.status === "SETTLED") {
            summary.settled += 1;
          } else if (outcome.status === "PENDING") {
            summary.pending += 1;
          } else {
            summary.errors += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          if (error instanceof BetNotMaturedError) {
            summary.pending += 1;
            processed.push({ id: bet.id, status: "PENDING", reason: message });
            continue;
          }

          summary.errors += 1;
          await tx
            .update(bets)
            .set({ settlementError: message })
            .where(eq(bets.id, bet.id));
          processed.push({ id: bet.id, status: "ERROR", reason: message });
        }
      }

      const lastBet = dueBets.at(-1);
      const nextCursor = lastBet
        ? `${typeof lastBet.endDate === "string" ? lastBet.endDate : formatISO(lastBet.endDate, { representation: "date" })}|${lastBet.id}`
        : null;

      return { summary, cursor: nextCursor, processed };
    });

    return NextResponse.json({
      ...result.summary,
      cursor: result.cursor,
      processed: result.processed
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to settle due bets", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to settle bets" },
      { status: 500 }
    );
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
