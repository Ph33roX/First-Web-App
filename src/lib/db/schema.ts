import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export const betStatusEnum = pgEnum("bet_status", ["OPEN", "SETTLED", "INVALID"]);

export const bets = pgTable(
  "bets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
    settledAt: timestamp("settled_at", { withTimezone: false }),
    settlementTxId: uuid("settlement_tx_id"),
    bettorA: varchar("bettor_a", { length: 80 }).notNull(),
    bettorB: varchar("bettor_b", { length: 80 }).notNull(),
    tickerA: varchar("ticker_a", { length: 16 }).notNull(),
    tickerB: varchar("ticker_b", { length: 16 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: betStatusEnum("status").notNull().default("OPEN"),
    settlementError: text("settlement_error"),
    result: jsonb("result").$type<BetResult | null>().default(sql`null`)
  },
  (table) => ({
    statusEndDateIdx: index("idx_bets_status_enddate").on(table.status, table.endDate),
    enforceDateOrder: check("chk_bets_end_after_start", sql`${table.endDate} > ${table.startDate}`)
  })
);

export type Bet = InferSelectModel<typeof bets>;
export type NewBet = InferInsertModel<typeof bets>;

export type QuoteSnapshot = {
  date: string;
  close: number;
  adjClose: number;
};

export type BetLegResult = {
  ticker: string;
  start: QuoteSnapshot;
  end: QuoteSnapshot;
  raw: number;
  rounded: number;
};

export type BetResult = {
  a: BetLegResult;
  b: BetLegResult;
  winner: "A" | "B" | "Tie";
};
