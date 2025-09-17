import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  jsonb
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const betStatusEnum = pgEnum("bet_status", ["open", "completed"]);

export const bets = pgTable("bets", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: false })
    .notNull()
    .default(sql`now()`),
  bettorA: text("bettor_a").notNull(),
  bettorB: text("bettor_b").notNull(),
  tickerA: text("ticker_a").notNull(),
  tickerB: text("ticker_b").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: betStatusEnum("status").notNull().default("open"),
  result: jsonb("result").$type<BetResult | null>().default(sql`null`)
});

export type Bet = InferSelectModel<typeof bets>;
export type NewBet = InferInsertModel<typeof bets>;

export type BetResult = {
  aReturn: number;
  bReturn: number;
  winner: "A" | "B" | "Tie";
};
