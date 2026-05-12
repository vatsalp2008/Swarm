import { createHash } from 'node:crypto';
import { canonicalize } from '@swarm/shared';
import { AuditEventType, type AuditEventPayload } from '@swarm/shared';

/**
 * Compute the hash for an audit row.
 *
 * Definition (binding for ADR-0005):
 *   this_hash = SHA-256( prev_hash_bytes || canonical_json(record) )
 *
 * Where `record` is the canonical-JSON-serialized object:
 *   { eventType, userId, traceId, payload, ts }
 *
 * Row 0 has prev_hash = null and the leading bytes are an empty buffer.
 *
 * IMPORTANT: this function is the canonical reference for both the writer and
 * the verifier. Any change here is a chain-breaking schema change and requires
 * an ADR amendment + a migration that re-signs from a known-good snapshot.
 */
export function computeHash(input: {
  prevHash: Buffer | null;
  eventType: string;
  userId: string | null;
  traceId: string | null;
  payload: AuditEventPayload;
  ts: Date;
}): Buffer {
  // Validate event type at hash time so the writer cannot smuggle in unknown types.
  AuditEventType.parse(input.eventType);

  const record = {
    eventType: input.eventType,
    userId: input.userId,
    traceId: input.traceId,
    payload: input.payload,
    ts: input.ts.toISOString(),
  };
  const canonical = canonicalize(record);
  const prev = input.prevHash ?? Buffer.alloc(0);

  const hasher = createHash('sha256');
  hasher.update(prev);
  hasher.update(canonical, 'utf8');
  return hasher.digest();
}