import { z } from 'zod';

/**
 * Audit event vocabulary. Add events here when introducing new auditable actions.
 * Every event_type written to audit_log MUST exist in this enum — the audit writer
 * validates against it. This forces engineers to declare new auditable surfaces
 * intentionally rather than smuggling them in via a string literal.
 */
export const AuditEventType = z.enum([
  'user.signed_up',
  'user.signed_in',
  'user.deleted',
  'task.created',
  'task.failed',
  'bee_run.started',
  'bee_run.completed',
  'bee_run.failed',
  'compliance.denied',
  'critic.failed',
  'review.created',
  'review.approved',
  'review.denied',
  'review.expired',
  'site_policy.updated',
  'vault.token_stored',
  'vault.token_revoked',
  'vault.token_accessed',
]);
export type AuditEventType = z.infer<typeof AuditEventType>;

export const AuditEventPayload = z.record(z.string(), z.unknown());
export type AuditEventPayload = z.infer<typeof AuditEventPayload>;

export const AuditEvent = z.object({
  userId: z.string().uuid().nullable(),
  traceId: z.string().nullable(),
  eventType: AuditEventType,
  payload: AuditEventPayload,
});
export type AuditEvent = z.infer<typeof AuditEvent>;
