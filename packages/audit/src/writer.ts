import { sql, desc } from 'drizzle-orm';
import { schema, type Db } from '@swarm/db';
import { redact, type AuditEvent } from '@swarm/shared';
import { computeHash } from './hash.js';

/**
 * Postgres advisory lock key for serializing audit_log inserts. The 64-bit
 * key is arbitrary but stable; treat it as a magic constant.
 */
const ADVISORY_LOCK_KEY = 7_316_927_n;

/**
 * Append a single audit event. Holds a transaction-scoped advisory lock to
 * prevent concurrent writers from corrupting the hash chain. PII redaction
 * (regex first pass) runs on the payload before it is hashed and persisted.
 *
 * Returns the inserted row id and computed hash for the caller's traceability.
 */
export async function appendAuditEvent(
  db: Db,
  event: AuditEvent,
): Promise<{ id: number; thisHash: Buffer }> {
  return db.transaction(async (tx) => {
    // Serialize all writers across the chain.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY}::bigint)`);

    const [latest] = await tx
      .select({ thisHash: schema.auditLog.thisHash })
      .from(schema.auditLog)
      .orderBy(desc(schema.auditLog.id))
      .limit(1);

    const prevHash = latest?.thisHash ?? null;
    const ts = new Date();
    const redactedPayload = redact(event.payload);

    const thisHash = computeHash({
      prevHash,
      eventType: event.eventType,
      userId: event.userId,
      traceId: event.traceId,
      payload: redactedPayload,
      ts,
    });

    const [row] = await tx
      .insert(schema.auditLog)
      .values({
        ts,
        userId: event.userId,
        traceId: event.traceId,
        eventType: event.eventType,
        payload: redactedPayload,
        prevHash,
        thisHash,
      })
      .returning({ id: schema.auditLog.id });

    if (!row) throw new Error('audit insert returned no row');
    return { id: row.id, thisHash };
  });
}