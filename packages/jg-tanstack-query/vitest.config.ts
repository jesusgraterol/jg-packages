import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  // the measured coverage, including the .tsx provider, rounded down; the IndexedDB reads and
  // writes run only in the browser tests, which coverage doesn't measure
  coverage: { thresholds: { statements: 90, branches: 84, functions: 88, lines: 91 } },
});
