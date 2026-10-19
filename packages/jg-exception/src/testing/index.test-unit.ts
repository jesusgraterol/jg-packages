// @vitest-environment node
import { describe, expect, test } from 'vitest';

import * as testingApi from './index.js';

describe('testing entry point', () => {
  test('exports exactly the error assertions', () => {
    expect(Object.keys(testingApi).sort()).toStrictEqual([
      'expectToRejectCode',
      'expectToThrowCode',
    ]);
  });
});
