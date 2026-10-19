// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { describe, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { startProcessAndWait, waitForPort, waitForUrl } from './readiness.js';

describe('readiness option checks', () => {
  test.each([0, -1, 1.5, 65_536, Number.NaN])('waitForPort rejects the port %d', async (port) => {
    await expectToRejectCode(
      waitForPort(port, { timeoutSeconds: 1 }),
      ERRORS.INVALID_PORT,
      'The port must be an integer from 1 to 65535.',
    );
  });

  test.each([
    ['a missing timeout', { timeoutSeconds: undefined as unknown as number }],
    ['a zero timeout', { timeoutSeconds: 0 }],
    ['an infinite timeout', { timeoutSeconds: Number.POSITIVE_INFINITY }],
    ['a zero interval', { timeoutSeconds: 1, intervalSeconds: 0 }],
    ['a negative connect timeout', { timeoutSeconds: 1, connectTimeoutSeconds: -1 }],
  ])('waitForPort rejects %s', async (_, options) => {
    await expectToRejectCode(
      waitForPort(8080, options),
      ERRORS.INVALID_READINESS_OPTIONS,
      'The readiness options need finite, positive seconds.',
    );
  });

  test('waitForUrl rejects a URL it cannot parse, and a zero request timeout', async () => {
    await expectToRejectCode(
      waitForUrl('not a url', { timeoutSeconds: 1 }),
      ERRORS.INVALID_READINESS_OPTIONS,
      'The readiness options need a valid URL.',
    );
    await expectToRejectCode(
      waitForUrl('http://127.0.0.1/', { timeoutSeconds: 1, requestTimeoutSeconds: 0 }),
      ERRORS.INVALID_READINESS_OPTIONS,
    );
  });

  test('startProcessAndWait checks its options before it starts anything', async () => {
    const command = { command: 'never-started', args: [] };

    await expectToRejectCode(
      startProcessAndWait(command, { readyWhen: { port: 70_000 }, timeoutSeconds: 1 }),
      ERRORS.INVALID_PORT,
    );
    await expectToRejectCode(
      startProcessAndWait(command, {
        readyWhen: { probe: 'not a function' as unknown as () => boolean },
        timeoutSeconds: 1,
      }),
      ERRORS.INVALID_READINESS_OPTIONS,
      'The readiness options need a probe function.',
    );
    await expectToRejectCode(
      startProcessAndWait(command, {
        readyWhen: { port: 8080 },
        timeoutSeconds: 1,
        gracePeriodSeconds: -1,
      }),
      ERRORS.INVALID_READINESS_OPTIONS,
    );
  });
});
