import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit'],
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});
