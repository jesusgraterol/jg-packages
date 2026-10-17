import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration', 'bench'],
  // the coverage measured after the gap pass, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 100, branches: 98, functions: 100, lines: 100 } },
});
