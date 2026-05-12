import Link from 'next/link';
import { desc, eq, and } from 'drizzle-orm';
import { getDb, schema } from '@swarm/db';
import { createClient } from '@/lib/supabase/server';
import { SubmitTaskForm } from './submit-task-form';

export const dynamic = 'force-dynamic';

async function loadRecentTasks(userId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.tasks.id,
      prompt: schema.tasks.prompt,
      status: schema.tasks.status,
      createdAt: schema.tasks.createdAt,
    })
    .from(schema.tasks)
    .where(eq(schema.tasks.userId, userId))
    .orderBy(desc(schema.tasks.createdAt))
    .limit(20);
}

async function loadPendingReviewCount(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: schema.reviewQueueItems.id })
    .from(schema.reviewQueueItems)
    .innerJoin(schema.beeRuns, eq(schema.reviewQueueItems.beeRunId, schema.beeRuns.id))
    .innerJoin(schema.tasks, eq(schema.beeRuns.taskId, schema.tasks.id))
    .where(
      and(eq(schema.tasks.userId, userId), eq(schema.reviewQueueItems.status, 'pending')),
    );
  return rows.length;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [tasks, pendingReviews] = await Promise.all([
    loadRecentTasks(user.id),
    loadPendingReviewCount(user.id),
  ]);

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-600">{user.email}</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm text-zinc-600 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mb-10 border border-zinc-200 rounded-lg p-5 bg-white">
        <SubmitTaskForm />
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Awaiting your review</h2>
          <Link href="/review" className="text-sm text-zinc-700 hover:underline">
            Open Review Queue {pendingReviews > 0 ? `(${pendingReviews})` : ''} →
          </Link>
        </div>
        <p className="text-sm text-zinc-600">
          {pendingReviews === 0
            ? 'Nothing waiting right now.'
            : `${pendingReviews} item${pendingReviews === 1 ? '' : 's'} waiting.`}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-zinc-600">No tasks yet. Submit one above to get started.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 border border-zinc-200 rounded-lg bg-white">
            {tasks.map((t) => (
              <li key={t.id} className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{t.prompt}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(t.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusPill status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    pending: 'bg-zinc-100 text-zinc-700',
    in_progress: 'bg-blue-100 text-blue-700',
    awaiting_review: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    denied: 'bg-zinc-200 text-zinc-700',
    failed: 'bg-red-100 text-red-700',
  };
  const cls = tone[status] ?? 'bg-zinc-100 text-zinc-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${cls}`}>{status}</span>;
}
