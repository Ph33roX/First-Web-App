import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const historicalMock = vi.fn();

vi.mock("yahoo-finance2", () => ({
  default: {
    historical: historicalMock
  }
}));

const betRecord: any = {};

vi.mock("@/lib/db", () => {
  return {
    db: {
      query: {
        bets: {
          findFirst: vi.fn(async () => betRecord)
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
    },
    bets: {
      id: { name: "id" }
    }
  };
});

const initialBet = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  bettorA: "Alice",
  bettorB: "Bob",
  tickerA: "AAPL",
  tickerB: "MSFT",
  startDate: new Date("2020-01-02T00:00:00Z"),
  endDate: new Date("2020-01-10T00:00:00Z"),
  createdAt: new Date("2020-01-01T00:00:00Z"),
  status: "open" as const,
  result: null
};

beforeEach(() => {
  Object.assign(betRecord, {
    ...initialBet,
    startDate: new Date(initialBet.startDate),
    endDate: new Date(initialBet.endDate),
    createdAt: new Date(initialBet.createdAt),
    status: "open",
    result: null
  });

  historicalMock.mockReset();
  historicalMock.mockImplementation((ticker: string) => {
    if (ticker === "AAPL") {
      return Promise.resolve([
        { date: new Date("2020-01-02T00:00:00Z"), close: 100, adjClose: 100 },
        { date: new Date("2020-01-10T00:00:00Z"), close: 120, adjClose: 120 }
      ]);
    }
    return Promise.resolve([
      { date: new Date("2020-01-02T00:00:00Z"), close: 100, adjClose: 100 },
      { date: new Date("2020-01-10T00:00:00Z"), close: 110, adjClose: 110 }
    ]);
  });
});

describe("POST /api/check", () => {
  it("settles a bet using yahoo-finance data", async () => {
    const { POST } = await import("./route");
    const request = new NextRequest("http://localhost/api/check", {
      method: "POST",
      body: JSON.stringify({ id: betRecord.id }),
      headers: new Headers({ "content-type": "application/json" })
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.status).toBe("completed");
    expect(data.result.winner).toBe("A");
    expect(data.result.aReturn).toBeCloseTo(0.2);
    expect(data.result.bReturn).toBeCloseTo(0.1);
    expect(betRecord.status).toBe("completed");
    expect(betRecord.result).toEqual(data.result);
    expect(historicalMock).toHaveBeenCalledTimes(2);
  });
});
