# ADR-0005 — Audit log: Postgres append-only table with per-row SHA-256 hash chain

- **Status:** Accepted
- **Date:** 2026-04-25
- **Deciders:** Vatsal (founder)

## Context

The original brief specified an append-only Postgres audit table with optional daily roll-up hashes anchored to Solana via the SAS (Solana Attestation Service) for tamper-evidence.

The audit log is the single most important defense surface for SWARM:

- It is the primary evidence in any liability dispute ("user approved this action at this timestamp").
- It is the substrate for SOC 2 Type II evidence collection.
- It must be tamper-evident — a malicious actor (insider or attacker) who edits historical rows must leave a detectable trace.

Solana anchoring buys public-chain tamper-evidence. The marginal value over a hash chain in Postgres is approximately zero before a deposition (which we are nowhere near), at the cost of an additional dependency, ongoing fees, key management for the signing key, and operational complexity.

## Decision

1. **`audit_log` is a Postgres append-only table.** Inserts only; no updates; no deletes. Enforced via Postgres role permissions (the application role has INSERT but not UPDATE/DELETE on this table).
2. **Each row has `prev_hash` and `this_hash` columns.** `this_hash = SHA-256(prev_hash || canonical_json(payload))`. Row 0 has `prev_hash = NULL` and `this_hash = SHA-256("" || canonical_json(payload))`.
3. **Verification:** a `pnpm verify:audit` script replays the chain from row 0 and asserts each row's `this_hash` matches the computation. Run on every CI build and as a periodic cron in production.
4. **Solana anchoring is dropped.** May be revisited in Phase 3+ if a regulated enterprise customer asks for it.
5. **Retention:** the audit log retains user-identifying foreign keys for 90 days post account-deletion (per CCPA/GDPR right-to-deletion); after that, user FKs are nulled but the row itself is retained indefinitely with a tombstone marker. Hash chain integrity is preserved (the payload is deterministically rewritten to the tombstone form, with a chain rewrite that re-signs the affected suffix; the rewrite event is itself logged).

## Consequences

- **Pros:** Zero added vendor surface. Sufficient for SOC 2 Type II — the standard does not require public-chain anchoring. Hash chain detects insider tampering with the application database. Simple, testable.
- **Cons:** Does not detect tampering by a Postgres superuser who edits both the row AND the chain forward. Mitigation: Phase 2+ daily DB snapshot with off-platform retention (S3 bucket with object lock); periodic `verify:audit` cron alerts on chain divergence between snapshots.
- **Cons:** Right-to-deletion creates a tension with hash chain immutability. We resolve by tombstoning + chain rewrite; the rewrite is itself an audit event, so the historical record of "user X requested deletion at time T" is preserved.

## Revisit if

- A regulated enterprise customer requires public-chain anchoring as part of a contract (BAA, SOC 2, FedRAMP path).
- We discover a class of tampering attack the hash chain doesn't cover that snapshots also can't catch.
- Postgres becomes a scaling bottleneck for audit writes (we are nowhere near this).

## Schema (illustrative; canonical version lives in `packages/db/src/schema/audit.ts`)

```ts
audit_log {
  id              bigserial primary key
  ts              timestamptz not null default now()
  user_id         uuid references users(id) on delete restrict  -- never cascade-delete; tombstone instead
  trace_id        text                        -- LangSmith trace ID
  event_type      text not null               -- e.g., 'task.created', 'bee_run.started', 'review.approved'
  payload         jsonb not null              -- canonical JSON; redacted of PII before write
  prev_hash       bytea                       -- null only for id=1
  this_hash       bytea not null              -- SHA-256(prev_hash || canonical_json(payload))
}
```

Row-level enforcement: INSERT only via a stored procedure that reads the previous row's hash inside the same transaction and computes `this_hash`. UPDATE / DELETE on the table are revoked from the application role.
