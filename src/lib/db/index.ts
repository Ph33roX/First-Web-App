import * as schema from "./schema";

export { db, pool } from "./client";
export const { bets } = schema;
export { betStatusEnum } from "./schema";
export type { Bet, BetLegResult, BetResult, NewBet, QuoteSnapshot } from "./schema";
