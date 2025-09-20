import { describe, expect, it } from "vitest";

import {
  InvalidPriceError,
  calculateReturn,
  resolveToTradingDay,
  tradingDayKey
} from "@/lib/finance";

const iso = (date: Date) => tradingDayKey(date);

describe("resolveToTradingDay", () => {
  it("returns the same date for an active trading day when moving forward", () => {
    const day = resolveToTradingDay(new Date("2024-05-15T12:00:00Z"), "next");
    expect(iso(day)).toBe("2024-05-15");
  });

  it("returns the previous trading day for a Saturday", () => {
    const saturday = new Date("2024-05-18T00:00:00Z");
    const resolved = resolveToTradingDay(saturday, "prev");
    expect(iso(resolved)).toBe("2024-05-17");
  });

  it("returns the following trading day for a Sunday", () => {
    const sunday = new Date("2024-05-19T00:00:00Z");
    const resolved = resolveToTradingDay(sunday, "next");
    expect(iso(resolved)).toBe("2024-05-20");
  });

  it("skips Independence Day when moving forward", () => {
    const holiday = new Date("2024-07-04T00:00:00Z");
    const forward = resolveToTradingDay(holiday, "next");
    const backward = resolveToTradingDay(holiday, "prev");
    expect(iso(forward)).toBe("2024-07-05");
    expect(iso(backward)).toBe("2024-07-03");
  });

  it("skips Thanksgiving when determining trading days", () => {
    const holiday = new Date("2024-11-28T00:00:00Z");
    const forward = resolveToTradingDay(holiday, "next");
    const backward = resolveToTradingDay(holiday, "prev");
    expect(iso(forward)).toBe("2024-11-29");
    expect(iso(backward)).toBe("2024-11-27");
  });
});

describe("calculateReturn", () => {
  it("returns raw and rounded gains", () => {
    const start = { date: new Date("2024-01-02T00:00:00Z"), close: 100, adjClose: 100 };
    const end = { date: new Date("2024-01-10T00:00:00Z"), close: 110, adjClose: 110 };
    const result = calculateReturn(start, end);
    expect(result.raw).toBeCloseTo(0.1);
    expect(result.rounded).toBe(0.1);
  });

  it("throws when the start price is zero", () => {
    const start = { date: new Date("2024-01-02T00:00:00Z"), close: 0, adjClose: 0 };
    const end = { date: new Date("2024-01-10T00:00:00Z"), close: 110, adjClose: 110 };
    expect(() => calculateReturn(start, end)).toThrow(InvalidPriceError);
  });
});
