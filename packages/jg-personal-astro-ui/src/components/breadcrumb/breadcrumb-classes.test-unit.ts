import { expect, test } from 'vitest';

import { buildBreadcrumbListClasses } from './breadcrumb-classes.ts';

test('starts the trail at its column, or centers it', () => {
  expect(buildBreadcrumbListClasses()).not.toContain('justify-center');
  expect(buildBreadcrumbListClasses('center').split(' ').at(-1)).toBe('justify-center');
});
