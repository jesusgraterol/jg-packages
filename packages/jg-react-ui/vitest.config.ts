import { mergeConfig } from 'vitest/config';

import { createVitestConfig } from '@jg-packages/vitest-config';

export default mergeConfig(
  createVitestConfig({
    categories: ['unit', 'browser'],
    coverage: { thresholds: { statements: 100, branches: 98, functions: 100, lines: 100 } },
  }),
  {
    // hydration tests must not trigger a dependency-optimizer reload during browser collection.
    optimizeDeps: {
      include: [
        'react-dom/client',
        'react-dom/server',
        '@base-ui/react/checkbox',
        '@base-ui/react/menu',
        '@base-ui/react/progress',
        '@base-ui/react/radio',
        '@base-ui/react/radio-group',
        '@base-ui/react/select',
        '@base-ui/react/separator',
        '@base-ui/react/switch',
        '@base-ui/react/tabs',
        '@base-ui/react/tooltip',
      ],
    },
  },
);
