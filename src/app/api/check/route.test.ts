import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

import { resolveToTradingDay } from "@/lib/finance";
import {
  YahooNoDataError,
  YahooSymbolNotFoundError,
  YahooTransientError
} from "@/lib/yahoo";

const yahooMockState = vi.hoisted(() => ({
  mockGetQuote: undefined as ReturnType<typeof vi.fn> | undefined
}));

type QuoteFixture = {
  symbol: string;
  date: Date;
  price: number;
};

let currentFixtures: QuoteFixture[] = [];

const lookupQuote = (symbol: string, date: Date) => {
  const key = `${symbol}-${date.toISOString()}`;
  const match = currentFixtures.find((fixture) => `${fixture.symbol}-${fixture.date.toISOString()}` === key);
  if (!match) {
    throw new YahooNoDataError(symbol);
  }
  return {
    date: match.date,
    close: match.price,
    adjClose: match.price
  };
};

vi.mock("@/lib/yahoo", async () => {
  const actual = await vi.importActual<typeof import("@/lib/yahoo")>("@/lib/yahoo");
  const getQuoteMock = vi.fn(async (symbol: string, date: Date) => lookupQuote(symbol, date));
  yahooMockState.mockGetQuote = getQuoteMock;
  return {
    ...actual,
    getAdjustedCloseOnOrBefore: getQuoteMock
  };
});

const betRecord: any = {};
const findFirstSpy = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    query: {
      bets: {
        findFirst: findFirstSpy
      }
    },
    update: vi.fn(() => ({
      set: (values: any) => ({
        where: () => ({
          returning: async () => {
            Object.assign(betRecord, values);
            return [betRecord];
          }
        })
      })
    }))
  }
}));

const ensureYahooMock = () => {
  const mockGetQuote = yahooMockState.mockGetQuote;
  if (!mockGetQuote) {
    throw new Error("Yahoo mock not initialized");
  }
  return mockGetQuote;
};

const setQuoteFixtures = (fixtures: QuoteFixture[]) => {
  currentFixtures = fixtures;
  ensureYahooMock().mockImplementation(async (symbol: string, date: Date) => lookupQuote(symbol, date));
};

const initializeBet = (overrides: Partial<typeof betRecord> = {}) => {
  Object.assign(betRecord, {
    id: "123e4567-e89b-12d3-a456-426614174000",
    bettorA: "Alice",
    bettorB: "Bob",
    tickerA: "AAPL",
    tickerB: "MSFT",
    startDate: new Date("2020-01-02T00:00:00Z"),
    endDate: new Date("2020-01-10T00:00:00Z"),
    createdAt: new Date("2020-01-01T00:00:00Z"),
    updatedAt: new Date("2020-01-01T00:00:00Z"),
    settledAt: null,
    settlementTxId: null,
    settlementError: null,
    status: "OPEN",
    result: null,
    ...overrides
  });
};

const buildFixtures = (config: { start: string; end: string; a: { start: number; end: number }; b: { start: number; end: number } }) => {
  const startTradingDayA = resolveToTradingDay(new Date(config.start), "next");
  const endTradingDayA = resolveToTradingDay(new Date(config.end), "prev");
  const startTradingDayB = startTradingDayA;
  const endTradingDayB = endTradingDayA;

  return [
    { symbol: "AAPL", date: startTradingDayA, price: config.a.start },
    { symbol: "AAPL", date: endTradingDayA, price: config.a.end },
    { symbol: "MSFT", date: startTradingDayB, price: config.b.start },
    { symbol: "MSFT", date: endTradingDayB, price: config.b.end }
  ];
};

const createRequest = () =>
  new NextRequest("http://localhost/api/check", {
    method: "POST",
    body: JSON.stringify({ id: betRecord.id }),
    headers: new Headers({ "content-type": "application/json" })
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2020-01-20T00:00:00Z"));
  currentFixtures = [];
  ensureYahooMock().mockReset();
  findFirstSpy.mockReset();
  findFirstSpy.mockImplementation(async () => betRecord);
  initializeBet();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/check", () => {
  it("settles a bet using Yahoo Finance data", async () => {
    setQuoteFixtures(
      buildFixtures({
        start: "2020-01-02",
        end: "2020-01-10",
        a: { start: 100, end: 120 },
        b: { start: 90, end: 99 }
      })
    );

    const { POST } = await import("./route");
    const request = createRequest();

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = (await response.json()) as typeof betRecord;

    expect(data.status).toBe("SETTLED");
    expect(data.result?.winner).toBe("A");
    expect(data.result?.a.rounded).toBeCloseTo(0.2);
    expect(data.result?.b.rounded).toBeCloseTo(0.1);
    expect(betRecord.status).toBe("SETTLED");
    expect(ensureYahooMock()).toHaveBeenCalledTimes(4);
  });

  it("settles when the end date falls on a weekend", async () => {
    initializeBet({
      startDate: new Date("2020-01-02T00:00:00Z"),
      endDate: new Date("2020-01-05T00:00:00Z")
    });

    setQuoteFixtures(
      buildFixtures({
        start: "2020-01-02",
        end: "2020-01-05",
        a: { start: 50, end: 55 },
        b: { start: 40, end: 35 }
      })
    );

    const { POST } = await import("./route");
    const request = createRequest();

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.status).toBe("SETTLED");
    expect(data.result.a.rounded).toBeCloseTo(0.1);
    expect(data.result.b.rounded).toBeCloseTo(-0.125);
  });

  it("handles ranges that resolve to the same trading day", async () => {
    initializeBet({
      startDate: new Date("2020-01-03T00:00:00Z"),
      endDate: new Date("2020-01-04T00:00:00Z")
    });

    setQuoteFixtures(
      buildFixtures({
        start: "2020-01-03",
        end: "2020-01-03",
        a: { start: 70, end: 70 },
        b: { start: 80, end: 80 }
      })
    );

    const { POST } = await import("./route");
    const request = createRequest();

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.status).toBe("SETTLED");
    expect(data.result.a.rounded).toBe(0);
    expect(data.result.b.rounded).toBe(0);
  });

  it("marks a bet invalid when a ticker is not found", async () => {
    setQuoteFixtures(
      buildFixtures({
        start: "2020-01-02",
        end: "2020-01-10",
        a: { start: 100, end: 120 },
        b: { start: 90, end: 99 }
      })
    );

    ensureYahooMock().mockImplementation(async (symbol: string, date: Date) => {
      if (symbol === "AAPL") {
        throw new YahooSymbolNotFoundError(symbol);
      }
      return lookupQuote(symbol, date);
    });

    const { POST } = await import("./route");
    const request = createRequest();

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.status).toBe("INVALID");
    expect(betRecord.status).toBe("INVALID");
    expect(betRecord.settlementError).toContain("No data");
  });

  it("returns a pending response when Yahoo data is not yet available", async () => {
    setQuoteFixtures(
      buildFixtures({
        start: "2020-01-02",
        end: "2020-01-10",
        a: { start: 100, end: 120 },
        b: { start: 100, end: 100 }
      })
    );

    const endTradingDay = resolveToTradingDay(new Date("2020-01-10"), "prev");

    ensureYahooMock().mockImplementation(async (symbol: string, date: Date) => {
      if (symbol === "AAPL" && date.toISOString() === endTradingDay.toISOString()) {
        throw new YahooTransientError("awaiting close");
      }
      return lookupQuote(symbol, date);
    });

    const { POST } = await import("./route");
    const request = createRequest();

    const response = await POST(request);
    expect(response.status).toBe(202);
    const data = await response.json();

    expect(data.status).toBe("PENDING");
    expect(betRecord.status).toBe("OPEN");
    expect(betRecord.settlementError).toContain("awaiting close");
  });

  it("is idempotent when the bet is already settled", async () => {
    setQuoteFixtures(
      buildFixtures({
        start: "2020-01-02",
        end: "2020-01-10",
        a: { start: 100, end: 105 },
        b: { start: 95, end: 94 }
      })
    );

    const { POST } = await import("./route");
    const firstRequest = createRequest();

    await POST(firstRequest);

    ensureYahooMock().mockClear();
    findFirstSpy.mockImplementation(async () => ({ ...betRecord }));

    const secondResponse = await POST(createRequest());
    expect(secondResponse.status).toBe(200);
    const payload = await secondResponse.json();

    expect(payload.status).toBe("SETTLED");
    expect(ensureYahooMock()).not.toHaveBeenCalled();
  });
});
