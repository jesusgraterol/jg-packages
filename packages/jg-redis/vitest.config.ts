import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration'],
  // the coverage measured when the package was created, rounded down
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
  globalSetup: './src/test-utils/redis.global-setup.ts',
});
