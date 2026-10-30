// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  applyDefaults,
  createCursorCodec,
  createDeadline,
  createEventBus,
  createRequestCoordinator,
  createTaskRunner,
  createTimestamp,
  decodeBase64Url,
  decodeCursor,
  downloadBlob,
  downloadJson,
  encodeBase64Url,
  encodeCursor,
  ERRORS,
  estimateReadingTime,
  generateUtcDateSequence,
  getTrailingUtcDateRange,
  hasNavigator,
  hasWindow,
  isFileNameValid,
  isIndexedDbAvailable,
  isYouTubeVideoIdValid,
  MAX_EMAIL_LENGTH,
  ONE_DAY_IN_MILLISECONDS,
  prefersReducedMotion,
  parseYouTubeVideoId,
  prettifyTime,
  redactSecrets,
  redactUrlQueryParams,
  SECRET_TOKEN_PATTERNS,
  splitArrayIntoBatches,
  toUtcDate,
  toYouTubeEmbedUrl,
  toYouTubeWatchUrl,
  truncateToUtf8Bytes,
  waitUntil,
} from './index.js';

describe('public API', () => {
  test('exports the request coordinator and the cursor codec from the package entry point', async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });
    const codec = createCursorCodec<{ id: number }>({
      schema: { parse: (value) => value as { id: number } },
    });

    await expect(coordinator.run(() => Promise.resolve('ran'))).resolves.toBe('ran');
    expect(codec.decode(codec.encode({ id: 1 }), { id: 1 })).toStrictEqual({ id: 1 });
  });

  test('exports the redaction and YouTube helpers from the package entry point', () => {
    expect(redactSecrets('ghp_abcdefghijklmnopqrstuvwxyz').text).toBe('[redacted]');
    expect(redactUrlQueryParams('/a?token=1', ['token'])).toBe('/a');
    expect(SECRET_TOKEN_PATTERNS).toHaveLength(3);
    expect(parseYouTubeVideoId('https://youtu.be/M7lc1UVf-VE')).toBe('M7lc1UVf-VE');
    expect(isYouTubeVideoIdValid('M7lc1UVf-VE')).toBe(true);
    expect(toYouTubeWatchUrl('M7lc1UVf-VE')).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    expect(toYouTubeEmbedUrl('M7lc1UVf-VE')).toBe(
      'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    );
  });

  test('exports the task runner and the deadline from the package entry point', async () => {
    const runner = createTaskRunner({ onError: () => undefined });
    const deadline = createDeadline({ timeoutSeconds: 60 });

    await expect(runner.run(() => Promise.resolve('ran'))).resolves.toBe('ran');
    expect(deadline.isExpired()).toBe(false);
    deadline.dispose();
    expect(ERRORS.TASK_RUNNER_BUSY).toBe('TASK_RUNNER_BUSY');
    expect(ERRORS.DEADLINE_EXCEEDED).toBe('DEADLINE_EXCEEDED');
  });

  test('exports the downloads from the package entry point', () => {
    // Node.js has no document, so neither starts a download
    expect(downloadBlob(new Blob(['x']), 'x.txt')).toBe(false);
    expect(downloadJson({ x: 1 }, 'x.json')).toBe(false);
  });

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

  test(
    'exports composable reading-time utilities from the package entry point',
    { tags: ['full'] },
    () => {
      expect(prettifyTime(estimateReadingTime('word '.repeat(200)))).toBe('1m');
    },
  );

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

  test('exports the UTC date helpers, UTF-8 truncation, and the event bus', () => {
    expect(toUtcDate(0)).toBe('1970-01-01');
    expect(getTrailingUtcDateRange(1, 0)).toStrictEqual({
      fromDate: '1970-01-01',
      toDate: '1970-01-01',
    });
    expect(generateUtcDateSequence({ fromDate: '1970-01-01', toDate: '1970-01-02' })).toHaveLength(
      2,
    );
    expect(truncateToUtf8Bytes('café', 4)).toBe('caf');
    expect(createEventBus({ onError: () => undefined }).emit).toBeTypeOf('function');
  });

  test('keeps the date formatting constants internal', { tags: ['full'] }, async () => {
    const publicApi = await import('./index.js');

    expect(publicApi).not.toHaveProperty('DATE_LOCALE');
    expect(publicApi).not.toHaveProperty('DATE_TEMPLATES_WITH_TIME');
  });
});
