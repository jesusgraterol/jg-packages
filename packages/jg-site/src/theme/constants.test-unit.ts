import { describe, expect, test } from 'vitest';

import { THEME_PREFERENCES } from './constants.js';

describe('THEME_PREFERENCES', { tags: ['full'] }, () => {
  test('lists the system theme first, then light and dark, and cannot be changed', () => {
    expect(THEME_PREFERENCES).toStrictEqual(['system', 'light', 'dark']);
    expect(Object.isFrozen(THEME_PREFERENCES)).toBe(true);
  });
});
