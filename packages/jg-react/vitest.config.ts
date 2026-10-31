import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  fullOnlyFiles: [
    'src/active-heading/utilities.test-unit.ts',
    'src/active-heading/active-heading.hook.test-browser.ts',
    'src/element-width/utilities.test-unit.ts',
    'src/element-width/element-width.hook.test-browser.ts',
    'src/theme/utilities.test-unit.ts',
    'src/theme/document-theme.hook.test-browser.ts',
  ],
  essentialBrowser: 'chromium',
  // the coverage of the unit tests and the browser tests' Chromium run, which test:coverage
  // measures together, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});
