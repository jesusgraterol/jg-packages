import { describe, expect, test } from 'vitest';

import { Exception } from '../exception/index.js';
import { createErrorFeedback } from './error-feedback.js';

const FALLBACK = 'Something went wrong. Try again in a moment.';

/**
 * Creates an Exception with a code, the error a UI most often receives.
 * @param code The code.
 * @returns The exception.
 */
const coded = (code: string): Exception => new Exception(`Failed with ${code}`, { code });

describe('createErrorFeedback', () => {
  test("gives the code's copy and shows the code, without the error's message", () => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      messagesByCode: { SESSION_EXPIRED: 'Your session expired.' },
    });

    expect(getErrorFeedback(coded('SESSION_EXPIRED'))).toStrictEqual({
      message: 'Your session expired.',
      code: 'SESSION_EXPIRED',
      isCancelled: false,
      isAccessDenied: false,
    });
  });

  test('gives the fallback and hides a code without copy', () => {
    const getErrorFeedback = createErrorFeedback({ fallbackMessage: FALLBACK });

    expect(getErrorFeedback(coded('DISK_FULL'))).toStrictEqual({
      message: FALLBACK,
      code: null,
      isCancelled: false,
      isAccessDenied: false,
    });
  });

  test('prefers the copy of the overrides, then the configured copy, then the fallbacks', () => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      messagesByCode: { SESSION_EXPIRED: 'Configured copy', QUOTA_EXCEEDED: 'Over quota' },
    });
    const overrides = {
      fallbackMessage: 'Screen fallback',
      messagesByCode: { SESSION_EXPIRED: 'Screen copy' },
    };

    expect(getErrorFeedback(coded('SESSION_EXPIRED'), overrides).message).toBe('Screen copy');
    expect(getErrorFeedback(coded('QUOTA_EXCEEDED'), overrides).message).toBe('Over quota');
    expect(getErrorFeedback(coded('DISK_FULL'), overrides).message).toBe('Screen fallback');
    expect(getErrorFeedback(coded('DISK_FULL'), {}).message).toBe(FALLBACK);
  });

  test("shows a code that only the overrides' table lists", () => {
    const getErrorFeedback = createErrorFeedback({ fallbackMessage: FALLBACK });
    const overrides = { messagesByCode: { AVATAR_TOO_LARGE: 'Choose a smaller image.' } };

    expect(getErrorFeedback(coded('AVATAR_TOO_LARGE'), overrides)).toMatchObject({
      message: 'Choose a smaller image.',
      code: 'AVATAR_TOO_LARGE',
    });
  });

  test.each([['__proto__'], ['constructor'], ['toString'], ['hasOwnProperty']])(
    'gives the fallback and hides the inherited key %s used as a code',
    (code) => {
      const getErrorFeedback = createErrorFeedback({
        fallbackMessage: FALLBACK,
        messagesByCode: { SESSION_EXPIRED: 'Your session expired.' },
      });
      const overrides = { messagesByCode: { SESSION_EXPIRED: 'Screen copy' } };

      expect(getErrorFeedback(coded(code))).toMatchObject({ message: FALLBACK, code: null });
      expect(getErrorFeedback(coded(code), overrides)).toMatchObject({
        message: FALLBACK,
        code: null,
      });
    },
  );

  test("uses an own __proto__ entry, such as from parsed JSON, as that code's copy", () => {
    const messagesByCode = JSON.parse('{"__proto__":"Proto copy"}') as Record<string, string>;
    const getErrorFeedback = createErrorFeedback({ fallbackMessage: FALLBACK, messagesByCode });

    expect(getErrorFeedback(coded('__proto__'))).toMatchObject({
      message: 'Proto copy',
      code: '__proto__',
    });
  });

  test('copies its tables when it is created', () => {
    const messagesByCode: Record<string, string> = { SESSION_EXPIRED: 'Your session expired.' };
    const accessDeniedCodes = ['SESSION_EXPIRED'];
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      messagesByCode,
      accessDeniedCodes,
    });
    messagesByCode['SESSION_EXPIRED'] = 'Changed';
    messagesByCode['DISK_FULL'] = 'Added';
    accessDeniedCodes.length = 0;

    expect(getErrorFeedback(coded('SESSION_EXPIRED'))).toMatchObject({
      message: 'Your session expired.',
      isAccessDenied: true,
    });
    expect(getErrorFeedback(coded('DISK_FULL')).message).toBe(FALLBACK);
  });

  test('ignores copy that is not a string, from callers that skip type checking', () => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      messagesByCode: { DISK_FULL: 42 } as unknown as Record<string, string>,
    });
    const overrides = {
      fallbackMessage: 7 as unknown as string,
      messagesByCode: { DISK_FULL: null } as unknown as Record<string, string>,
    };
    const nullTable = { messagesByCode: null as unknown as Record<string, string> };

    expect(getErrorFeedback(coded('DISK_FULL'), overrides)).toMatchObject({
      message: FALLBACK,
      code: null,
    });
    expect(getErrorFeedback(coded('DISK_FULL'), nullTable)).toMatchObject({
      message: FALLBACK,
      code: null,
    });
  });

  test('shows a code that matches the public pattern, with the fallback', () => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      publicCodePattern: /^AVATAR_/,
    });

    expect(getErrorFeedback(coded('AVATAR_TOO_LARGE'))).toMatchObject({
      message: FALLBACK,
      code: 'AVATAR_TOO_LARGE',
    });
    expect(getErrorFeedback(coded('DB_TIMEOUT')).code).toBeNull();
  });

  test('gives the same answer every call for a pattern with the global or sticky flag', () => {
    const pattern = /AVATAR_/gy;
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      publicCodePattern: pattern,
    });

    expect(getErrorFeedback(coded('AVATAR_TOO_LARGE')).code).toBe('AVATAR_TOO_LARGE');
    expect(getErrorFeedback(coded('AVATAR_TOO_LARGE')).code).toBe('AVATAR_TOO_LARGE');
    expect(getErrorFeedback(coded('AVATAR_TOO_LARGE')).code).toBe('AVATAR_TOO_LARGE');
    expect(pattern.lastIndex).toBe(0);
  });

  test('keeps the other flags of the public pattern', () => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      publicCodePattern: /^avatar_/gi,
    });

    expect(getErrorFeedback(coded('AVATAR_TOO_LARGE')).code).toBe('AVATAR_TOO_LARGE');
  });

  test('marks the access-denied codes, from any iterable', () => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      accessDeniedCodes: new Set(['FORBIDDEN', 'SESSION_REVOKED']),
    });

    expect(getErrorFeedback(coded('SESSION_REVOKED'))).toStrictEqual({
      message: FALLBACK,
      code: null,
      isCancelled: false,
      isAccessDenied: true,
    });
    expect(getErrorFeedback(coded('NOT_FOUND')).isAccessDenied).toBe(false);
    expect(getErrorFeedback(new Error('Forbidden')).isAccessDenied).toBe(false);
  });

  test('marks an AbortError as cancelled, including a DOMException', () => {
    const getErrorFeedback = createErrorFeedback({ fallbackMessage: FALLBACK });
    const named = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
    const controller = new AbortController();
    controller.abort();

    expect(getErrorFeedback(named)).toStrictEqual({
      message: FALLBACK,
      code: null,
      isCancelled: true,
      isAccessDenied: false,
    });
    expect(getErrorFeedback(controller.signal.reason).isCancelled).toBe(true);
    expect(getErrorFeedback(new DOMException('Aborted', 'AbortError')).isCancelled).toBe(true);
    expect(getErrorFeedback({ name: 'AbortError' }).isCancelled).toBe(false);
    expect(getErrorFeedback(new DOMException('Timed out', 'TimeoutError')).isCancelled).toBe(false);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'SESSION_EXPIRED'],
    ['a number', 404],
    ['a plain Error', new Error('SESSION_EXPIRED')],
    ['an object with a numeric code', { code: 401 }],
    ['an object with an empty code', { code: '' }],
    ['a DOMException, whose legacy code is a number', new DOMException('Nope', 'NotFoundError')],
  ])('gives the fallback for %s', (_, error) => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      messagesByCode: { SESSION_EXPIRED: 'Your session expired.' },
      accessDeniedCodes: ['SESSION_EXPIRED'],
      publicCodePattern: /./,
    });

    expect(getErrorFeedback(error)).toStrictEqual({
      message: FALLBACK,
      code: null,
      isCancelled: false,
      isAccessDenied: false,
    });
  });

  test('reads a string code from any error, not only an Exception', () => {
    const getErrorFeedback = createErrorFeedback({
      fallbackMessage: FALLBACK,
      messagesByCode: { ECONNRESET: 'The connection dropped.' },
    });

    expect(getErrorFeedback({ code: 'ECONNRESET' })).toMatchObject({
      message: 'The connection dropped.',
      code: 'ECONNRESET',
    });
  });

  test('never throws for an error built to throw when it is read', () => {
    const getErrorFeedback = createErrorFeedback({ fallbackMessage: FALLBACK });
    const hostile = new Proxy(
      {},
      {
        get: () => {
          throw new Error('trap');
        },
        getPrototypeOf: () => {
          throw new Error('trap');
        },
      },
    );

    expect(getErrorFeedback(hostile)).toStrictEqual({
      message: FALLBACK,
      code: null,
      isCancelled: false,
      isAccessDenied: false,
    });
  });
});
