import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  bigserial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { bytea } from './custom-types.js';
import {
  taskStatusEnum,
  beeRunStatusEnum,
  reviewStatusEnum,
  sitePolicyStatusEnum,
  beeTypeEnum,
} from './enums.js';

/**
 * Note on `users`: Supabase manages the canonical user table at `auth.users`.
 * We do NOT redefine it here. Foreign keys below reference `auth.users.id` directly
 * via raw SQL in migrations (Drizzle can't introspect the `auth` schema cleanly).
 * If we ever migrate off Supabase Auth, we add a `users` table in our schema and
 * point FKs at it instead — `packages/token-vault` interface is the seam.
 */

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    prompt: text('prompt').notNull(),
    status: taskStatusEnum('status').notNull().default('pending'),
    traceId: text('trace_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdIdx: index('tasks_user_id_idx').on(t.userId),
    statusIdx: index('tasks_status_idx').on(t.status),
  }),
);

export const beeRuns = pgTable(
  'bee_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    beeType: beeTypeEnum('bee_type').notNull(),
    status: beeRunStatusEnum('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    output: jsonb('output'),
    criticPassed: boolean('critic_passed'),
    compliancePassed: boolean('compliance_passed'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdIdx: index('bee_runs_task_id_idx').on(t.taskId),
    statusIdx: index('bee_runs_status_idx').on(t.status),
  }),
);

export const reviewQueueItems = pgTable(
  'review_queue_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    beeRunId: uuid('bee_run_id')
      .notNull()
      .references(() => beeRuns.id, { onDelete: 'cascade' }),
    proposal: jsonb('proposal').notNull(),
    status: reviewStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedBy: uuid('decided_by'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('review_queue_items_status_idx').on(t.status),
  }),
);

export const sitePolicy = pgTable(
  'site_policy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    host: text('host').notNull(),
    status: sitePolicyStatusEnum('status').notNull(),
    reason: text('reason'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
  },
  (t) => ({
    hostUnique: uniqueIndex('site_policy_host_unique').on(t.host),
  }),
);

/**
 * Audit log. INSERT-only enforced by Postgres role permissions in migration.
 * Hash chain (prev_hash, this_hash) is verified by `pnpm verify:audit`.
 * See ADR-0005 for the full design.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    userId: uuid('user_id'),
    traceId: text('trace_id'),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    prevHash: bytea('prev_hash'),
    thisHash: bytea('this_hash').notNull(),
  },
  (t) => ({
    tsIdx: index('audit_log_ts_idx').on(t.ts),
    userIdIdx: index('audit_log_user_id_idx').on(t.userId),
    traceIdIdx: index('audit_log_trace_id_idx').on(t.traceId),
    eventTypeIdx: index('audit_log_event_type_idx').on(t.eventType),
  }),
);

/**
 * Vault tokens stub for Phase 0 — not exercised end-to-end until Phase 1
 * introduces authenticated third-party Bees. The `encrypted_token` column is
 * encrypted at the application layer via pgsodium (see packages/token-vault).
 */
export const vaultTokens = pgTable(
  'vault_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    provider: text('provider').notNull(),
    encryptedToken: bytea('encrypted_token').notNull(),
    scopes: text('scopes').array().notNull().default(sql`ARRAY[]::text[]`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => ({
    userProviderIdx: index('vault_tokens_user_provider_idx').on(t.userId, t.provider),
  }),
);