import { NextResponse } from 'next/server';
import { sql, eq, desc } from 'drizzle-orm';
import { TaskInput } from '@swarm/shared';
import { getDb, schema } from '@swarm/db';
import { appendAuditEvent } from '@swarm/audit';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks — list the authenticated user's recent tasks.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.userId, user.id))
    .orderBy(desc(schema.tasks.createdAt))
    .limit(50);

  return NextResponse.json({ tasks: rows });
}

/**
 * POST /api/tasks — create a new task. Writes to `tasks`, emits an audit event,
 * and notifies the orchestrator via Postgres LISTEN/NOTIFY (channel: `swarm_tasks`).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = TaskInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }

  const db = getDb();
  const [task] = await db
    .insert(schema.tasks)
    .values({ userId: user.id, prompt: parsed.data.prompt, status: 'pending' })
    .returning();
  if (!task) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  await appendAuditEvent(db, {
    userId: user.id,
    traceId: null,
    eventType: 'task.created',
    payload: { taskId: task.id, prompt: parsed.data.prompt },
  });

  // Notify orchestrator via LISTEN/NOTIFY. Channel/payload contract is shared with apps/orchestrator.
  await db.execute(sql`SELECT pg_notify('swarm_tasks', ${task.id})`);

  return NextResponse.json({ task }, { status: 201 });
}