// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as publicApi from './index.js';

describe('public API', () => {
  test('exports exactly the documented functions, classes, and constants', () => {
    expect(Object.keys(publicApi).sort()).toStrictEqual([
      'DEFAULT_MESSAGE',
      'EXCEPTION_SEVERITIES',
      'Exception',
      'REDACTED_VALUE',
      'UNKNOWN_ERROR_CODE',
      'createErrorFeedback',
      'defineErrorCatalog',
      'extractMessage',
      'extractRedactedMessage',
      'getErrorCode',
      'hasErrorCode',
      'hasErrorCodePrefix',
      'isDefaultErrorMessage',
      'isException',
      'redactFields',
    ]);
    expect(publicApi.DEFAULT_MESSAGE).toBe(
      'The error message could not be extracted, check the logs for more information.',
    );
    expect(publicApi.REDACTED_VALUE).toBe('[redacted]');
    expect(publicApi.UNKNOWN_ERROR_CODE).toBe('UNKNOWN_ERROR');
    expect(publicApi.EXCEPTION_SEVERITIES).toStrictEqual(['expected', 'critical']);
  });
});
