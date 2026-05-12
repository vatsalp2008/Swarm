import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { runDeterministicCritic } from './critic.js';
import type { BeeManifest } from './types.js';

const outputSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(z.object({ url: z.string().url() })),
});
type Out = z.infer<typeof outputSchema>;

const manifest: BeeManifest<unknown, Out> = {
  type: 'research',
  displayName: 'Test',
  targetHosts: ['example.com'],
  requiredScopes: [],
  inputSchema: z.unknown(),
  outputSchema,
  groundTruthChecks: [
    (out) => (out.items.every((i) => i.url.startsWith('https://')) ? null : 'all URLs must be https'),
    (out) => (out.count === out.items.length ? null : 'count must equal items.length'),
  ],
  costClass: 'low',
};

describe('runDeterministicCritic', () => {
  it('passes well-formed output', () => {
    const r = runDeterministicCritic(manifest, {
      count: 2,
      items: [{ url: 'https://a.example.com/1' }, { url: 'https://b.example.com/2' }],
    });
    expect(r.passed).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it('fails on schema mismatch and stops at schema stage', () => {
    const r = runDeterministicCritic(manifest, {
      count: 'not-a-number',
      items: [],
    });
    expect(r.passed).toBe(false);
    expect(r.stage).toBe('schema');
  });

  it('fails on ground-truth check after schema passes', () => {
    const r = runDeterministicCritic(manifest, {
      count: 1,
      items: [{ url: 'http://insecure.example.com/' }],
    });
    expect(r.passed).toBe(false);
    expect(r.stage).toBe('ground_truth');
    expect(r.failures).toContain('all URLs must be https');
  });

  it('reports multiple ground-truth failures', () => {
    const r = runDeterministicCritic(manifest, {
      count: 99,
      items: [{ url: 'http://insecure.example.com/' }],
    });
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBe(2);
  });
});