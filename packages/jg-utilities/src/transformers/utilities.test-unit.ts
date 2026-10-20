// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { INumberFormatConfig } from './types.js';
import { buildNumberFormatConfig } from './utilities.js';

/* ************************************************************************************************
 *                                            HELPERS                                             *
 ************************************************************************************************ */

// generates a number format config object
const mockNumberFormatConfig = (
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  prefix: string,
  suffix: string,
): INumberFormatConfig => ({
  minimumFractionDigits,
  maximumFractionDigits,
  prefix,
  suffix,
});

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('buildNumberFormatConfig', () => {
  test.each(<Array<[Partial<INumberFormatConfig> | undefined, INumberFormatConfig]>>[
    [undefined, mockNumberFormatConfig(0, 2, '', '')],
    [{}, mockNumberFormatConfig(0, 2, '', '')],
    [{ minimumFractionDigits: 2 }, mockNumberFormatConfig(2, 2, '', '')],
    [
      { minimumFractionDigits: 2, maximumFractionDigits: 4, prefix: '$' },
      mockNumberFormatConfig(2, 4, '$', ''),
    ],
    [
      { minimumFractionDigits: 1, maximumFractionDigits: 8, suffix: 'BTC' },
      mockNumberFormatConfig(1, 8, '', 'BTC'),
    ],
  ])('buildNumberFormatConfig(%o) -> %o', (a, expected) => {
    expect(buildNumberFormatConfig(a)).toStrictEqual(expected);
  });
});
