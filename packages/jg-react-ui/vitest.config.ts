import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'browser'],
  coverage: { thresholds: { statements: 100, branches: 97, functions: 100, lines: 100 } },
});
