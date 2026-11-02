import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration'],
  fullOnlyFiles: [
    'src/checks/release-docs.test-unit.ts',
    'src/checks/examples.test-unit.ts',
    'src/checks/examples.test-integration.ts',
    'src/checks/error-codes.test-integration.ts',
  ],
});
