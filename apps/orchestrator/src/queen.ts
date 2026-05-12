import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type Db } from '@swarm/db';
import { BeeType } from '@swarm/shared';
import { appendAuditEvent } from '@swarm/audit';
import { checkCompliance } from '@swarm/bee-sdk';
import { InMemoryVault } from '@swarm/token-vault';
import { getBee, listBees } from './bees/index.js';
import { runCritic } from './critic.js';
import { generateJSON, REASONING_MODEL } from './gemini.js';
import { logger } from './logger.js';

/**
 * Queen orchestrator graph — production topology.
 *
 *   load_task → classify → compliance → dispatch → critic → handoff
 *                  │           │            │         │
 *                  ▼           ▼            ▼         ▼
 *               fail        fail         fail      fail
 *
 * Each fail edge runs `fail_node` which marks the task `failed` and emits
 * `task.failed` with the failure reason. Audit events are emitted at each
 * decision boundary so the chain reconstructs the full lifecycle.
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
  traceId: Annotation<string | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  beeType: Annotation<typeof BeeType._type | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  beeInput: Annotation<unknown>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  beeOutput: Annotation<unknown>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  beeRunId: Annotation<string | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
  criticPassed: Annotation<boolean | null>({
    reducer: (_x, y) => (y === null || y === undefined ? _x ?? null : y),
    default: () => null,
  }),
  compliancePassed: Annotation<boolean | null>({
    reducer: (_x, y) => (y === null || y === undefined ? _x ?? null : y),
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_x, y) => y ?? _x ?? null,
    default: () => null,
  }),
});

type QueenStateT = typeof QueenState.State;

// --- LLM classification schema ------------------------------------------------

const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    beeType: { type: 'string', enum: ['research', 'application', 'housing', 'procurement', 'form'] },
    input: { type: 'object' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['beeType', 'input', 'confidence'],
};

interface ClassifyVerdict {
  beeType: string;
  input: Record<string, unknown>;
  confidence: number;
}

// --- Node bodies --------------------------------------------------------------

function makeNodes(db: Db) {
  const vault = new InMemoryVault(); // Phase 0: no real tokens.

  return {
    async load_task(state: QueenStateT) {
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
      return {
        userId: task.userId,
        prompt: task.prompt,
        traceId: task.traceId ?? state.taskId,
      };
    },

    async classify(state: QueenStateT) {
      const available = listBees().join(', ');
      const prompt = [
        'Classify this user task into one of the available agent types and extract input parameters.',
        `Available agents: ${available}`,
        `User task: ${state.prompt ?? ''}`,
        '',
        'Phase 0 only supports `research`. For research tasks, set input.query to the search',
        'phrase (e.g. "software engineering intern SF YC") and input.limit to a small int (default 10).',
        '',
        'Respond as JSON: {beeType, input, confidence}. Confidence in [0,1].',
      ].join('\n');

      let verdict: ClassifyVerdict;
      try {
        verdict = await generateJSON<ClassifyVerdict>(prompt, CLASSIFY_SCHEMA, {
          model: REASONING_MODEL,
          temperature: 0.0,
          traceId: state.traceId ?? undefined,
        });
      } catch (err) {
        logger.warn({ err }, 'classify LLM failed');
        return { error: 'classify_failed' };
      }

      const beeTypeParse = BeeType.safeParse(verdict.beeType);
      if (!beeTypeParse.success) {
        return { error: `unknown bee type: ${verdict.beeType}` };
      }
      if (!getBee(beeTypeParse.data)) {
        return { error: `no implementation registered for bee type: ${beeTypeParse.data}` };
      }
      return { beeType: beeTypeParse.data, beeInput: verdict.input };
    },

    async compliance(state: QueenStateT) {
      const bee = state.beeType ? getBee(state.beeType) : null;
      if (!bee) return { error: 'no bee selected' };

      const result = await checkCompliance(db, bee.manifest);

      if (!result.passed) {
        await appendAuditEvent(db, {
          userId: state.userId,
          traceId: state.traceId,
          eventType: 'compliance.denied',
          payload: {
            taskId: state.taskId,
            beeType: state.beeType,
            deniedHosts: [...result.deniedHosts],
            unknownHosts: [...result.unknownHosts],
          },
        });
        return {
          compliancePassed: false,
          error: `compliance denied: denied=${result.deniedHosts.join(',')} unknown=${result.unknownHosts.join(',')}`,
        };
      }

      return { compliancePassed: true };
    },

    async dispatch(state: QueenStateT) {
      const bee = state.beeType ? getBee(state.beeType) : null;
      if (!bee) return { error: 'no bee selected' };

      // Insert a `running` bee_run row up-front so the lifecycle is auditable
      // even if the Bee crashes.
      const [run] = await db
        .insert(schema.beeRuns)
        .values({
          taskId: state.taskId,
          beeType: state.beeType!,
          status: 'running',
          startedAt: new Date(),
          compliancePassed: true,
        })
        .returning();
      if (!run) return { error: 'bee_run insert failed' };

      await appendAuditEvent(db, {
        userId: state.userId,
        traceId: state.traceId,
        eventType: 'bee_run.started',
        payload: { beeRunId: run.id, taskId: state.taskId, beeType: state.beeType },
      });

      const inputParse = bee.manifest.inputSchema.safeParse(state.beeInput);
      if (!inputParse.success) {
        return { beeRunId: run.id, error: `bee input invalid: ${inputParse.error.message}` };
      }

      const abortCtrl = new AbortController();
      const ctx = {
        beeRunId: run.id,
        userId: state.userId ?? '',
        traceId: state.traceId ?? '',
        allowedHosts: [...bee.manifest.targetHosts],
        vault,
        tokenHandles: [],
        signal: abortCtrl.signal,
      };

      try {
        const output = await bee.run(inputParse.data, ctx);
        return { beeRunId: run.id, beeOutput: output };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(schema.beeRuns)
          .set({ status: 'failed', endedAt: new Date(), errorMessage: message })
          .where(eq(schema.beeRuns.id, run.id));
        await appendAuditEvent(db, {
          userId: state.userId,
          traceId: state.traceId,
          eventType: 'bee_run.failed',
          payload: { beeRunId: run.id, error: message },
        });
        return { beeRunId: run.id, error: `bee run threw: ${message}` };
      }
    },

    async critic(state: QueenStateT) {
      const bee = state.beeType ? getBee(state.beeType) : null;
      if (!bee || !state.beeRunId) return { error: 'critic: missing bee or beeRunId' };

      const result = await runCritic({
        manifest: bee.manifest,
        userPrompt: state.prompt ?? '',
        rawOutput: state.beeOutput,
        traceId: state.traceId ?? '',
      });

      if (!result.passed) {
        await db
          .update(schema.beeRuns)
          .set({
            status: 'denied_by_critic',
            endedAt: new Date(),
            criticPassed: false,
            errorMessage: `critic ${result.stage}: ${result.failures.join('; ')}`,
          })
          .where(eq(schema.beeRuns.id, state.beeRunId));
        await appendAuditEvent(db, {
          userId: state.userId,
          traceId: state.traceId,
          eventType: 'critic.failed',
          payload: { beeRunId: state.beeRunId, stage: result.stage, failures: [...result.failures] },
        });
        return { criticPassed: false, error: `critic failed at ${result.stage}` };
      }

      return { criticPassed: true };
    },

    async handoff(state: QueenStateT) {
      if (!state.beeRunId) return { error: 'handoff: missing beeRunId' };

      await db
        .update(schema.beeRuns)
        .set({
          status: 'succeeded',
          endedAt: new Date(),
          output: (state.beeOutput as Record<string, unknown>) ?? null,
          criticPassed: true,
          compliancePassed: true,
        })
        .where(eq(schema.beeRuns.id, state.beeRunId));

      await db.insert(schema.reviewQueueItems).values({
        beeRunId: state.beeRunId,
        proposal: (state.beeOutput as Record<string, unknown>) ?? {},
        status: 'pending',
      });

      await db
        .update(schema.tasks)
        .set({ status: 'awaiting_review', updatedAt: new Date() })
        .where(eq(schema.tasks.id, state.taskId));

      await appendAuditEvent(db, {
        userId: state.userId,
        traceId: state.traceId,
        eventType: 'bee_run.completed',
        payload: { beeRunId: state.beeRunId, taskId: state.taskId },
      });
      await appendAuditEvent(db, {
        userId: state.userId,
        traceId: state.traceId,
        eventType: 'review.created',
        payload: { beeRunId: state.beeRunId, taskId: state.taskId },
      });

      return {};
    },

    async fail(state: QueenStateT) {
      await db
        .update(schema.tasks)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(schema.tasks.id, state.taskId));
      await appendAuditEvent(db, {
        userId: state.userId,
        traceId: state.traceId,
        eventType: 'task.failed',
        payload: { taskId: state.taskId, error: state.error ?? 'unknown' },
      });
      return {};
    },
  };
}

// --- Graph wiring -------------------------------------------------------------

export function buildQueenGraph(db: Db) {
  const nodes = makeNodes(db);

  const graph = new StateGraph(QueenState)
    .addNode('load_task', nodes.load_task)
    .addNode('classify', nodes.classify)
    .addNode('compliance', nodes.compliance)
    .addNode('dispatch', nodes.dispatch)
    .addNode('critic', nodes.critic)
    .addNode('handoff', nodes.handoff)
    .addNode('fail', nodes.fail)
    .addEdge(START, 'load_task')
    .addConditionalEdges('load_task', (s: QueenStateT) => (s.error ? 'fail' : 'classify'))
    .addConditionalEdges('classify', (s: QueenStateT) => (s.error ? 'fail' : 'compliance'))
    .addConditionalEdges('compliance', (s: QueenStateT) => (s.error ? 'fail' : 'dispatch'))
    .addConditionalEdges('dispatch', (s: QueenStateT) => (s.error ? 'fail' : 'critic'))
    .addConditionalEdges('critic', (s: QueenStateT) => (s.error ? 'fail' : 'handoff'))
    .addEdge('handoff', END)
    .addEdge('fail', END);

  return graph.compile();
}

export async function runQueenForTask(db: Db, taskId: string): Promise<void> {
  const graph = buildQueenGraph(db);
  try {
    const result = await graph.invoke({ taskId });
    if (result.error) {
      logger.warn({ taskId, error: result.error }, 'queen run completed via fail path');
    } else {
      logger.info({ taskId, beeRunId: result.beeRunId }, 'queen run completed');
    }
  } catch (err) {
    logger.error({ taskId, err }, 'queen run threw');
    await db
      .update(schema.tasks)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(schema.tasks.id, taskId))
      .catch(() => undefined);
  }
}
