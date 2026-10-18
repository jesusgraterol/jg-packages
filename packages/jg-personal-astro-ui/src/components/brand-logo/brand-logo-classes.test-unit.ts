import { expect, test } from 'vitest';

import { buildBrandLogoClasses } from './brand-logo-classes.ts';

test('keeps the name on one line beside the mark, and stacks it over a tagline', () => {
  expect(buildBrandLogoClasses(false).name).toBe('truncate text-base');
  expect(buildBrandLogoClasses(true).name).toBe('block truncate text-base leading-none');
  expect(buildBrandLogoClasses(true).tagline).toContain('font-mono');
});
