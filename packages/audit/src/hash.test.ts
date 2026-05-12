import { describe, it, expect } from 'vitest';
import { computeHash } from './hash.js';

describe('computeHash', () => {
  const baseInput = {
    prevHash: null,
    eventType: 'task.created',
    userId: '00000000-0000-0000-0000-000000000000',
    traceId: 'trace-1',
    payload: { prompt: 'find me jobs' },
    ts: new Date('2026-04-25T00:00:00.000Z'),
  };

  it('produces a 32-byte SHA-256 digest', () => {
    const h = computeHash(baseInput);
    expect(h.length).toBe(32);
  });

  it('is deterministic for identical input', () => {
    const a = computeHash(baseInput);
    const b = computeHash(baseInput);
    expect(a.equals(b)).toBe(true);
  });

  it('differs when prev_hash differs', () => {
    const a = computeHash(baseInput);
    const b = computeHash({ ...baseInput, prevHash: Buffer.from('0102030405', 'hex') });
    expect(a.equals(b)).toBe(false);
  });

  it('differs when payload differs', () => {
    const a = computeHash(baseInput);
    const b = computeHash({ ...baseInput, payload: { prompt: 'different' } });
    expect(a.equals(b)).toBe(false);
  });

  it('is invariant to payload key order (canonical JSON)', () => {
    const a = computeHash({ ...baseInput, payload: { a: 1, b: 2 } });
    const b = computeHash({ ...baseInput, payload: { b: 2, a: 1 } });
    expect(a.equals(b)).toBe(true);
  });

  it('rejects unknown event types', () => {
    expect(() =>
      computeHash({ ...baseInput, eventType: 'something.never.declared' }),
    ).toThrow();
  });

  it('chains: row N hash depends on row N-1 hash', () => {
    const row1 = computeHash(baseInput);
    const row2 = computeHash({
      ...baseInput,
      prevHash: row1,
      eventType: 'bee_run.started',
      payload: { beeRunId: 'abc' },
    });
    // Recomputing row 2 with a forged row1 should yield a different result
    const tampered = computeHash({
      ...baseInput,
      prevHash: Buffer.alloc(32),
      eventType: 'bee_run.started',
      payload: { beeRunId: 'abc' },
    });
    expect(row2.equals(tampered)).toBe(false);
  });
});