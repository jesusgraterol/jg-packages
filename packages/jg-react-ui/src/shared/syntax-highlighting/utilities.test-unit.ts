import { expect, test } from 'vitest';
import { resolveSyntaxHighlightTheme } from './index.js';

test('the server snapshot defaults to light without browser globals', { tags: ['full'] }, () => {
  expect(resolveSyntaxHighlightTheme()).toBe('light');
});
