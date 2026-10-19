import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['browser'],
  // the coverage of the Chromium browser tests, rounded down; the components only run in a browser
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});
