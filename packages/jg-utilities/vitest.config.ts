import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration', 'browser', 'bench'],
  fullOnlyFiles: [
    'src/utils/reading.test-unit.ts',
    'src/transformers/utilities.test-unit.ts',
    'src/utils/download.test-browser.ts',
  ],
  // the coverage measured after the gap pass, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 100, branches: 99, functions: 100, lines: 100 } },
});
