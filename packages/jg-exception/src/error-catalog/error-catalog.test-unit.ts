// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { Exception } from '../exception/index.js';

import { defineErrorCatalog } from './error-catalog.js';

const catalog = defineErrorCatalog({
  unavailable: { code: 'GITHUB_UNAVAILABLE', message: 'GitHub is temporarily unavailable.' },
  accessDenied: {
    code: 'GITHUB_ACCESS_DENIED',
    message: 'GitHub access was denied.',
    severity: 'expected',
  },
});

describe('defineErrorCatalog', () => {
  test("creates the kind's Exception, with its code, message, and severity", () => {
    const error = catalog.create('accessDenied');

    expect(error).toBeInstanceOf(Exception);
    expect(error).toMatchObject({ code: 'GITHUB_ACCESS_DENIED', severity: 'expected' });
    expect(error.message).toBe('GitHub access was denied.');
    expect(error.data).toBeUndefined();
    expect(error.cause).toBeUndefined();
    expect(Object.hasOwn(catalog.create('unavailable'), 'severity')).toBe(false);
  });

  test('keeps the cause and the data it is given', () => {
    const cause = new Error('socket hang up');

    const error = catalog.create('unavailable', { cause, data: { status: 503 } });

    expect(error.cause).toBe(cause);
    expect(error.data).toStrictEqual({ status: 503 });
  });

  test('recognizes its errors by kind, or any of them without a kind', () => {
    const denied = catalog.create('accessDenied');

    expect(catalog.is(denied, 'accessDenied')).toBe(true);
    expect(catalog.is(denied, 'unavailable')).toBe(false);
    expect(catalog.is(denied)).toBe(true);
  });

  test("doesn't recognize other errors", () => {
    expect(catalog.is(new Exception('Other.', { code: 'OTHER' }))).toBe(false);
    expect(catalog.is(new Exception('Other.', { code: 'OTHER' }), 'unavailable')).toBe(false);
    expect(catalog.is(new Error('GITHUB_UNAVAILABLE'))).toBe(false);
    expect(catalog.is({ code: 'GITHUB_UNAVAILABLE' })).toBe(false);
    expect(catalog.is(undefined)).toBe(false);
  });

  test('recognizes an Exception with the same code from elsewhere, such as another copy', () => {
    expect(
      catalog.is(new Exception('Unavailable.', { code: 'GITHUB_UNAVAILABLE' }), 'unavailable'),
    ).toBe(true);
  });
});
