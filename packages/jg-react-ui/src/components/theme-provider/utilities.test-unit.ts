import { expect, test } from 'vitest';

import { isBrowser, resolveTheme } from './utilities.js';

test('server theme resolution defaults system to light and preserves explicit preferences', () => {
  expect(isBrowser()).toBe(false);
  expect(resolveTheme('system')).toBe('light');
  expect(resolveTheme('dark')).toBe('dark');
  expect(resolveTheme('light')).toBe('light');
});
