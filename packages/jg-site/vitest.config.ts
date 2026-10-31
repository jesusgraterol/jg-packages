import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit'],
  fullOnlyFiles: [
    'src/seo/constants.test-unit.ts',
    'src/theme/constants.test-unit.ts',
    'src/theme/theme.test-unit.ts',
    'src/llms-text/llms-text.test-unit.ts',
  ],
  // the coverage measured after the gap pass, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});
