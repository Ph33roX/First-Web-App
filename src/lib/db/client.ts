import { Pool } from "@vercel/postgres";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __dbPool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __db__: NodePgDatabase<typeof schema> | undefined;
}

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "POSTGRES_URL is not defined. Set POSTGRES_URL (pooled connection string) in your runtime environment to connect to the database."
  );
}

const pool = globalThis.__dbPool__ ?? new Pool({ connectionString });
const db = globalThis.__db__ ?? drizzle(pool, { schema });

if (!globalThis.__dbPool__) {
  globalThis.__dbPool__ = pool;
}

if (!globalThis.__db__) {
  globalThis.__db__ = db;
}

export { db, pool };
