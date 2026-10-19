// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as publicApi from './index.js';

describe('public API', () => {
  test('exports exactly the documented functions and constants', () => {
    expect(Object.keys(publicApi).sort()).toStrictEqual([
      'DEFAULT_GITHUB_MAX_RESPONSE_BYTES',
      'DEFAULT_GITHUB_TIMEOUT_SECONDS',
      'ERRORS',
      'GITHUB_API_ORIGIN',
      'GITHUB_API_VERSION',
      'GITHUB_RAW_CONTENT_ORIGIN',
      'assertGithubAppPrivateKey',
      'buildGithubApiUrl',
      'buildGithubRawContentUrl',
      'createGithubAppJwt',
      'createGithubHeaders',
      'createInstallationToken',
      'getGithubRateLimitDeadline',
      'revokeInstallationToken',
      'verifyGithubWebhookSignature',
    ]);
  });
});
