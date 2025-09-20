// src/lib/db/client.ts
// Server-only DB client for Vercel Postgres + Drizzle without build-time env reads.

import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";

import * as schema from "./schema";

// No env reads at module scope. @vercel/postgres `sql` defers to runtime env.
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  _db = drizzle({ client: sql, schema });
  return _db;
}
