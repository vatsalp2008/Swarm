import { pgEnum } from 'drizzle-orm/pg-core';

export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'in_progress',
  'awaiting_review',
  'approved',
  'denied',
  'failed',
]);

export const beeRunStatusEnum = pgEnum('bee_run_status', [
  'pending',
  'running',
  'succeeded',
  'failed',
  'denied_by_compliance',
  'denied_by_critic',
]);

export const reviewStatusEnum = pgEnum('review_status', [
  'pending',
  'approved',
  'denied',
  'expired',
]);

export const sitePolicyStatusEnum = pgEnum('site_policy_status', [
  'allow',
  'deny',
  'negotiated',
]);

export const beeTypeEnum = pgEnum('bee_type', [
  'research',
  'application',
  'housing',
  'procurement',
  'form',
]);