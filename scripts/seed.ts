import "dotenv/config";
import { randomUUID } from "crypto";

import { addDays, formatISO } from "date-fns";

import { db } from "@/lib/db";
import { bets } from "@/lib/db/schema";

async function main() {
  console.log("Seeding bets table...");
  await db.delete(bets);

  const today = new Date();
  const start = addDays(today, -10);
  const end = addDays(today, -3);

  const quoteSnapshot = (price: number, daysAgo: number) => ({
    date: formatISO(addDays(today, -daysAgo)),
    close: price,
    adjClose: price
  });

  await db.insert(bets).values([
    {
      bettorA: "Alice",
      bettorB: "Bob",
      tickerA: "AAPL",
      tickerB: "MSFT",
      startDate: start,
      endDate: end,
      status: "OPEN"
    },
    {
      bettorA: "Charlie",
      bettorB: "Dana",
      tickerA: "GOOGL",
      tickerB: "AMZN",
      startDate: addDays(today, -30),
      endDate: addDays(today, -1),
      status: "SETTLED",
      settledAt: today,
      settlementTxId: randomUUID(),
      result: {
        a: {
          ticker: "GOOGL",
          start: quoteSnapshot(100, 30),
          end: quoteSnapshot(105, 1),
          raw: 0.05,
          rounded: 0.05
        },
        b: {
          ticker: "AMZN",
          start: quoteSnapshot(90, 30),
          end: quoteSnapshot(92, 1),
          raw: 0.0222,
          rounded: 0.0222
        },
        winner: "A"
      }
    }
  ]);

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
