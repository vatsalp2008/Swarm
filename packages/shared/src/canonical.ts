/**
 * Canonical JSON serialization for hash-chain stability.
 *
 * The audit log's hash chain (ADR-0005) requires deterministic serialization:
 * the same payload must produce byte-identical bytes regardless of insertion
 * order, locale, or runtime. Native JSON.stringify is order-dependent on object
 * keys, so we sort keys recursively before stringifying.
 *
 * This is intentionally a small implementation; it deliberately rejects values
 * that have no canonical JSON representation (functions, symbols, undefined,
 * non-finite numbers) rather than silently losing them.
 */

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('canonicalize: non-finite number is not representable in canonical JSON');
    }
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    throw new Error(`canonicalize: ${typeof value} is not representable in canonical JSON`);
  }
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) {
      out[k] = sortKeys(obj[k]);
    }
    return out;
  }
  throw new Error(`canonicalize: unsupported type ${typeof value}`);
}
