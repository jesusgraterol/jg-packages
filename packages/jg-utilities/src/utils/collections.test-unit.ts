// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import {
  applyDefaults,
  deepFreeze,
  isEqual,
  omitProps,
  pickProps,
  shuffleArray,
  splitArrayIntoBatches,
  takeWithinByteBudget,
} from './collections.js';

const TEST_OBJ = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  address: {
    street: '123 Main St',
    city: 'Anytown',
    zip: '12345',
    country: {
      name: 'USA',
      code: 'US',
      state: 'Some State',
      cities: [
        { name: 'City A', zip: '11111' },
        { name: 'City B', zip: '22222' },
      ],
    },
  },
  orders: [
    { id: 101, amount: 100, items: [{ id: 201, name: 'Widget A' }] },
    { id: 102, amount: 50, items: [{ id: 202, name: 'Widget B' }] },
  ],
};

describe('Object Management Helpers', () => {
  describe('splitArrayIntoBatches', () => {
    test.each([
      [[1, 2, 3], -1],
      [[1, 2, 3], 0],
      [[1, 2, 3], 2.5],
      [[1, 2, 3], NaN],
    ])('splitArrayIntoBatches(%o, %s) throws INVALID_BATCH_SIZE', (a, b) => {
      expectToThrowCode(() => splitArrayIntoBatches(a, b), ERRORS.INVALID_BATCH_SIZE);
    });

    test('passing an empty array returns an empty array', () => {
      expect(splitArrayIntoBatches([], 5)).toEqual([]);
    });

    test.each([
      [[1, 2, 3], 10, [[1, 2, 3]]],
      [
        [1, 2, 3, 4, 5, 6, 7, 8, 9],
        3,
        [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      ],
      [[1, 2, 3, 4, 5, 6, 7, 8, 9], 4, [[1, 2, 3, 4], [5, 6, 7, 8], [9]]],
      [[1, 2, 3, 4, 5, 6, 7, 8, 9], 2, [[1, 2], [3, 4], [5, 6], [7, 8], [9]]],
      [[1, 2, 3, 4, 5, 6, 7, 8, 9], 10, [[1, 2, 3, 4, 5, 6, 7, 8, 9]]],
    ])('splitArrayIntoBatches(%o, %i) -> %o', (a, b, expected) => {
      expect(splitArrayIntoBatches(a, b)).toStrictEqual(expected);
    });

    test('can split an array regardless of its content', () => {
      expect(
        splitArrayIntoBatches([{ foo: 'bar' }, [1, 2, 3], 'string', 123, true, null, undefined], 3),
      ).toStrictEqual([[{ foo: 'bar' }, [1, 2, 3], 'string'], [123, true, null], [undefined]]);
    });
  });

  describe('pickProps', () => {
    test('can pick a subset of properties from an object', () => {
      expect(pickProps(TEST_OBJ, ['id', 'name'])).toStrictEqual({
        id: TEST_OBJ.id,
        name: TEST_OBJ.name,
      });
      expect(pickProps(TEST_OBJ, ['email', 'address', 'orders'])).toStrictEqual({
        email: TEST_OBJ.email,
        address: TEST_OBJ.address,
        orders: TEST_OBJ.orders,
      });
    });

    test('can pick all of the properties', () => {
      expect(pickProps(TEST_OBJ, ['id', 'name', 'email', 'address', 'orders'])).toStrictEqual(
        TEST_OBJ,
      );
    });

    test.each<[unknown, unknown]>([
      [{}, ['id']],
      [[], ['id']],
      [undefined, ['id']],
      [null, ['id']],
      ['abc', ['id']],
      [1, ['id']],
    ])('pickProps(%s)', (a, b) => {
      expectToThrowCode(() => pickProps(a as never, b as never), ERRORS.INVALID_OR_EMPTY_OBJECT);
    });

    test.each<[unknown, unknown]>([
      [{ id: 1 }, {}],
      [{ id: 1 }, []],
    ])('pickProps(%s)', (a, b) => {
      expectToThrowCode(() => pickProps(a as never, b as never), ERRORS.INVALID_OR_EMPTY_ARRAY);
    });
  });

  describe('omitProps', () => {
    test('can omit a subset of properties from an object', () => {
      expect(omitProps(TEST_OBJ, ['id', 'name'])).toStrictEqual({
        email: TEST_OBJ.email,
        address: TEST_OBJ.address,
        orders: TEST_OBJ.orders,
      });
      expect(omitProps(TEST_OBJ, ['email', 'address', 'orders'])).toStrictEqual({
        id: TEST_OBJ.id,
        name: TEST_OBJ.name,
      });
    });

    test('can omit all of the properties', () => {
      expect(omitProps(TEST_OBJ, ['id', 'name', 'email', 'address', 'orders'])).toStrictEqual({});
    });

    test.each<[unknown, unknown]>([
      [{}, ['id']],
      [[], ['id']],
      [undefined, ['id']],
      [null, ['id']],
      ['abc', ['id']],
      [1, ['id']],
    ])('omitProps(%s)', (a, b) => {
      expectToThrowCode(() => omitProps(a as never, b as never), ERRORS.INVALID_OR_EMPTY_OBJECT);
    });

    test.each<[unknown, unknown]>([
      [{ id: 1 }, {}],
      [{ id: 1 }, []],
    ])('omitProps(%s)', (a, b) => {
      expectToThrowCode(() => omitProps(a as never, b as never), ERRORS.INVALID_OR_EMPTY_ARRAY);
    });
  });

  describe('applyDefaults', () => {
    test('applies non-nullish overrides to the default values', () => {
      const defaults = {
        name: 'Anonymous',
        retryCount: 8,
        isEnabled: true,
      };

      expect(
        applyDefaults(defaults, {
          name: 'Alice',
          retryCount: 0,
          isEnabled: false,
        }),
      ).toStrictEqual({
        name: 'Alice',
        retryCount: 0,
        isEnabled: false,
      });
    });

    test('uses defaults for missing or nullish overrides', () => {
      const defaults: {
        name: string | null;
        retryCount: number | null;
        isEnabled: boolean;
      } = {
        name: 'Anonymous',
        retryCount: 8,
        isEnabled: true,
      };

      expect(
        applyDefaults(defaults, {
          name: null,
          retryCount: undefined,
        }),
      ).toStrictEqual(defaults);
    });

    test('returns a new shallow object containing only default keys', () => {
      const defaults = {
        options: { retryCount: 8 },
      };
      const overrides = {
        options: { retryCount: 4 },
        unsupportedProp: true,
      };
      const result = applyDefaults(defaults, overrides);

      expect(result).toStrictEqual({
        options: overrides.options,
      });
      expect(result).not.toBe(defaults);
      expect(result.options).toBe(overrides.options);
    });
  });

  describe('isEqual', () => {
    test.each([
      [{}, 'someString'],
      [[], 1],
      [{}, true],
      [[], null],
      [{}, undefined],
      ['someString', {}],
      [null, []],
      [undefined, {}],
    ])('isEqual(%o, %o) -> false, because an object never equals a primitive', (a, b) => {
      expect(isEqual(a, b)).toBe(false);
    });

    test.each([
      ['a', 'a', true],
      ['a', 'b', false],
      [1, 1, true],
      [1, '1', false],
      [NaN, NaN, true],
      [0, -0, false],
      [true, true, true],
      [null, null, true],
      [undefined, undefined, true],
      [null, undefined, false],
      [10n, 10n, true],
    ])('isEqual(%o, %o) -> %s, comparing primitives with Object.is', (a, b, expected) => {
      expect(isEqual(a, b)).toBe(expected);
    });

    test.each([
      [{ a: undefined }, { a: undefined }, true],
      [{ a: undefined }, {}, true],
      [{ a: 1 }, { a: 1 }, true],
      [{ a: 1 }, { a: 2 }, false],
      [{ a: 2 }, { a: 1 }, false],
      [{ a: 2, c: 5, b: 3 }, { c: 5, b: 3, a: 2 }, true],
      [{ a: 2, c: 5, b: 3 }, { c: 5, b: 3, a: 1 }, false],
      [{ a: 2, c: { y: 1, x: 6, z: 2 }, b: 3 }, { c: { z: 2, x: 6, y: 1 }, b: 3, a: 2 }, true],
      [{ a: 2, c: { y: 1, x: 6, z: 2 }, b: 3 }, { c: { z: 2, x: 5, y: 1 }, b: 3, a: 2 }, false],
    ])('isEqual(%o, %o) -> %s', (a, b, expected) => {
      expect(isEqual(a, b)).toBe(expected);
    });

    test.each([
      [[], [], true],
      [[1, 2, 3], [1, 2, 3], true],
      [[1, 2, 3], [3, 2, 1], false],
      [[{ a: 1, b: 2 }], [{ b: 2, a: 1 }], true],
      [[{ a: 1, b: 2 }], [{ b: 1, a: 2 }], false],
      [
        [
          { a: 1, b: 2 },
          { a: 4, b: 6 },
        ],
        [
          { b: 2, a: 1 },
          { b: 6, a: 4 },
        ],
        true,
      ],
      [[{ a: 2, c: { y: 1, x: 6, z: 2 }, b: 3 }], [{ c: { z: 2, x: 6, y: 1 }, b: 3, a: 2 }], true],
      [[{ a: 2, c: { y: 1, x: 6, z: 2 }, b: 3 }], [{ c: { z: 2, x: 1, y: 1 }, b: 3, a: 2 }], false],
    ])('isEqual(%o, %o) -> %s', (a, b, expected) => {
      expect(isEqual(a, b)).toBe(expected);
    });
  });
});

describe('shuffleArray', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('draws each position with rejection sampling, without changing the input', () => {
    // Fisher-Yates swaps index 2 with index 0 (2^32 - 1 is rejected, then 0 % 3), then 1 with 1 % 2
    const queue = [0xffffffff, 0, 1];
    vi.stubGlobal('crypto', {
      getRandomValues: (array: Uint32Array): Uint32Array => {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = queue.shift() ?? 0;
        }
        return array;
      },
    });
    const input = ['a', 'b', 'c'];

    expect(shuffleArray(input)).toStrictEqual(['c', 'b', 'a']);
    expect(input).toStrictEqual(['a', 'b', 'c']);
  });

  test('produces every order of three items about equally often over many real shuffles', () => {
    const counts = new Map<string, number>();
    for (let draw = 0; draw < 60_000; draw += 1) {
      const order = shuffleArray(['a', 'b', 'c']).join('');
      counts.set(order, (counts.get(order) ?? 0) + 1);
    }

    expect(counts.size).toBe(6);
    counts.forEach((count) => {
      expect(Math.abs(count - 10_000)).toBeLessThan(600);
    });
  });
});

describe('deepFreeze', () => {
  test('freezes the value and everything it holds, and returns the same value', () => {
    const hidden = Symbol('hidden');
    const value = { list: [{ id: 1 }], nested: { deeper: { flag: true } }, [hidden]: { a: 1 } };

    const frozen = deepFreeze(value);

    expect(frozen).toBe(value);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.list)).toBe(true);
    expect(Object.isFrozen(value.list[0])).toBe(true);
    expect(Object.isFrozen(value.nested.deeper)).toBe(true);
    expect(Object.isFrozen(value[hidden])).toBe(true);
  });

  test('freezes the children of an object that was already frozen', () => {
    const child = { count: 1 };
    const parent = Object.freeze({ child });

    deepFreeze(parent);

    expect(Object.isFrozen(child)).toBe(true);
  });

  test('handles a cycle', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value['self'] = value;
    value['list'] = [value];

    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(value['list'])).toBe(true);
  });

  test('leaves getters unrun, and typed arrays as they are', () => {
    const getter = vi.fn(() => ({ fresh: true }));
    const bytes = new Uint8Array([1, 2]);
    const value = { bytes };
    Object.defineProperty(value, 'computed', { get: getter, enumerable: true });

    deepFreeze(value);

    expect(getter).not.toHaveBeenCalled();
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(bytes)).toBe(false);
  });

  test.each([[1], ['text'], [null], [undefined]])('returns %j as it is', (value) => {
    expect(deepFreeze(value)).toBe(value);
  });
});

describe('takeWithinByteBudget', () => {
  // a page is { "items": [...] }, 11 bytes around the array
  const measurePage = (_: readonly unknown[], itemsBytes: number): number => itemsBytes + 11;

  test('takes the longest run whose page fits, measuring the items as a JSON array', () => {
    const measured: number[] = [];

    expect(
      takeWithinByteBudget(['aaaa', 'bbbb', 'cccc'], {
        maxBytes: 28,
        measurePage: (page, itemsBytes) => {
          measured.push(itemsBytes);
          return measurePage(page, itemsBytes);
        },
      }),
    ).toStrictEqual(['aaaa', 'bbbb']);
    expect(measured).toStrictEqual([8, 15, 22]);
  });

  test('takes every item when they all fit, including at an exact fit', () => {
    expect(takeWithinByteBudget([1, 2], { maxBytes: 16, measurePage })).toStrictEqual([1, 2]);
  });

  test('returns an empty array when the first item does not fit', () => {
    expect(takeWithinByteBudget(['x'.repeat(100)], { maxBytes: 50, measurePage })).toStrictEqual(
      [],
    );
    expect(takeWithinByteBudget([], { maxBytes: 0, measurePage })).toStrictEqual([]);
  });

  test('stops reading the items at the first that does not fit', () => {
    let built = 0;
    function* projectRows(): Generator<string> {
      for (let row = 0; row < 1000; row += 1) {
        built += 1;
        yield `row-${row}`;
      }
    }

    expect(takeWithinByteBudget(projectRows(), { maxBytes: 40, measurePage })).toHaveLength(3);
    expect(built).toBe(4);
  });

  test.each([[-1], [1.5], [NaN]])(
    'takeWithinByteBudget(items, { maxBytes: %d }) -> throws INVALID_BYTE_LIMIT',
    (maxBytes) => {
      expectToThrowCode(
        () => takeWithinByteBudget([], { maxBytes, measurePage }),
        ERRORS.INVALID_BYTE_LIMIT,
      );
    },
  );

  test('throws UNABLE_TO_SERIALIZE_JSON for an item JSON cannot hold', () => {
    expectToThrowCode(
      () => takeWithinByteBudget([{ id: 1n }], { maxBytes: 100, measurePage }),
      ERRORS.UNABLE_TO_SERIALIZE_JSON,
    );
  });
});
