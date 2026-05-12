/**
 * PII redaction first-pass. Regex-based, deterministic, deliberately conservative.
 * Runs before any payload enters an LLM context or is written to audit_log.
 *
 * This is NOT a complete PII solution — it's a defense-in-depth filter that catches
 * the obvious classes (SSN, DOB, US phone, account numbers, email, credit-card-like).
 * The real defense is never collecting PII we don't need.
 */

const PATTERNS: Array<{ name: string; re: RegExp; replace: string }> = [
  // US SSN: 123-45-6789
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g, replace: '[REDACTED:SSN]' },
  // Credit card-shaped: 13–19 digit runs (with optional separators), passed through Luhn check at runtime
  {
    name: 'cc',
    re: /\b(?:\d[ -]*?){13,19}\b/g,
    replace: '[REDACTED:CC]',
  },
  // US phone: (555) 555-5555 or 555-555-5555 or 555.555.5555 or +1 555 555 5555
  {
    name: 'phone',
    re: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replace: '[REDACTED:PHONE]',
  },
  // Date of birth (MM/DD/YYYY or M/D/YYYY)
  {
    name: 'dob',
    re: /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/((?:19|20)\d{2})\b/g,
    replace: '[REDACTED:DATE]',
  },
  // Email
  {
    name: 'email',
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replace: '[REDACTED:EMAIL]',
  },
  // US bank account-style: 8–17 digit runs (best-effort, will overlap with CC; CC runs first)
  {
    name: 'account',
    re: /\b\d{8,17}\b/g,
    replace: '[REDACTED:ACCT]',
  },
];

/** Luhn check for credit-card validation. Defends against false positives in long digit runs. */
function luhn(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function redactString(input: string): string {
  let out = input;
  for (const { name, re, replace } of PATTERNS) {
    if (name === 'cc') {
      out = out.replace(re, (match) => (luhn(match) ? replace : match));
    } else {
      out = out.replace(re, replace);
    }
  }
  return out;
}

/**
 * Recursive redaction over arbitrary JSON-shaped values. Strings are redacted via
 * regex; other primitives are returned unchanged; arrays and objects are mapped.
 */
export function redact<T>(value: T): T {
  if (typeof value === 'string') {
    return redactString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redact(v)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redact(v);
    }
    return out as T;
  }
  return value;
}
