import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { eq } from 'drizzle-orm';
import { schema, type Db } from '@swarm/db';
import { appendAuditEvent } from '@swarm/audit';
import { logger } from './logger.js';

/**
 * Queen orchestrator graph (Phase 0 stub).
 *
 * Real graph in Week 3:  classify → compliance → dispatch → critic → handoff
 * Phase 0 Week 1 stub:   load_task → mark_awaiting_review (with placeholder output)
 *
 * The state shape and node naming are deliberately the production target — when
 * Week 3 lands, we replace node bodies, not the graph topology, and not the
 * caller contract in `runQueenForTask`.
 */
const QueenState = Annotation.Root({
  taskId: Annotation<string>(),
  userId: Annotation<string | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  prompt: Annotation<string | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  beeRunId: Annotation<string | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  output: Annotation<unknown>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
});

type QueenStateType = typeof QueenState.State;

export function buildQueenGraph(db: Db) {
  const graph = new StateGraph(QueenState)
    .addNode('load_task', async (state: QueenStateType) => {
      const [task] = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, state.taskId))
        .limit(1);
      if (!task) return { error: `task ${state.taskId} not found` };
      await db
        .update(schema.tasks)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(eq(schema.tasks.id, state.taskId));
      return { userId: task.userId, prompt: task.prompt };
    })
    .addNode('mark_awaiting_review', async (state: QueenStateType) => {
      // Phase 0 stub: insert a placeholder bee_run + review_queue_item so the
      // end-to-end happy path is exercised. Real Bee dispatch lands in Week 3.
      const [run] = await db
        .insert(schema.beeRuns)
        .values({
          taskId: state.taskId,
          beeType: 'research',
          status: 'succeeded',
          startedAt: new Date(),
          endedAt: new Date(),
          output: { _phase0: 'placeholder', prompt: state.prompt },
          criticPassed: true,
          compliancePassed: true,
        })
        .returning();
      if (!run) return { error: 'bee_run insert failed' };

      await db.insert(schema.reviewQueueItems).values({
        beeRunId: run.id,
        proposal: { _phase0: 'placeholder', prompt: state.prompt },
        status: 'pending',
      });

      await db
        .update(schema.tasks)
        .set({ status: 'awaiting_review', updatedAt: new Date() })
        .where(eq(schema.tasks.id, state.taskId));

      await appendAuditEvent(db, {
        userId: state.userId,
        traceId: null,
        eventType: 'bee_run.completed',
        payload: { beeRunId: run.id, taskId: state.taskId, phase: 0 },
      });

      return { beeRunId: run.id, output: { _phase0: 'placeholder' } };
    })
    .addEdge(START, 'load_task')
    .addEdge('load_task', 'mark_awaiting_review')
    .addEdge('mark_awaiting_review', END);

  return graph.compile();
}

export async function runQueenForTask(db: Db, taskId: string): Promise<void> {
  const graph = buildQueenGraph(db);
  try {
    const result = await graph.invoke({ taskId });
    if (result.error) {
      logger.warn({ taskId, error: result.error }, 'queen run completed with error');
      await db
        .update(schema.tasks)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(schema.tasks.id, taskId));
    } else {
      logger.info({ taskId, beeRunId: result.beeRunId }, 'queen run completed');
    }
  } catch (err) {
    logger.error({ taskId, err }, 'queen run threw');
    await db
      .update(schema.tasks)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(schema.tasks.id, taskId));
  }
}