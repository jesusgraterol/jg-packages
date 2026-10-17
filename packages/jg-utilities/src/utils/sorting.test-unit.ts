// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import type { ISortDirection } from './types.js';
import {
  sortPrimitives,
  sortRecords,
  sortRecordsWithBigIntString,
  sortRecordsWithDateValue,
} from './sorting.js';

// records containing date values accepted by sortRecordsWithDateValue
type IDateSortRecord = Record<'v', Date | number | string>;

describe('Sorting Utils', () => {
  test.each(<Array<[(number | string | bigint)[], ISortDirection, (number | string | bigint)[]]>>[
    [[], 'asc', []],

    // numeric values
    [[1, 2, 3, 4, 5], 'asc', [1, 2, 3, 4, 5]],
    [[1, 2, 3, 4, 5], 'desc', [5, 4, 3, 2, 1]],
    [[5, 4, 3, 2, 1], 'asc', [1, 2, 3, 4, 5]],
    [[5, 4, 3, 2, 1], 'desc', [5, 4, 3, 2, 1]],
    [[3, 1, 4, 2, 5], 'asc', [1, 2, 3, 4, 5]],
    [[3, 1, 4, 2, 5], 'desc', [5, 4, 3, 2, 1]],

    // bigint values
    [[1n, 2n, 3n, 4n, 5n], 'asc', [1n, 2n, 3n, 4n, 5n]],
    [[1n, 2n, 3n, 4n, 5n], 'desc', [5n, 4n, 3n, 2n, 1n]],
    [[5n, 4n, 3n, 2n, 1n], 'asc', [1n, 2n, 3n, 4n, 5n]],
    [[5n, 4n, 3n, 2n, 1n], 'desc', [5n, 4n, 3n, 2n, 1n]],
    [[3n, 1n, 4n, 2n, 5n], 'asc', [1n, 2n, 3n, 4n, 5n]],
    [[3n, 1n, 4n, 2n, 5n], 'desc', [5n, 4n, 3n, 2n, 1n]],
    [
      [9007199254740993n, -12n, 0n, 9007199254740992n, -12n],
      'asc',
      [-12n, -12n, 0n, 9007199254740992n, 9007199254740993n],
    ],
    [
      [9007199254740993n, -12n, 0n, 9007199254740992n, -12n],
      'desc',
      [9007199254740993n, 9007199254740992n, 0n, -12n, -12n],
    ],

    // string values
    [['a', 'b', 'c'], 'asc', ['a', 'b', 'c']],
    [['a', 'b', 'c'], 'desc', ['c', 'b', 'a']],
    [['Blue', 'Humpback', 'Beluga'], 'asc', ['Beluga', 'Blue', 'Humpback']],
    [['Blue', 'Humpback', 'Beluga'], 'desc', ['Humpback', 'Blue', 'Beluga']],
    [
      ['The', 'Magnetic', 'Edward', 'Sharpe', 'Zeros', 'And'],
      'asc',
      ['And', 'Edward', 'Magnetic', 'Sharpe', 'The', 'Zeros'],
    ],
    [
      ['The', 'Magnetic', 'Edward', 'Sharpe', 'Zeros', 'And'],
      'desc',
      ['Zeros', 'The', 'Sharpe', 'Magnetic', 'Edward', 'And'],
    ],
  ])('sortPrimitives(%o, %s) -> %o', (a, b, expected) => {
    const arr = a.slice();
    arr.sort(sortPrimitives(b));
    expect(arr).toStrictEqual(expected);
  });

  test.each(<Array<[(number | string)[], ISortDirection]>>[
    [[1, { foo: 'bar' }, 3, 4, 5], 'asc'],
    [[1, '2', 3, 4, 5], 'asc'],
    [[1, 2, '3', 4, '5'], 'asc'],
    [[1n, 2n, 3, 4n, 5n], 'asc'],
    [[1n, '2', 3n, 4n, 5n], 'asc'],
    [[[1], 2, 3], 'asc'],
  ])('sortPrimitives(%o, %s) -> Error: MIXED_OR_UNSUPPORTED_DATA_TYPES', (a, b) => {
    expectToThrowCode(() => a.sort(sortPrimitives(b)), ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES);
  });

  test.each(<Array<[Record<string, unknown>[], ISortDirection, Record<string, unknown>[]]>>[
    [[], 'asc', []],

    // numeric values
    [[{ v: 1 }, { v: 2 }, { v: 3 }], 'asc', [{ v: 1 }, { v: 2 }, { v: 3 }]],
    [[{ v: 1 }, { v: 2 }, { v: 3 }], 'desc', [{ v: 3 }, { v: 2 }, { v: 1 }]],
    [
      [{ v: 21 }, { v: 37 }, { v: 45 }, { v: -12 }, { v: 13 }, { v: 37 }],
      'asc',
      [{ v: -12 }, { v: 13 }, { v: 21 }, { v: 37 }, { v: 37 }, { v: 45 }],
    ],
    [
      [{ v: 21 }, { v: 37 }, { v: 45 }, { v: -12 }, { v: 13 }, { v: 37 }],
      'desc',
      [{ v: 45 }, { v: 37 }, { v: 37 }, { v: 21 }, { v: 13 }, { v: -12 }],
    ],

    // bigint values
    [[{ v: 1n }, { v: 2n }, { v: 3n }], 'asc', [{ v: 1n }, { v: 2n }, { v: 3n }]],
    [[{ v: 1n }, { v: 2n }, { v: 3n }], 'desc', [{ v: 3n }, { v: 2n }, { v: 1n }]],
    [
      [{ v: 21n }, { v: 37n }, { v: 45n }, { v: -12n }, { v: 13n }, { v: 37n }],
      'asc',
      [{ v: -12n }, { v: 13n }, { v: 21n }, { v: 37n }, { v: 37n }, { v: 45n }],
    ],
    [
      [{ v: 21n }, { v: 37n }, { v: 45n }, { v: -12n }, { v: 13n }, { v: 37n }],
      'desc',
      [{ v: 45n }, { v: 37n }, { v: 37n }, { v: 21n }, { v: 13n }, { v: -12n }],
    ],
    [
      [{ v: 9007199254740993n }, { v: -12n }, { v: 0n }, { v: 9007199254740992n }],
      'asc',
      [{ v: -12n }, { v: 0n }, { v: 9007199254740992n }, { v: 9007199254740993n }],
    ],
    [
      [{ v: 9007199254740993n }, { v: -12n }, { v: 0n }, { v: 9007199254740992n }],
      'desc',
      [{ v: 9007199254740993n }, { v: 9007199254740992n }, { v: 0n }, { v: -12n }],
    ],

    // string values
    [[{ v: 'a' }, { v: 'b' }, { v: 'c' }], 'asc', [{ v: 'a' }, { v: 'b' }, { v: 'c' }]],
    [[{ v: 'a' }, { v: 'b' }, { v: 'c' }], 'desc', [{ v: 'c' }, { v: 'b' }, { v: 'a' }]],
    [
      [{ v: 'Blue' }, { v: 'Humpback' }, { v: 'Beluga' }],
      'asc',
      [{ v: 'Beluga' }, { v: 'Blue' }, { v: 'Humpback' }],
    ],
    [
      [{ v: 'Blue' }, { v: 'Humpback' }, { v: 'Beluga' }],
      'desc',
      [{ v: 'Humpback' }, { v: 'Blue' }, { v: 'Beluga' }],
    ],
    [
      [
        { v: 'The' },
        { v: 'Magnetic' },
        { v: 'Edward' },
        { v: 'Sharpe' },
        { v: 'Zeros' },
        { v: 'And' },
      ],
      'asc',
      [
        { v: 'And' },
        { v: 'Edward' },
        { v: 'Magnetic' },
        { v: 'Sharpe' },
        { v: 'The' },
        { v: 'Zeros' },
      ],
    ],
    [
      [
        { v: 'The' },
        { v: 'Magnetic' },
        { v: 'Edward' },
        { v: 'Sharpe' },
        { v: 'Zeros' },
        { v: 'And' },
      ],
      'desc',
      [
        { v: 'Zeros' },
        { v: 'The' },
        { v: 'Sharpe' },
        { v: 'Magnetic' },
        { v: 'Edward' },
        { v: 'And' },
      ],
    ],
  ])('sortRecords(%o, %s) -> %o', (a, b, expected) => {
    const arr = a.slice();
    arr.sort(sortRecords('v', b));
    expect(arr).toStrictEqual(expected);
  });

  test.each(<Array<[Record<string, unknown>[]]>>[
    [[{ v: 'a' }, { v: 'b' }, { v: { c: 'c' } }]],
    [[{ v: 1 }, { v: 'b' }, { v: 3 }]],
    [[{ v: 1 }, { v: 2 }, { v: '3' }]],
    [[{ v: 1n }, { v: 2n }, { v: 3 }]],
    [[{ v: 1n }, { v: 2n }, { v: '3' }]],
    [[{ v: [1] }, { v: [2] }, { v: '3' }]],
  ])('sortRecords(%o, %s) -> Error: MIXED_OR_UNSUPPORTED_DATA_TYPES', (a) => {
    expectToThrowCode(
      () => a.sort(sortRecords('v', 'asc')),
      ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES,
    );
  });

  test.each(<Array<[Array<Record<'v', string>>, ISortDirection, Array<Record<'v', string>>]>>[
    [[], 'asc', []],
    [[{ v: '1' }, { v: '2' }, { v: '3' }], 'asc', [{ v: '1' }, { v: '2' }, { v: '3' }]],
    [[{ v: '1' }, { v: '2' }, { v: '3' }], 'desc', [{ v: '3' }, { v: '2' }, { v: '1' }]],
    [
      [{ v: '21' }, { v: '37' }, { v: '45' }, { v: '-12' }, { v: '13' }, { v: '37' }],
      'asc',
      [{ v: '-12' }, { v: '13' }, { v: '21' }, { v: '37' }, { v: '37' }, { v: '45' }],
    ],
    [
      [{ v: '21' }, { v: '37' }, { v: '45' }, { v: '-12' }, { v: '13' }, { v: '37' }],
      'desc',
      [{ v: '45' }, { v: '37' }, { v: '37' }, { v: '21' }, { v: '13' }, { v: '-12' }],
    ],
    [
      [{ v: '9007199254740993' }, { v: '-12' }, { v: '0' }, { v: '9007199254740992' }],
      'asc',
      [{ v: '-12' }, { v: '0' }, { v: '9007199254740992' }, { v: '9007199254740993' }],
    ],
    [
      [{ v: '9007199254740993' }, { v: '-12' }, { v: '0' }, { v: '9007199254740992' }],
      'desc',
      [{ v: '9007199254740993' }, { v: '9007199254740992' }, { v: '0' }, { v: '-12' }],
    ],
  ])('sortRecordsWithBigIntString(%o, %s) -> %o', (a, b, expected) => {
    const arr = a.slice();
    arr.sort(sortRecordsWithBigIntString('v', b));
    expect(arr).toStrictEqual(expected);
  });

  test.each(<Array<[string, Array<Record<string, unknown>>]>>[
    ['mixed value types', [{ v: '1' }, { v: 2 }]],
    ['missing sort key', [{ v: '1' }, { value: '2' }]],
  ])('sortRecordsWithBigIntString(%s) -> Error: MIXED_OR_UNSUPPORTED_DATA_TYPES', (_, a) => {
    expectToThrowCode(
      () => a.sort(sortRecordsWithBigIntString('v', 'asc')),
      ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES,
    );
  });

  test('sortRecordsWithBigIntString(invalid bigint string) -> Error: MIXED_OR_UNSUPPORTED_DATA_TYPES', () => {
    expectToThrowCode(
      () => [{ v: '1' }, { v: 'not-a-bigint' }].sort(sortRecordsWithBigIntString('v', 'asc')),
      ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES,
    );
  });

  test.each(<Array<[IDateSortRecord[], ISortDirection, IDateSortRecord[]]>>[
    [[], 'asc', []],
    [[{ v: 1 }, { v: 0 }], 'asc', [{ v: 0 }, { v: 1 }]],
    [
      [
        { v: '2026-06-15T00:00:00.000Z' },
        { v: '2024-01-01T00:00:00.000Z' },
        { v: '2025-01-01T00:00:00.000Z' },
      ],
      'asc',
      [
        { v: '2024-01-01T00:00:00.000Z' },
        { v: '2025-01-01T00:00:00.000Z' },
        { v: '2026-06-15T00:00:00.000Z' },
      ],
    ],
    [
      [
        { v: '2026-06-15T00:00:00.000Z' },
        { v: '2024-01-01T00:00:00.000Z' },
        { v: '2025-01-01T00:00:00.000Z' },
      ],
      'desc',
      [
        { v: '2026-06-15T00:00:00.000Z' },
        { v: '2025-01-01T00:00:00.000Z' },
        { v: '2024-01-01T00:00:00.000Z' },
      ],
    ],
    [
      [
        { v: new Date('2026-06-15T00:00:00.000Z') },
        { v: '2024-01-01T00:00:00.000Z' },
        { v: 1_735_689_600_000 },
      ],
      'asc',
      [
        { v: '2024-01-01T00:00:00.000Z' },
        { v: 1_735_689_600_000 },
        { v: new Date('2026-06-15T00:00:00.000Z') },
      ],
    ],
    [
      [
        { v: new Date('2026-06-15T00:00:00.000Z') },
        { v: '2024-01-01T00:00:00.000Z' },
        { v: 1_735_689_600_000 },
      ],
      'desc',
      [
        { v: new Date('2026-06-15T00:00:00.000Z') },
        { v: 1_735_689_600_000 },
        { v: '2024-01-01T00:00:00.000Z' },
      ],
    ],
  ])('sortRecordsWithDateValue(%o, %s) -> %o', (a, b, expected) => {
    const arr = a.slice();
    arr.sort(sortRecordsWithDateValue('v', b));
    expect(arr).toStrictEqual(expected);
  });

  test.each(<Array<[string, Array<Record<string, unknown>>]>>[
    [
      'missing sort key',
      [{ v: '2024-01-01T00:00:00.000Z' }, { value: '2025-01-01T00:00:00.000Z' }],
    ],
    ['null date value', [{ v: null }, { v: '2025-01-01T00:00:00.000Z' }]],
    ['invalid date value', [{ v: 'invalid-date' }, { v: '2025-01-01T00:00:00.000Z' }]],
  ])('sortRecordsWithDateValue(%s) -> Error: MIXED_OR_UNSUPPORTED_DATA_TYPES', (_, a) => {
    expectToThrowCode(
      () => a.sort(sortRecordsWithDateValue('v', 'asc')),
      ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES,
    );
  });

  test('keeps the order of strings that differ only in case', () => {
    expect(['b', 'A', 'a'].sort(sortPrimitives('asc'))).toStrictEqual(['A', 'a', 'b']);
  });

  test("reports a date value that can't be converted with the conversion's error as the cause", () => {
    let thrown: unknown;
    try {
      [{ at: Symbol('at') }, { at: 1 }].sort(sortRecordsWithDateValue('at', 'asc'));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES });
    expect((thrown as { cause?: unknown }).cause).toBeInstanceOf(TypeError);
  });
});
