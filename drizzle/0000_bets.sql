CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "bet_status" AS ENUM ('OPEN', 'SETTLED', 'INVALID');

CREATE TABLE "bets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "settled_at" timestamp,
  "settlement_tx_id" uuid,
  "bettor_a" varchar(80) NOT NULL,
  "bettor_b" varchar(80) NOT NULL,
  "ticker_a" varchar(16) NOT NULL,
  "ticker_b" varchar(16) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" "bet_status" NOT NULL DEFAULT 'OPEN',
  "settlement_error" text,
  "result" jsonb DEFAULT null,
  CONSTRAINT "chk_bets_end_after_start" CHECK ("end_date" > "start_date")
);

CREATE INDEX "idx_bets_status_enddate" ON "bets" ("status", "end_date");
