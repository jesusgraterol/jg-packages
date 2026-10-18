import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  // the coverage measured when the package was created, rounded down; the scroll hook's client
  // snapshot runs only in the browser tests, which coverage doesn't measure
  coverage: { thresholds: { statements: 98, branches: 100, functions: 97, lines: 100 } },
});
