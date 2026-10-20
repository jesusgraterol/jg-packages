// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as publicApi from './index.js';

describe('public API', () => {
  test('exports exactly the documented functions and constants', () => {
    expect(Object.keys(publicApi).sort()).toStrictEqual([
      'ERRORS',
      'TOTP_PARAMETERS',
      'generateRandomBytes',
      'generateRandomDigits',
      'generateTotpSecret',
      'hashValue',
      'signHmac',
      'verifyHmac',
      'verifyTotp',
    ]);
  });
});
