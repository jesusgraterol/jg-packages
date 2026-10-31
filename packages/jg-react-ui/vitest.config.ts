import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';

import { createVitestConfig } from '@jg-packages/vitest-config';

const shared = createVitestConfig({
  categories: ['unit', 'integration', 'browser'],
  essentialBrowser: 'chromium',
  fullOnlyFiles: [
    'src/components/alert-dialog/alert-dialog.component.test-unit.tsx',
    'src/components/alert/alert.component.test-unit.tsx',
    'src/components/badge/badge.component.test-unit.tsx',
    'src/components/badge/badge.component.test-browser.tsx',
    'src/components/button/button.component.test-unit.tsx',
    'src/components/divider/divider.component.test-unit.tsx',
    'src/components/drawer/drawer.component.test-unit.tsx',
    'src/components/dropdown-menu/dropdown-menu.component.test-unit.tsx',
    'src/components/empty-state/empty-state.component.test-unit.tsx',
    'src/components/form/form.component.test-unit.tsx',
    'src/components/icon-tile/icon-tile.component.test-browser.tsx',
    'src/components/inline-code/inline-code.component.test-unit.tsx',
    'src/components/inline-code/utilities.test-unit.ts',
    'src/components/layout/layout.component.test-browser.tsx',
    'src/components/spinner/spinner.component.test-unit.tsx',
    'src/components/tooltip/tooltip.component.test-unit.tsx',
    'src/components/tooltip/tooltip.component.test-browser.tsx',
    'src/components/typography/code-highlighting.test-unit.ts',
    'src/components/typography/typography.component.test-unit.tsx',
    'src/components/toastr/utilities.test-unit.ts',
    'src/components/theme-provider/utilities.test-unit.ts',
    'src/shared/syntax-highlighting/utilities.test-unit.ts',
    'src/shared/syntax-highlighting/utilities.test-browser.ts',
  ],
  coverage: { thresholds: { statements: 100, branches: 98, functions: 100, lines: 100 } },
});

// the Node-only build tests retain the shared integration project's isolation and selection rules.
for (const project of shared.test?.projects ?? []) {
  if (typeof project === 'object' && 'test' in project && project.test?.name === 'integration') {
    project.test.include = [...(project.test.include ?? []), 'build/**/*.test-integration.ts'];
  }
}

export default mergeConfig(shared, {
  resolve: {
    alias: [
      {
        find: /^(?:\.\.\/)+vendor\/diff-viewer\.js$/,
        replacement: fileURLToPath(new URL('./dist/vendor/diff-viewer.js', import.meta.url)),
      },
    ],
  },
  // hydration tests must not trigger a dependency-optimizer reload during browser collection.
  optimizeDeps: {
    include: [
      'react-dom/client',
      'react-dom/server',
      '@base-ui/react/checkbox',
      '@base-ui/react/alert-dialog',
      '@base-ui/react/dialog',
      '@base-ui/react/drawer',
      '@base-ui/react/menu',
      '@base-ui/react/progress',
      '@base-ui/react/radio',
      '@base-ui/react/radio-group',
      '@base-ui/react/select',
      '@base-ui/react/separator',
      '@base-ui/react/switch',
      '@base-ui/react/tabs',
      '@base-ui/react/tooltip',
      'react-router',
      '@testing-library/dom',
      '@tanstack/react-query',
      '@tanstack/react-query-persist-client',
      '@hookform/resolvers/zod',
      'react-hook-form',
      '@milkdown/kit/plugin/listener',
      '@milkdown/kit/plugin/history',
    ],
  },
});
