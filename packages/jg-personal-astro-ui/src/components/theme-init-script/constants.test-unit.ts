import { describe, expect, test } from 'vitest';

import { THEME_APPLIED_EVENT, THEME_CHANGE_EVENT } from './constants.ts';

describe('the theme events', () => {
  test('keep the names theme-control and theme-init-script exchange on window, which pages can hear', () => {
    expect([THEME_CHANGE_EVENT, THEME_APPLIED_EVENT]).toStrictEqual([
      'jg-theme-change',
      'jg-theme-applied',
    ]);
  });
});
