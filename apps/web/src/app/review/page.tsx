import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@swarm/db';
import { createClient } from '@/lib/supabase/server';
import { ReviewCard } from './review-card';

export const dynamic = 'force-dynamic';

interface QueueRow {
  reviewId: string;
  beeRunId: string;
  taskId: string;
  prompt: string;
  beeType: string;
  proposal: unknown;
  createdAt: Date;
}

async function loadPendingForUser(userId: string): Promise<QueueRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      reviewId: schema.reviewQueueItems.id,
      beeRunId: schema.reviewQueueItems.beeRunId,
      taskId: schema.tasks.id,
      prompt: schema.tasks.prompt,
      beeType: schema.beeRuns.beeType,
      proposal: schema.reviewQueueItems.proposal,
      createdAt: schema.reviewQueueItems.createdAt,
    })
    .from(schema.reviewQueueItems)
    .innerJoin(schema.beeRuns, eq(schema.reviewQueueItems.beeRunId, schema.beeRuns.id))
    .innerJoin(schema.tasks, eq(schema.beeRuns.taskId, schema.tasks.id))
    .where(
      and(eq(schema.tasks.userId, userId), eq(schema.reviewQueueItems.status, 'pending')),
    )
    .orderBy(desc(schema.reviewQueueItems.createdAt))
    .limit(50);
  return rows;
}

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/review');

  const items = await loadPendingForUser(user.id);

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Review Queue</h1>
        <a href="/dashboard" className="text-sm text-zinc-600 hover:underline">
          ← Dashboard
        </a>
      </header>

      {items.length === 0 ? (
        <p className="text-zinc-600 text-sm">
          Nothing waiting for review. Submit a task from the dashboard and it&apos;ll appear here.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.reviewId}>
              <ReviewCard
                reviewId={item.reviewId}
                taskId={item.taskId}
                prompt={item.prompt}
                beeType={item.beeType}
                proposal={item.proposal}
                createdAt={item.createdAt.toISOString()}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
