import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  // the coverage of the unit tests and the browser tests' Chromium run, which test:coverage
  // measures together, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 99, branches: 97, functions: 96, lines: 99 } },
});
