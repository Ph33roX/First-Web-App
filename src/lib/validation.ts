import { z } from "zod";

export const tickerSchema = z
  .string({ required_error: "Ticker is required" })
  .trim()
  .min(1, "Ticker is required")
  .regex(/^[A-Za-z]+$/, "Only letters A-Z are allowed")
  .transform((value) => value.toUpperCase());

export const betFormSchema = z
  .object({
    bettorA: z.string({ required_error: "Bettor A is required" }).trim().min(1, "Bettor A is required"),
    bettorB: z.string({ required_error: "Bettor B is required" }).trim().min(1, "Bettor B is required"),
    tickerA: tickerSchema,
    tickerB: tickerSchema,
    startDate: z.coerce.date({ required_error: "Start date is required" }),
    endDate: z.coerce.date({ required_error: "End date is required" })
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"]
  });

export type BetFormInput = z.infer<typeof betFormSchema>;

export const betFormClientSchema = z
  .object({
    bettorA: z.string({ required_error: "Bettor A is required" }).trim().min(1, "Bettor A is required"),
    bettorB: z.string({ required_error: "Bettor B is required" }).trim().min(1, "Bettor B is required"),
    tickerA: z
      .string({ required_error: "Ticker A is required" })
      .trim()
      .min(1, "Ticker A is required")
      .regex(/^[A-Za-z]+$/, "Only letters A-Z are allowed"),
    tickerB: z
      .string({ required_error: "Ticker B is required" })
      .trim()
      .min(1, "Ticker B is required")
      .regex(/^[A-Za-z]+$/, "Only letters A-Z are allowed"),
    startDate: z.string({ required_error: "Start date is required" }).min(1, "Start date is required"),
    endDate: z.string({ required_error: "End date is required" }).min(1, "End date is required")
  })
  .refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return false;
    }
    return end >= start;
  }, {
    message: "End date must be on or after start date",
    path: ["endDate"]
  });

export type BetFormClientInput = z.infer<typeof betFormClientSchema>;

export const getBetsQuerySchema = z.object({
  status: z.enum(["open", "completed"]).optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
  page: z.coerce.number().int().positive().default(1)
});

export const checkBetSchema = z.object({
  id: z.string().uuid()
});
