import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q || q.length < 1) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const yf = await import("yahoo-finance2").then((m) => m.default);

    const res: any = await yf.search(q, { quotesCount: 10, newsCount: 0 });
    const results = (res?.quotes || [])
      .filter((r: any) => !!r.symbol && !!r.exchange)
      .slice(0, 10)
      .map((r: any) => ({
        symbol: r.symbol,
        shortname: r.shortname || null,
        longname: r.longname || null,
        exchShortName: r.exchShortName || r.exchange || null,
      }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json({ results: [], error: "search_failed" }, { status: 200 });
  }
}
