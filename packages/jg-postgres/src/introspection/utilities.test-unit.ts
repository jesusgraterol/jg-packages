// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { ITableDiff } from './types.js';
import { diffTables } from './utilities.js';

describe('diffTables', () => {
  test.each<[string[], string[], ITableDiff]>([
    [[], [], { missing: [], unexpected: [] }],
    [['b', 'a'], ['a', 'b'], { missing: [], unexpected: [] }],
    [['a'], ['a', 'c', 'b'], { missing: ['b', 'c'], unexpected: [] }],
    [['z', 'a', 'y'], ['a'], { missing: [], unexpected: ['y', 'z'] }],
    [
      ['app_user', 'session'],
      ['app_user', 'invitation'],
      { missing: ['invitation'], unexpected: ['session'] },
    ],
    [['a', 'a', 'x'], ['b', 'b'], { missing: ['b'], unexpected: ['a', 'x'] }],
    [['App_User'], ['app_user'], { missing: ['app_user'], unexpected: ['App_User'] }],
  ])('diffTables(%o, %o) -> %o', (actual, expected, diff) => {
    expect(diffTables(actual, expected)).toStrictEqual(diff);
  });

  test('changes neither list', () => {
    const actual = ['b', 'a'];
    const expected = ['c', 'a'];

    diffTables(actual, expected);

    expect(actual).toStrictEqual(['b', 'a']);
    expect(expected).toStrictEqual(['c', 'a']);
  });
});
