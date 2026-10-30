import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration'],
  // the coverage measured when the package was created, rounded down. The CLI's signal paths run in
  // a child process its integration tests start, which coverage doesn't see
  coverage: { thresholds: { statements: 96, branches: 92, functions: 98, lines: 96 } },
});
