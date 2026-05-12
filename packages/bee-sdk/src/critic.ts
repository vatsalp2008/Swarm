import type { BeeManifest } from './types.js';

export interface CriticResult {
  readonly passed: boolean;
  readonly stage: 'schema' | 'ground_truth' | 'fact_check' | null;
  readonly failures: readonly string[];
}

/**
 * Run the Critic's deterministic passes against a Bee's output.
 *
 * Order is intentional (per ADR convention): cheap deterministic checks first;
 * expensive LLM fact-check (not in this function — added by the orchestrator
 * as a separate stage) runs last and only if deterministic passes succeed.
 *
 * Stage 1: schema validation via the Bee's outputSchema (Zod).
 * Stage 2: ground-truth checks declared in the manifest.
 *
 * Returns the first failing stage; no further stages run on failure.
 * The orchestrator is responsible for the LLM fact-check stage that wraps this.
 */
export function runDeterministicCritic<TInput, TOutput>(
  manifest: BeeManifest<TInput, TOutput>,
  rawOutput: unknown,
): CriticResult {
  const parsed = manifest.outputSchema.safeParse(rawOutput);
  if (!parsed.success) {
    return {
      passed: false,
      stage: 'schema',
      failures: parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
    };
  }

  const output = parsed.data;
  const failures: string[] = [];
  for (const check of manifest.groundTruthChecks) {
    const reason = check(output);
    if (reason !== null) failures.push(reason);
  }

  if (failures.length > 0) {
    return { passed: false, stage: 'ground_truth', failures };
  }

  return { passed: true, stage: null, failures: [] };
}