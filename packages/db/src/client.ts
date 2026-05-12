import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

let cached: ReturnType<typeof drizzle> | null = null;
let cachedConn: ReturnType<typeof postgres> | null = null;

/**
 * Singleton Postgres + Drizzle client. Reads DATABASE_URL from env.
 *
 * `prepare: false` is required for Supabase pooled connections (port 6543).
 * If you connect to the direct port (5432), set `DATABASE_DIRECT=1` to enable
 * prepared statements — useful for migrations and verify-audit.
 */
export function getDb() {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }
  const usePrepared = process.env.DATABASE_DIRECT === '1';

  cachedConn = postgres(url, { prepare: usePrepared });
  cached = drizzle(cachedConn, { schema, logger: process.env.DRIZZLE_LOGGER === '1' });
  return cached;
}

/** Close the connection (for tests, scripts, graceful shutdown). */
export async function closeDb() {
  if (cachedConn) {
    await cachedConn.end();
    cachedConn = null;
    cached = null;
  }
}

export type Db = ReturnType<typeof getDb>;