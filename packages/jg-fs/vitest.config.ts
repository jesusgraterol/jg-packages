import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration'],
  // the coverage measured after the gap pass, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 99, branches: 97, functions: 100, lines: 99 } },
});
