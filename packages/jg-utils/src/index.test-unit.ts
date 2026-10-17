// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  applyDefaults,
  createTimestamp,
  decodeBase64Url,
  decodeCursor,
  encodeBase64Url,
  encodeCursor,
  ERRORS,
  estimateReadingTime,
  hasNavigator,
  hasWindow,
  isFileNameValid,
  isIndexedDbAvailable,
  MAX_EMAIL_LENGTH,
  ONE_DAY_IN_MILLISECONDS,
  prefersReducedMotion,
  prettifyTime,
  splitArrayIntoBatches,
  waitUntil,
} from './index.js';

describe('public API', () => {
  test('exports applyDefaults from the package entry point', () => {
    expect(applyDefaults({ retryCount: 8 }, { retryCount: 4 })).toStrictEqual({ retryCount: 4 });
  });

  test('exports splitArrayIntoBatches from the package entry point', () => {
    expect(splitArrayIntoBatches([1, 2, 3], 2)).toStrictEqual([[1, 2], [3]]);
  });

  test('no longer exports the helpers that moved to jg-exception/testing, or createDeepClone', async () => {
    const publicApi: Record<string, unknown> = await import('./index.js');

    expect(publicApi['expectToThrowCode']).toBeUndefined();
    expect(publicApi['expectToRejectCode']).toBeUndefined();
    expect(publicApi['createDeepClone']).toBeUndefined();
  });

  test('exports the error codes, the time constants, timestamps, and cursors', () => {
    expect(ERRORS.INVALID_CURSOR).toBe('INVALID_CURSOR');
    expect(ONE_DAY_IN_MILLISECONDS).toBe(86_400_000);
    expect(createTimestamp(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(decodeCursor(encodeCursor({ page: 2 }))).toStrictEqual({ page: 2 });
  });

  test('exports validation constants from the package entry point', () => {
    expect(MAX_EMAIL_LENGTH).toBe(320);
  });

  test('exports composable reading-time utilities from the package entry point', () => {
    expect(prettifyTime(estimateReadingTime('word '.repeat(200)))).toBe('1m');
  });

  test('exports the base64url transformers from the package entry point', () => {
    expect(decodeBase64Url(encodeBase64Url('{"page":2}'))).toBe('{"page":2}');
  });

  test('exports the file name validation from the package entry point', () => {
    expect(isFileNameValid('notes.md')).toBe(true);
  });

  test('exports the async and environment utilities from the package entry point', async () => {
    await expect(waitUntil(() => 'ready', { timeoutSeconds: 1 })).resolves.toBe('ready');
    [hasWindow, hasNavigator, isIndexedDbAvailable, prefersReducedMotion].forEach((check) => {
      expect(check).toBeTypeOf('function');
    });
  });

  test('keeps the date formatting constants internal', async () => {
    const publicApi = await import('./index.js');

    expect(publicApi).not.toHaveProperty('DATE_LOCALE');
    expect(publicApi).not.toHaveProperty('DATE_TEMPLATES_WITH_TIME');
  });
});
