import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "").trim();
    if (!symbol) {
      return NextResponse.json({ error: "missing_symbol" }, { status: 400 });
    }

    const yf = await import("yahoo-finance2").then((m) => m.default);

    const qs: any = await yf.quoteSummary(symbol, { modules: ["price", "assetProfile"] });
    const price = qs?.price || {};
    const profile = qs?.assetProfile || {};

    return NextResponse.json({
      symbol: price?.symbol ?? symbol,
      shortname: price?.shortName ?? null,
      longname: price?.longName ?? null,
      description: profile?.longBusinessSummary ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: "summary_failed" }, { status: 200 });
  }
}
