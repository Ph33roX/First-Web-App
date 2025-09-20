import { describe, expect, it } from "vitest";

import { normalizeToYahoo } from "@/lib/tickers";

describe("normalizeToYahoo", () => {
  it("uppercases and trims symbols", () => {
    expect(normalizeToYahoo(" goog ")).toBe("GOOG");
  });

  it("maps share classes with dots to hyphenated symbols", () => {
    expect(normalizeToYahoo("brk.b")).toBe("BRK-B");
    expect(normalizeToYahoo("BF.B")).toBe("BF-B");
  });

  it("maps GOOGLE to the class A ticker", () => {
    expect(normalizeToYahoo("google")).toBe("GOOGL");
  });

  it("throws on unsupported characters", () => {
    expect(() => normalizeToYahoo("BAD$")).toThrow(/Ticker must contain only letters/);
  });
});
