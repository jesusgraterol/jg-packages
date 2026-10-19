// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { ERRORS } from '../shared/index.js';
import { buildSearch, readSearchParamInput, shouldRepairSearch } from './utilities.js';

const PARAMS = { query: 'one', page: 'one', tags: 'many', isArchived: 'one' } as const;

const DEFAULTS = { query: '', page: 1, tags: [] as string[], isArchived: false };

const FiltersSchema = z.object({
  query: z.string(),
  page: z.coerce.number().int().min(1),
  tags: z.array(z.string()),
  isArchived: z.preprocess((value) => value === true || value === 'true', z.boolean()),
});

describe('readSearchParamInput', () => {
  test("reads a 'one' key's first value, a 'many' key's every value, and a default for a missing key", () => {
    expect(
      readSearchParamInput(new URLSearchParams('page=2&page=3&tags=a&tags=b'), PARAMS, DEFAULTS),
    ).toStrictEqual({ query: '', page: '2', tags: ['a', 'b'], isArchived: false });
  });
});

describe('buildSearch', () => {
  test('leaves out keys at their defaults, and repeats a many key once per item', () => {
    expect(
      buildSearch(
        { query: 'card', page: 1, tags: ['a', 'b'], isArchived: true },
        new URLSearchParams(),
        PARAMS,
        DEFAULTS,
        true,
      ),
    ).toBe('query=card&tags=a&tags=b&isArchived=true');
  });

  test("keeps the keys it doesn't own first, in their order, or removes them", () => {
    const current = new URLSearchParams('utm=x&page=4&ref=y');

    expect(buildSearch({ ...DEFAULTS, page: 2 }, current, PARAMS, DEFAULTS, true)).toBe(
      'utm=x&ref=y&page=2',
    );
    expect(buildSearch({ ...DEFAULTS, page: 2 }, current, PARAMS, DEFAULTS, false)).toBe('page=2');
  });

  test('leaves out null, undefined, and empty lists', () => {
    expect(
      buildSearch(
        { query: null, page: undefined, tags: [], isArchived: false },
        new URLSearchParams(),
        PARAMS,
        { ...DEFAULTS, tags: ['default'] },
        true,
      ),
    ).toBe('');
  });

  test.each([
    ['an object', { query: { text: 'card' } }],
    ['NaN', { page: Number.NaN }],
    ['Infinity', { page: Number.POSITIVE_INFINITY }],
    ["a list for a 'one' key", { query: ['a'] }],
    ["a value that isn't a list for a 'many' key", { tags: 'a' }],
    ['an object in a list', { tags: [{}] }],
  ])('throws INVALID_SEARCH_PARAM_VALUE for %s', (_, change) => {
    expectToThrowCode(
      () => buildSearch({ ...DEFAULTS, ...change }, new URLSearchParams(), PARAMS, DEFAULTS, true),
      ERRORS.INVALID_SEARCH_PARAM_VALUE,
      "A search parameter's value must be",
    );
  });

  test.each([
    ['the defaults', DEFAULTS],
    ['every key set', { query: 'card & café', page: 7, tags: ['a=b', 'c d'], isArchived: true }],
    ['a repeated tag', { ...DEFAULTS, tags: ['a', 'a'] }],
  ])('round-trips %s through a real Zod schema', (_, value) => {
    const search = buildSearch(value, new URLSearchParams(), PARAMS, DEFAULTS, true);

    expect(
      FiltersSchema.parse(readSearchParamInput(new URLSearchParams(search), PARAMS, DEFAULTS)),
    ).toStrictEqual(value);
  });

  test('lets a real Zod schema reject a value the URL holds', () => {
    expect(() =>
      FiltersSchema.parse(readSearchParamInput(new URLSearchParams('page=0'), PARAMS, DEFAULTS)),
    ).toThrow();
  });
});

describe('shouldRepairSearch', () => {
  test.each([
    ['a canonical search', 'page=2', 'page=2', null, false],
    ['a search that is not canonical', 'page=1', '', null, true],
    [
      'the search a repair started from, as StrictMode repeats it',
      'page=1',
      '',
      { from: 'page=1', to: '' },
      false,
    ],
    [
      "the search a repair went to, which a schema didn't round-trip",
      'page=2',
      'page=3',
      { from: 'page=1', to: 'page=2' },
      false,
    ],
    ['a new search after a repair', 'page=9', '', { from: 'page=1', to: '' }, true],
  ])('shouldRepairSearch(%s) -> %s', (_, current, canonical, last, expected) => {
    expect(shouldRepairSearch(current, canonical, last)).toBe(expected);
  });
});
