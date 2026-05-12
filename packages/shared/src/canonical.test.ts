import { describe, it, expect } from 'vitest';
import { canonicalize } from './canonical.js';

describe('canonicalize', () => {
  it('produces identical output regardless of object key order', () => {
    const a = canonicalize({ b: 2, a: 1, c: 3 });
    const b = canonicalize({ a: 1, c: 3, b: 2 });
    expect(a).toBe(b);
  });

  it('sorts nested object keys', () => {
    const out = canonicalize({ outer: { z: 1, a: 2 } });
    expect(out).toBe('{"outer":{"a":2,"z":1}}');
  });

  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('rejects undefined', () => {
    expect(() => canonicalize({ a: undefined })).toThrow();
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ a: NaN })).toThrow();
    expect(() => canonicalize({ a: Infinity })).toThrow();
  });

  it('rejects functions and symbols', () => {
    expect(() => canonicalize({ fn: () => 1 })).toThrow();
    expect(() => canonicalize({ s: Symbol('x') })).toThrow();
  });
});
