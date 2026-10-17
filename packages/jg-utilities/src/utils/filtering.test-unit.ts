// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { filterByQuery } from './filtering.js';

describe('Filters', () => {
  describe('filterByQuery', () => {
    test.each([
      [[], 'test', undefined, []],
      [[1, 2, 3], '', undefined, [1, 2, 3]],
      [[1, 2, 3], '   ', undefined, [1, 2, 3]],
      [['HELLO', 'WORLD'], 'h', undefined, ['HELLO']],
      [['HELLO', 'WORLD'], 'h W', undefined, ['HELLO', 'WORLD']],
      [['HELLO', 'WORLD'], 'Hello World', undefined, ['HELLO', 'WORLD']],
    ])('filterByQuery(%o, %s, %o) -> %o', (values, query, options, expected) => {
      expect(filterByQuery(values as never, query, options)).toStrictEqual(expected);
    });

    test('can limit the number of results', () => {
      expect(filterByQuery(['aa', 'ab', 'ac', 'ad'], 'a', { limit: 2 })).toStrictEqual([
        'aa',
        'ab',
      ]);
    });

    test('returns a shallow copy when filtering is unnecessary', () => {
      const items = [1, 2, 3];

      expect(filterByQuery(items, '')).not.toBe(items);
      expect(filterByQuery(items, '   ')).not.toBe(items);
    });

    test('can query records by property', () => {
      const items = [
        { name: 'aaa', lastName: 'bbb' },
        { name: 'ccc', lastName: 'ddd' },
        { name: 'eee', lastName: 'fff' },
      ];
      expect(filterByQuery(items, 'a', { queryProp: 'name' })).toStrictEqual([
        { name: 'aaa', lastName: 'bbb' },
      ]);
      expect(filterByQuery(items, 'a', { queryProp: 'lastName' })).toStrictEqual([]);
    });

    test('can filter records by query', () => {
      const items = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Chalie' },
        { id: 4, name: 'David' },
      ];
      expect(filterByQuery(items, 'b')).toStrictEqual([{ id: 2, name: 'Bob' }]);
      expect(filterByQuery(items, 'a')).toStrictEqual([
        { id: 1, name: 'Alice' },
        { id: 3, name: 'Chalie' },
        { id: 4, name: 'David' },
      ]);
      expect(filterByQuery(items, 'al')).toStrictEqual([
        { id: 1, name: 'Alice' },
        { id: 3, name: 'Chalie' },
      ]);
      expect(filterByQuery(items, 'alie')).toStrictEqual([{ id: 3, name: 'Chalie' }]);
    });

    test('can query complex data structures', () => {
      const items = [
        { a: { x: 'Hello', y: ['yak', 123], p: { a: { b: 'croatoan' } }, z: { foo: 'bar' } } },
        { a: { x: 'Bye', y: ['Kok', 456], p: { a: { b: ['xaax'] } }, z: { foo: 'Haj' } } },
      ];
      expect(filterByQuery(items, 'HELLO')).toStrictEqual([items[0]]);
      expect(filterByQuery(items, '123')).toStrictEqual([items[0]]);
      expect(filterByQuery(items, 'croatoan')).toStrictEqual([items[0]]);
      expect(filterByQuery(items, 'kok')).toStrictEqual([items[1]]);
      expect(filterByQuery(items, 'xaax')).toStrictEqual([items[1]]);
      expect(filterByQuery(items, 'k')).toStrictEqual(items);
    });
  });
});
