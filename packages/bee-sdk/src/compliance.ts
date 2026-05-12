import { eq } from 'drizzle-orm';
import { schema, type Db } from '@swarm/db';
import type { BeeManifest } from './types.js';

export interface ComplianceResult {
  readonly passed: boolean;
  readonly allowedHosts: readonly string[];
  readonly deniedHosts: readonly string[];
  readonly unknownHosts: readonly string[];
}

/**
 * Compliance Agent — pre-execution check.
 *
 * For each host the Bee declares it will touch (manifest.targetHosts),
 * look up the host in `site_policy`. The Bee may run iff every host is
 * explicitly `allow`. Unknown hosts default to deny (see ADR-0004).
 *
 * Returns the disposition; the orchestrator decides whether to dispatch
 * the Bee or write a `compliance.denied` audit event and stop.
 */
export async function checkCompliance<TInput, TOutput>(
  db: Db,
  manifest: BeeManifest<TInput, TOutput>,
): Promise<ComplianceResult> {
  const allowed: string[] = [];
  const denied: string[] = [];
  const unknown: string[] = [];

  for (const host of manifest.targetHosts) {
    const [row] = await db
      .select({ status: schema.sitePolicy.status })
      .from(schema.sitePolicy)
      .where(eq(schema.sitePolicy.host, host))
      .limit(1);

    if (!row) {
      unknown.push(host);
    } else if (row.status === 'allow') {
      allowed.push(host);
    } else {
      denied.push(host);
    }
  }

  return {
    passed: denied.length === 0 && unknown.length === 0,
    allowedHosts: allowed,
    deniedHosts: denied,
    unknownHosts: unknown,
  };
}