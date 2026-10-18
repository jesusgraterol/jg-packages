import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  // the coverage measured when the package was created, rounded down; the IndexedDB reads and
  // writes run only in the browser tests, which coverage doesn't measure
  coverage: { thresholds: { statements: 89, branches: 81, functions: 87, lines: 90 } },
});
