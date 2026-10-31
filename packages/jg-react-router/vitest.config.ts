import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  fullOnlyFiles: ['src/page-route/page-route-metadata.hook.test-browser.tsx'],
  essentialBrowser: 'chromium',
  // the coverage of the unit tests and the browser tests' Chromium run, which test:coverage
  // measures together, rounded down
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});
