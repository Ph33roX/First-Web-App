import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";

import { bets } from "@/lib/db";
import { db } from "@/lib/db/client";
import { createBetSchema, getBetsQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    {
      status: 405,
      headers: {
        Allow: "GET, POST"
      }
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createBetSchema.parse(body);

    const [inserted] = await db
      .insert(bets)
      .values({
        bettorA: data.bettorA,
        bettorB: data.bettorB,
        tickerA: data.tickerA,
        tickerB: data.tickerB,
        startDate: data.startDate,
        endDate: data.endDate
      })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to create bet", error);
    return NextResponse.json({ error: "Unable to create bet" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  try {
    const query = getBetsQuerySchema.parse({
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      page: searchParams.get("page") ?? undefined
    });

    const offset = (query.page - 1) * query.limit;
    const filters = query.status ? [eq(bets.status, query.status)] : [];
    const where = filters.length > 0 ? and(...filters) : undefined;

    let itemsQuery = db
      .select()
      .from(bets)
      .orderBy(desc(bets.createdAt))
      .limit(query.limit)
      .offset(offset);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(bets);

    if (where) {
      itemsQuery = itemsQuery.where(where);
      countQuery = countQuery.where(where);
    }

    const [items, [{ count }]] = await Promise.all([itemsQuery, countQuery]);

    return NextResponse.json({
      items,
      page: query.page,
      limit: query.limit,
      total: Number(count)
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error("Failed to fetch bets", error);
    return NextResponse.json({ error: "Unable to fetch bets" }, { status: 500 });
  }
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
