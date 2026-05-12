import { runDeterministicCritic, type CriticResult } from '@swarm/bee-sdk';
import type { BeeManifest } from '@swarm/bee-sdk';
import { generateJSON, FAST_MODEL } from './gemini.js';
import { logger } from './logger.js';

/**
 * Three-stage Critic:
 *   1. schema       — Zod parse against Bee outputSchema
 *   2. ground_truth — deterministic checks declared on the manifest
 *   3. fact_check   — LLM judgment ("does this satisfy the user's prompt?")
 *
 * Stages 1+2 live in @swarm/bee-sdk (runDeterministicCritic). Stage 3 is here
 * because it needs the orchestrator's Gemini client. The LLM stage ONLY runs
 * if deterministic stages pass — per ADR-style decision in PLAN.md
 * "deterministic-first; LLM second pass". Reversing this order is a
 * compliance-relevant change and would need an ADR amendment.
 */

interface FactCheckVerdict {
  passes: boolean;
  reasons: string[];
}

const FACT_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    passes: { type: 'boolean' },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
  },
  required: ['passes', 'reasons'],
};

export async function runCritic<TInput, TOutput>(args: {
  manifest: BeeManifest<TInput, TOutput>;
  userPrompt: string;
  rawOutput: unknown;
  traceId: string;
}): Promise<CriticResult> {
  const deterministic = runDeterministicCritic(args.manifest, args.rawOutput);
  if (!deterministic.passed) {
    logger.info(
      { stage: deterministic.stage, failures: deterministic.failures, traceId: args.traceId },
      'critic failed (deterministic)',
    );
    return deterministic;
  }

  // Deterministic passed; run LLM fact-check.
  const prompt = [
    'You are evaluating whether a sub-agent\'s output satisfies the user\'s task.',
    `User task: ${args.userPrompt}`,
    'Sub-agent output (JSON):',
    JSON.stringify(args.rawOutput).slice(0, 8000),
    '',
    'Return JSON {passes: boolean, reasons: string[]}. Pass only if the output',
    'is on-topic, factually consistent with the user task, and would be useful',
    'if returned to the user. Be strict.',
  ].join('\n');

  let verdict: FactCheckVerdict;
  try {
    verdict = await generateJSON<FactCheckVerdict>(prompt, FACT_CHECK_SCHEMA, {
      model: FAST_MODEL,
      temperature: 0.0,
      traceId: args.traceId,
    });
  } catch (err) {
    logger.warn({ err, traceId: args.traceId }, 'critic LLM call failed; treating as fact-check failure');
    return {
      passed: false,
      stage: 'fact_check',
      failures: ['Critic LLM call failed; cannot confirm output fidelity.'],
    };
  }

  if (!verdict.passes) {
    return {
      passed: false,
      stage: 'fact_check',
      failures: verdict.reasons.length > 0 ? verdict.reasons : ['LLM fact-check failed without specific reasons.'],
    };
  }

  return { passed: true, stage: null, failures: [] };
}
