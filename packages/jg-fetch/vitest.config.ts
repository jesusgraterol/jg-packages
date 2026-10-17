import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration'],
  // the coverage measured after the gap pass, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 99, branches: 100, functions: 97, lines: 100 } },
});
