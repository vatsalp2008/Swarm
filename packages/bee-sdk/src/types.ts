import type { z } from 'zod';
import type { BeeType } from '@swarm/shared';
import type { TokenVault, TokenHandle } from '@swarm/token-vault';

/**
 * Bee manifest — the contract every Bee must declare.
 *
 * Phase 0 has only one Bee (Research). The plugin architecture (per-Bee
 * dynamic loading, marketplace, third-party Bees) is deferred to Phase 2 —
 * see PLAN.md "Items deferred". Until we have three concrete Bees, manifests
 * are statically registered in `apps/orchestrator/src/bees/`.
 */
export interface BeeManifest<TInput, TOutput> {
  /** Stable identifier; matches the `bee_type` enum in @swarm/db. */
  readonly type: BeeType;
  /** Human-readable name for the UI / logs. */
  readonly displayName: string;
  /** Hosts this Bee may interact with. The Compliance Agent intersects this with site_policy. */
  readonly targetHosts: readonly string[];
  /** Required token-vault scopes (empty for Phase 0 Research Bee — no auth). */
  readonly requiredScopes: readonly string[];
  /** Schema for the Bee's input payload. */
  readonly inputSchema: z.ZodType<TInput>;
  /** Schema for the Bee's output payload — used as the Critic's first-pass check. */
  readonly outputSchema: z.ZodType<TOutput>;
  /**
   * Deterministic ground-truth checks the Critic runs after schema validation.
   * Each check returns null on pass or a string reason on fail.
   * Examples for Research Bee: "result URLs must be HTTPS", "result count >= 1".
   */
  readonly groundTruthChecks: ReadonlyArray<(output: TOutput) => string | null>;
  /** Estimated cost class for budget tracking. Phase 0 informational only. */
  readonly costClass: 'low' | 'medium' | 'high';
}

/**
 * Execution context passed to a Bee at runtime. Provides scoped capabilities
 * (token borrow, allowed hosts, trace id) without exposing global state.
 */
export interface BeeContext {
  readonly beeRunId: string;
  readonly userId: string;
  readonly traceId: string;
  /** Allow-listed hosts for this run (intersection of manifest.targetHosts and site_policy). */
  readonly allowedHosts: readonly string[];
  /** Vault handle for borrowing tokens scoped to this Bee. */
  readonly vault: TokenVault;
  /** Token handles available to this Bee. Empty for Phase 0 Research Bee. */
  readonly tokenHandles: readonly TokenHandle[];
  /** AbortSignal that fires on user cancellation or timeout. */
  readonly signal: AbortSignal;
}

/** A Bee's runtime function signature. */
export type BeeFn<TInput, TOutput> = (
  input: TInput,
  ctx: BeeContext,
) => Promise<TOutput>;

export interface RegisteredBee<TInput, TOutput> {
  readonly manifest: BeeManifest<TInput, TOutput>;
  readonly run: BeeFn<TInput, TOutput>;
}