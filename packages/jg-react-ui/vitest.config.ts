import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  coverage: { thresholds: { statements: 100, branches: 96, functions: 100, lines: 100 } },
});
