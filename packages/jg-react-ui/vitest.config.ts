import { mergeConfig } from 'vitest/config';

import { createVitestConfig } from '@jg-packages/vitest-config';

export default mergeConfig(
  createVitestConfig({
    categories: ['unit', 'browser'],
    coverage: { thresholds: { statements: 100, branches: 98, functions: 100, lines: 100 } },
  }),
  {
    // hydration tests must not trigger a dependency-optimizer reload during browser collection.
    optimizeDeps: { include: ['react-dom/client', 'react-dom/server'] },
  },
);
