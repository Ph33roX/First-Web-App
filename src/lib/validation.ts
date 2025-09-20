import { differenceInCalendarDays, isValid, parseISO, formatISO } from "date-fns";
import { z } from "zod";

import { normalizeToYahoo } from "./tickers";

const MAX_RANGE_DAYS = 366;

const nameSchema = (field: string) =>
  z
    .string({ required_error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`)
    .max(80, `${field} must be 80 characters or fewer`);

const tickerSchema = z
  .string({ required_error: "Ticker is required" })
  .trim()
  .min(1, "Ticker is required")
  .max(16, "Ticker must be 16 characters or fewer")
  .transform((value, ctx) => {
    try {
      return normalizeToYahoo(value);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid ticker symbol"
      });
      return z.NEVER;
    }
  });

const isoDateSchema = (field: string) =>
  z
    .string({ required_error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`)
    .transform((value, ctx) => {
      const parsed = parseISO(value);
      if (!isValid(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid ${field.toLowerCase()}` });
        return z.NEVER;
      }
      return formatISO(parsed, { representation: "date" });
    });

const baseCreateBetSchema = z
  .object({
    bettorA: nameSchema("Bettor A"),
    bettorB: nameSchema("Bettor B"),
    tickerA: tickerSchema,
    tickerB: tickerSchema,
    startDate: isoDateSchema("Start date"),
    endDate: isoDateSchema("End date")
  })
  .superRefine((data, ctx) => {
    if (data.tickerA === data.tickerB) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tickers must be different",
        path: ["tickerB"]
      });
    }

    let start: Date | null = null;
    let end: Date | null = null;
    try {
      start = parseISO(data.startDate);
      end = parseISO(data.endDate);
    } catch {
      return;
    }

    if (!isValid(start) || !isValid(end)) {
      return;
    }

    const diff = differenceInCalendarDays(end, start);
    if (diff <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
        path: ["endDate"]
      });
    }
    if (diff > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
        path: ["endDate"]
      });
    }
  });

export const createBetSchema = baseCreateBetSchema;
export const createBetFormSchema = baseCreateBetSchema;
export type CreateBetInput = z.infer<typeof createBetSchema>;

export const getBetsQuerySchema = z.object({
  status: z.enum(["OPEN", "SETTLED", "INVALID"]).optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
  page: z.coerce.number().int().positive().default(1)
});

export type GetBetsQuery = z.infer<typeof getBetsQuerySchema>;

export const checkBetSchema = z.object({
  id: z.string().uuid()
});

export const checkDueQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  cursor: z.string().trim().min(1).optional()
});
