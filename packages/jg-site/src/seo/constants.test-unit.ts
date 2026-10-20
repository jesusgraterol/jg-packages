import { describe, expect, test } from 'vitest';

import { SEARCH_TEXT_LIMITS } from './constants.js';

describe('SEARCH_TEXT_LIMITS', () => {
  test('keeps titles to 60 characters and descriptions to 70 through 160', () => {
    expect(SEARCH_TEXT_LIMITS).toStrictEqual({
      descriptionMaxLength: 160,
      descriptionMinLength: 70,
      titleMaxLength: 60,
    });
  });
});
