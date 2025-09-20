import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { QuoteSnapshot } from "@/lib/db";
import { getAdjustedCloseOnOrBefore, type YahooQuote } from "./yahoo";

const TIME_ZONE = "America/New_York";
const MAX_TRADING_DAY_LOOKUP = 366;

const holidayCache = new Map<number, Set<string>>();

export class InvalidPriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPriceError";
  }
}

export class TradingDayResolutionError extends Error {
  constructor(date: Date) {
    super(`Could not resolve trading day for ${date.toISOString()}`);
    this.name = "TradingDayResolutionError";
  }
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

function isoInNy(date: Date) {
  return formatInTimeZone(date, TIME_ZONE, "yyyy-MM-dd");
}

export function tradingDayKey(date: Date) {
  return isoInNy(date);
}

function isoYear(date: Date) {
  return Number(formatInTimeZone(date, TIME_ZONE, "yyyy"));
}

function toNyMidnight(date: Date) {
  const iso = date.toISOString().slice(0, 10);
  return fromZonedTime(`${iso}T00:00:00`, TIME_ZONE);
}

function nyDate(year: number, month: number, day: number) {
  const paddedMonth = `${month}`.padStart(2, "0");
  const paddedDay = `${day}`.padStart(2, "0");
  return fromZonedTime(`${year}-${paddedMonth}-${paddedDay}T00:00:00`, TIME_ZONE);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number) {
  const firstOfMonth = nyDate(year, month, 1);
  const firstWeekday = Number(formatInTimeZone(firstOfMonth, TIME_ZONE, "i")); // 1 (Mon) - 7 (Sun)
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return nyDate(year, month, day);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const lastOfMonth = nyDate(year, month, daysInMonth);
  const lastWeekday = Number(formatInTimeZone(lastOfMonth, TIME_ZONE, "i"));
  const offset = (lastWeekday - weekday + 7) % 7;
  const day = daysInMonth - offset;
  return nyDate(year, month, day);
}

function observedFixedHoliday(year: number, month: number, day: number) {
  const base = nyDate(year, month, day);
  const weekday = Number(formatInTimeZone(base, TIME_ZONE, "i"));
  if (weekday === 6) {
    // Saturday observed on Friday
    return addDays(base, -1);
  }
  if (weekday === 7) {
    // Sunday observed on Monday
    return addDays(base, 1);
  }
  return base;
}

function calculateEaster(year: number) {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return nyDate(year, month, day);
}

function buildHolidaySet(year: number) {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  const holidays = new Set<string>();

  const addIfSameYear = (date: Date) => {
    const iso = isoInNy(date);
    if (isoYear(date) === year) {
      holidays.add(iso);
    }
  };

  addIfSameYear(observedFixedHoliday(year, 1, 1)); // New Year's Day
  addIfSameYear(observedFixedHoliday(year + 1, 1, 1)); // New Year's observed that falls in prior year
  addIfSameYear(nthWeekdayOfMonth(year, 1, 1, 3)); // Martin Luther King Jr. Day
  addIfSameYear(nthWeekdayOfMonth(year, 2, 1, 3)); // Presidents' Day
  addIfSameYear(addDays(calculateEaster(year), -2)); // Good Friday
  addIfSameYear(lastWeekdayOfMonth(year, 5, 1)); // Memorial Day
  addIfSameYear(observedFixedHoliday(year, 6, 19)); // Juneteenth
  addIfSameYear(observedFixedHoliday(year, 7, 4)); // Independence Day
  addIfSameYear(nthWeekdayOfMonth(year, 9, 1, 1)); // Labor Day
  addIfSameYear(nthWeekdayOfMonth(year, 11, 4, 4)); // Thanksgiving
  addIfSameYear(observedFixedHoliday(year, 12, 25)); // Christmas

  holidayCache.set(year, holidays);
  return holidays;
}

function isTradingHoliday(date: Date) {
  const iso = isoInNy(date);
  const year = isoYear(date);
  const holidays = buildHolidaySet(year);
  return holidays.has(iso);
}

function isTradingDay(date: Date) {
  const weekday = Number(formatInTimeZone(date, TIME_ZONE, "i")); // 1 (Mon) - 7 (Sun)
  if (weekday >= 6) {
    return false;
  }
  return !isTradingHoliday(date);
}

export function resolveToTradingDay(input: Date, direction: "next" | "prev" = "next"): Date {
  let cursor = toNyMidnight(input);

  for (let step = 0; step < MAX_TRADING_DAY_LOOKUP; step += 1) {
    if (isTradingDay(cursor)) {
      return cursor;
    }
    cursor = direction === "next" ? addDays(cursor, 1) : addDays(cursor, -1);
  }

  throw new TradingDayResolutionError(input);
}

export function toQuoteSnapshot(quote: YahooQuote): QuoteSnapshot {
  return {
    date: quote.date.toISOString(),
    close: Number(quote.close.toFixed(6)),
    adjClose: Number(quote.adjClose.toFixed(6))
  };
}

export type PriceReturn = {
  raw: number;
  rounded: number;
};

export function calculateReturn(start: YahooQuote, end: YahooQuote): PriceReturn {
  const startPrice = start.adjClose;
  const endPrice = end.adjClose;

  if (!Number.isFinite(startPrice) || startPrice <= 0) {
    throw new InvalidPriceError("Start price is missing or zero");
  }
  if (!Number.isFinite(endPrice)) {
    throw new InvalidPriceError("End price is missing");
  }

  const raw = (endPrice - startPrice) / startPrice;
  return {
    raw,
    rounded: Number(raw.toFixed(4))
  };
}

export async function getQuoteOnOrBefore(symbol: string, tradingDay: Date) {
  return getAdjustedCloseOnOrBefore(symbol, tradingDay);
}
