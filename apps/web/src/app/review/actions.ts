'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@swarm/db';
import { appendAuditEvent } from '@swarm/audit';
import { ReviewStatus } from '@swarm/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * Approve or deny a Review Queue item.
 *
 * Authorization model: the action loads the queue item, joins to tasks, and
 * verifies the row belongs to the caller. Any mismatch returns "not found"
 * rather than "forbidden" so we don't leak the existence of other users' rows.
 *
 * Audit events emitted on every transition (review.approved / review.denied)
 * plus a task status update. The audit_log hash chain takes care of
 * tamper-evidence per ADR-0005.
 */

async function decide(reviewId: string, decision: 'approved' | 'denied') {
  const parse = ReviewStatus.safeParse(decision);
  if (!parse.success || (decision !== 'approved' && decision !== 'denied')) {
    return { ok: false as const, error: 'invalid decision' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'unauthorized' };

  const db = getDb();

  // Authz check — must own the underlying task. Single query.
  const [row] = await db
    .select({
      reviewId: schema.reviewQueueItems.id,
      reviewStatus: schema.reviewQueueItems.status,
      taskId: schema.tasks.id,
      userId: schema.tasks.userId,
      beeRunId: schema.reviewQueueItems.beeRunId,
    })
    .from(schema.reviewQueueItems)
    .innerJoin(schema.beeRuns, eq(schema.reviewQueueItems.beeRunId, schema.beeRuns.id))
    .innerJoin(schema.tasks, eq(schema.beeRuns.taskId, schema.tasks.id))
    .where(eq(schema.reviewQueueItems.id, reviewId))
    .limit(1);

  if (!row || row.userId !== user.id) {
    return { ok: false as const, error: 'not_found' };
  }
  if (row.reviewStatus !== 'pending') {
    return { ok: false as const, error: 'already_decided' };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.reviewQueueItems)
      .set({ status: decision, decidedAt: new Date(), decidedBy: user.id })
      .where(
        and(
          eq(schema.reviewQueueItems.id, reviewId),
          eq(schema.reviewQueueItems.status, 'pending'),
        ),
      );

    await tx
      .update(schema.tasks)
      .set({
        status: decision === 'approved' ? 'approved' : 'denied',
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, row.taskId));
  });

  // Audit events are written via the audit writer (which holds its own
  // advisory lock); keep them outside the above transaction so we don't
  // double-lock.
  await appendAuditEvent(db, {
    userId: user.id,
    traceId: null,
    eventType: decision === 'approved' ? 'review.approved' : 'review.denied',
    payload: {
      reviewId: row.reviewId,
      taskId: row.taskId,
      beeRunId: row.beeRunId,
      decidedBy: user.id,
    },
  });

  revalidatePath('/review');
  revalidatePath('/dashboard');
  return { ok: true as const };
}

export async function approveReview(reviewId: string) {
  return decide(reviewId, 'approved');
}

export async function denyReview(reviewId: string) {
  return decide(reviewId, 'denied');
}
