// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { DIRECTORY_ELEMENTS_DEFAULT_OPTIONS } from './constants.js';
import { buildDirectoryElementsOptions } from './directory-elements.js';

describe('buildDirectoryElementsOptions', () => {
  test('fills every missing option with its default', () => {
    expect(buildDirectoryElementsOptions()).toStrictEqual(DIRECTORY_ELEMENTS_DEFAULT_OPTIONS);
    expect(buildDirectoryElementsOptions({})).toStrictEqual(DIRECTORY_ELEMENTS_DEFAULT_OPTIONS);
    expect(buildDirectoryElementsOptions({ sortOrder: 'desc' })).toStrictEqual({
      ...DIRECTORY_ELEMENTS_DEFAULT_OPTIONS,
      sortOrder: 'desc',
    });
  });

  test('keeps every provided option', () => {
    const options = { sortByKey: 'size', sortOrder: 'desc', includeExts: ['.json'] } as const;
    expect(
      buildDirectoryElementsOptions({ ...options, includeExts: [...options.includeExts] }),
    ).toStrictEqual({ sortByKey: 'size', sortOrder: 'desc', includeExts: ['.json'] });
  });
});
