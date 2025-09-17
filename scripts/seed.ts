import "dotenv/config";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { bets } from "@/lib/db/schema";

async function main() {
  console.log("Seeding bets table...");
  await db.delete(bets);

  const today = new Date();
  const start = addDays(today, -10);
  const end = addDays(today, -3);

  await db.insert(bets).values([
    {
      bettorA: "Alice",
      bettorB: "Bob",
      tickerA: "AAPL",
      tickerB: "MSFT",
      startDate: start,
      endDate: end,
      status: "open"
    },
    {
      bettorA: "Charlie",
      bettorB: "Dana",
      tickerA: "GOOGL",
      tickerB: "AMZN",
      startDate: addDays(today, -30),
      endDate: addDays(today, -1),
      status: "completed",
      result: {
        aReturn: 0.05,
        bReturn: 0.02,
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
