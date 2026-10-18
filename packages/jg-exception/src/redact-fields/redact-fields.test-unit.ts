import { describe, expect, test } from 'vitest';

import { redactFields } from './redact-fields.js';

// the fields Moldea hides from its error reports
const SENSITIVE_KEYS = ['email', 'googleIdToken', 'password', 'token'];

describe('redactFields', () => {
  test("replaces the sensitive fields' values, as Moldea's error payloads do", () => {
    expect(
      redactFields(
        {
          email: 'user@example.com',
          googleIdToken: 'google-id-token-value',
          password: 'super-secret',
          token: 'token-value',
          plan: 'pro',
        },
        SENSITIVE_KEYS,
      ),
    ).toStrictEqual({
      email: '[redacted]',
      googleIdToken: '[redacted]',
      password: '[redacted]',
      token: '[redacted]',
      plan: 'pro',
    });
  });

  test('returns a new object, and leaves the original as it was', () => {
    const payload = { email: 'user@example.com', password: 'super-secret' };

    const redacted = redactFields(payload, SENSITIVE_KEYS);

    expect(redacted).toStrictEqual({ email: '[redacted]', password: '[redacted]' });
    expect(redacted).not.toBe(payload);
    expect(payload).toStrictEqual({ email: 'user@example.com', password: 'super-secret' });
  });

  test('redacts at any depth, in arrays too, and matches keys case-insensitively', () => {
    expect(
      redactFields(
        { user: { Email: 'a@b.c', sessions: [{ TOKEN: 't1' }, { token: 't2', id: 1 }] } },
        SENSITIVE_KEYS,
      ),
    ).toStrictEqual({
      user: {
        Email: '[redacted]',
        sessions: [{ TOKEN: '[redacted]' }, { token: '[redacted]', id: 1 }],
      },
    });
  });

  test('redacts a whole nested value under a matching key', () => {
    expect(redactFields({ password: { current: 'a', next: 'b' } }, ['password'])).toStrictEqual({
      password: '[redacted]',
    });
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'password'],
    ['a number', 42],
  ])('returns %s as it is', (_, value) => {
    expect(redactFields(value, SENSITIVE_KEYS)).toBe(value);
  });

  test('keeps class instances as they are, and copies a value that refers back to itself once', () => {
    const createdAt = new Date(0);
    const circular: Record<string, unknown> = { token: 'secret', createdAt };
    circular['self'] = circular;

    const redacted = redactFields(circular, SENSITIVE_KEYS) as Record<string, unknown>;

    expect(redacted['token']).toBe('[redacted]');
    expect(redacted['createdAt']).toBe(createdAt);
    expect(redacted['self']).toBe(redacted);
    expect(circular['token']).toBe('secret');
  });

  test('walks any depth without overflowing the stack', () => {
    const body: Record<string, unknown> = { token: 'deepest' };
    let nested = body;
    for (let depth = 0; depth < 100_000; depth += 1) {
      nested = { child: nested };
    }

    let redacted = redactFields(nested, SENSITIVE_KEYS) as Record<string, unknown>;
    while (redacted['child'] !== undefined) {
      redacted = redacted['child'] as Record<string, unknown>;
    }

    expect(redacted).toStrictEqual({ token: '[redacted]' });
  });

  test('copies long arrays', () => {
    const tokens = Array.from({ length: 500_000 }, (_, index) => ({ token: String(index) }));

    const redacted = redactFields(tokens, SENSITIVE_KEYS) as unknown[];

    expect(redacted).toHaveLength(500_000);
    expect(redacted.at(-1)).toStrictEqual({ token: '[redacted]' });
  });

  test('keeps a "__proto__" key from JSON.parse as a plain field', () => {
    const body: unknown = JSON.parse('{"__proto__":{"token":"secret"},"password":"hunter2"}');

    const redacted = redactFields(body, SENSITIVE_KEYS) as Record<string, unknown>;

    expect(Object.getPrototypeOf(redacted)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(redacted, '__proto__')?.value).toStrictEqual({
      token: '[redacted]',
    });
    expect(redacted['password']).toBe('[redacted]');
  });

  test('copies objects without a prototype', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { token: 'secret' });

    expect(redactFields(bare, SENSITIVE_KEYS)).toStrictEqual({ token: '[redacted]' });
  });
});
