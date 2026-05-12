import { describe, it, expect } from 'vitest';
import { redact, redactString } from './redaction.js';

describe('redactString', () => {
  it('redacts SSN', () => {
    expect(redactString('My SSN is 123-45-6789.')).toContain('[REDACTED:SSN]');
    expect(redactString('My SSN is 123-45-6789.')).not.toContain('123-45-6789');
  });

  it('redacts email', () => {
    expect(redactString('contact me at jane@example.com')).toContain('[REDACTED:EMAIL]');
  });

  it('redacts US phone numbers in multiple formats', () => {
    expect(redactString('call (555) 123-4567')).toContain('[REDACTED:PHONE]');
    expect(redactString('call 555-123-4567')).toContain('[REDACTED:PHONE]');
    expect(redactString('call +1 555 123 4567')).toContain('[REDACTED:PHONE]');
  });

  it('redacts DOB shaped dates', () => {
    expect(redactString('born on 03/15/1995')).toContain('[REDACTED:DATE]');
  });

  it('redacts Luhn-valid credit-card-shaped digits', () => {
    // Visa test number 4111 1111 1111 1111 — Luhn-valid
    expect(redactString('card 4111111111111111')).toContain('[REDACTED:CC]');
  });

  it('does not redact Luhn-invalid digit runs as credit card', () => {
    // Long digit run that is NOT Luhn-valid should fall through to account redaction
    const result = redactString('order id 1234567812345678');
    expect(result).not.toContain('[REDACTED:CC]');
  });

  it('redacts long digit runs as account numbers', () => {
    expect(redactString('routing 12345678901')).toContain('[REDACTED:ACCT]');
  });
});

describe('redact (recursive)', () => {
  it('redacts string values inside objects', () => {
    const out = redact({ name: 'Jane', email: 'jane@example.com' });
    expect(out.email).toContain('[REDACTED:EMAIL]');
    expect(out.name).toBe('Jane');
  });

  it('redacts string values inside arrays', () => {
    const out = redact(['plain', 'secret@example.com']);
    expect(out[0]).toBe('plain');
    expect(out[1]).toContain('[REDACTED:EMAIL]');
  });

  it('preserves non-string primitives', () => {
    const out = redact({ count: 42, active: true, meta: null });
    expect(out.count).toBe(42);
    expect(out.active).toBe(true);
    expect(out.meta).toBe(null);
  });
});
