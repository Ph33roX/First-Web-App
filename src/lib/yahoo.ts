import { addDays } from "date-fns";

import { normalizeToYahoo } from "./tickers";

const CHART_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart/";
const LOOKBACK_DAYS = 90;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 200;

export type YahooQuote = {
  date: Date;
  close: number;
  adjClose: number;
};

export class YahooSymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`No data found for symbol ${symbol}`);
    this.name = "YahooSymbolNotFoundError";
  }
}

export class YahooNoDataError extends Error {
  constructor(symbol: string) {
    super(`Unable to locate a price for ${symbol} on or before the requested date.`);
    this.name = "YahooNoDataError";
  }
}

export class YahooTransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YahooTransientError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildUrl(symbol: string, start: Date, end: Date) {
  const params = new URLSearchParams({
    period1: Math.floor(start.getTime() / 1000).toString(),
    period2: Math.floor(end.getTime() / 1000).toString(),
    interval: "1d",
    events: "div,splits",
    includePrePost: "false"
  });
  return `${CHART_ENDPOINT}${encodeURIComponent(symbol)}?${params.toString()}`;
}

function parseQuote(symbol: string, body: any, targetEpoch: number): YahooQuote {
  const result = body?.chart?.result?.[0];
  const error = body?.chart?.error;

  if (error) {
    if (error.code === "Not Found") {
      throw new YahooSymbolNotFoundError(symbol);
    }
    throw new YahooTransientError(error.description ?? "Yahoo Finance returned an error");
  }

  if (!result) {
    throw new YahooNoDataError(symbol);
  }

  const timestamps: number[] = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quoteData = result.indicators?.quote?.[0] ?? {};
  const adjData = result.indicators?.adjclose?.[0] ?? {};
  const closes: Array<number | null | undefined> = Array.isArray(quoteData.close) ? quoteData.close : [];
  const adjCloses: Array<number | null | undefined> = Array.isArray(adjData.adjclose) ? adjData.adjclose : [];

  for (let i = timestamps.length - 1; i >= 0; i -= 1) {
    const ts = timestamps[i];
    if (typeof ts !== "number" || ts > targetEpoch) {
      continue;
    }
    const close = closes[i];
    const adjClose = adjCloses[i];
    if (typeof close === "number" && Number.isFinite(close)) {
      const resolvedAdj = typeof adjClose === "number" && Number.isFinite(adjClose) ? adjClose : close;
      return {
        date: new Date(ts * 1000),
        close,
        adjClose: resolvedAdj
      };
    }
  }

  throw new YahooNoDataError(symbol);
}

export async function getAdjustedCloseOnOrBefore(symbolInput: string, date: Date): Promise<YahooQuote> {
  const normalized = normalizeToYahoo(symbolInput);
  const targetDate = new Date(date);
  const endRange = addDays(targetDate, 1);
  const startRange = addDays(targetDate, -LOOKBACK_DAYS);
  const targetEpoch = Math.floor(endRange.getTime() / 1000) - 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const url = buildUrl(normalized, startRange, endRange);
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          throw new YahooSymbolNotFoundError(normalized);
        }
        if (response.status === 429 || response.status >= 500) {
          throw new YahooTransientError(`Yahoo Finance responded with status ${response.status}`);
        }
        throw new YahooTransientError(`Unexpected Yahoo Finance response: ${response.status}`);
      }

      const body = await response.json();
      return parseQuote(normalized, body, targetEpoch);
    } catch (error) {
      if (error instanceof YahooSymbolNotFoundError || error instanceof YahooNoDataError) {
        throw error;
      }
      lastError = error instanceof Error ? error : new YahooTransientError("Unknown error from Yahoo Finance");
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new YahooNoDataError(normalized);
}
