import yahooFinance from "yahoo-finance2";
import { addDays, subDays } from "date-fns";

export type Quote = {
  date: Date;
  adjClose: number | null;
  close: number;
};

export type TradingWindow = {
  startQuote: Quote;
  endQuote: Quote;
};

function normalizeQuote(raw: yahooFinance.YahooHistoricalRow): Quote {
  return {
    date: raw.date instanceof Date ? raw.date : new Date(raw.date),
    adjClose: raw.adjClose ?? null,
    close: raw.close
  };
}

function toDate(date: Date | string) {
  return date instanceof Date ? date : new Date(date);
}

export async function resolveTradingWindow(
  ticker: string,
  startDate: Date | string,
  endDate: Date | string
): Promise<TradingWindow> {
  const start = toDate(startDate);
  const end = toDate(endDate);

  const period1 = subDays(start, 10);
  const period2 = addDays(end, 10);

  const rows = await yahooFinance.historical(ticker, {
    period1,
    period2,
    interval: "1d"
  });

  const quotes = rows.map(normalizeQuote).sort((a, b) => a.date.getTime() - b.date.getTime());

  const startQuote = quotes.find((quote) => quote.date >= start);
  const endQuote = [...quotes].reverse().find((quote) => quote.date <= end);

  if (!startQuote || !endQuote) {
    throw new Error(`No trading data available for ${ticker} in the requested range.`);
  }

  return {
    startQuote,
    endQuote
  };
}

export function calculateReturn(start: Quote, end: Quote) {
  const startPrice = start.adjClose ?? start.close;
  const endPrice = end.adjClose ?? end.close;

  if (startPrice === 0) {
    throw new Error("Start price is zero, cannot compute return");
  }

  return (endPrice - startPrice) / startPrice;
}
