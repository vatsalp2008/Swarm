import { asc } from 'drizzle-orm';
import { getDb, closeDb, schema } from '@swarm/db';
import { computeHash } from './hash.js';

/**
 * Replay the audit log from row 1 and verify each row's `this_hash`.
 *
 * Run on every CI build (against a sandbox DB seeded with fixtures) and as
 * a periodic cron in production. Exit non-zero on chain divergence.
 */
export async function verifyAuditChain(): Promise<{
  rowsChecked: number;
  ok: boolean;
  divergedAt: number | null;
}> {
  const db = getDb();

  const rows = await db.select().from(schema.auditLog).orderBy(asc(schema.auditLog.id));

  let rowsChecked = 0;
  let prevHash: Buffer | null = null;

  for (const row of rows) {
    const expected = computeHash({
      prevHash,
      eventType: row.eventType,
      userId: row.userId,
      traceId: row.traceId,
      payload: row.payload as Record<string, unknown>,
      ts: row.ts,
    });

    const actual = row.thisHash as Buffer;

    if (!expected.equals(actual)) {
      return { rowsChecked, ok: false, divergedAt: row.id };
    }

    prevHash = actual;
    rowsChecked++;
  }

  return { rowsChecked, ok: true, divergedAt: null };
}

// CLI entry point: `pnpm --filter @swarm/audit verify`
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyAuditChain()
    .then(async (result) => {
      await closeDb();
      if (!result.ok) {
        console.error(`AUDIT CHAIN DIVERGED at row ${result.divergedAt} (after ${result.rowsChecked} valid rows)`);
        process.exit(2);
      }
      console.log(`audit chain OK (${result.rowsChecked} rows verified)`);
      process.exit(0);
    })
    .catch(async (err) => {
      await closeDb();
      console.error(err);
      process.exit(1);
    });
}