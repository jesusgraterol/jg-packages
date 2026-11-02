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
      // found only once a test renders them, which reloads the run partway through on a cold cache
      '@base-ui/react/merge-props',
      '@base-ui/react/use-render',
      'idb-keyval',
      'react-markdown',
      'remark-gfm',
      'sonner',
      'zustand',
      'zustand/vanilla',
      '@codemirror/language',
      '@codemirror/view',
      '@lezer/highlight',
      '@milkdown/crepe',
      '@milkdown/kit/core',
      '@milkdown/kit/plugin/upload',
      '@milkdown/kit/preset/commonmark',
      '@milkdown/kit/preset/gfm',
      '@milkdown/kit/prose/model',
      '@milkdown/kit/prose/state',
      '@milkdown/kit/prose/view',
      '@milkdown/kit/utils',
      '@milkdown/react',
      '@testing-library/react',
      'react/jsx-runtime',
      'react-syntax-highlighter',
      'react-syntax-highlighter/dist/esm/styles/prism/index.js',
      'react-syntax-highlighter/dist/esm/languages/prism/bash.js',
      'react-syntax-highlighter/dist/esm/languages/prism/css.js',
      'react-syntax-highlighter/dist/esm/languages/prism/diff.js',
      'react-syntax-highlighter/dist/esm/languages/prism/docker.js',
      'react-syntax-highlighter/dist/esm/languages/prism/graphql.js',
      'react-syntax-highlighter/dist/esm/languages/prism/ini.js',
      'react-syntax-highlighter/dist/esm/languages/prism/javascript.js',
      'react-syntax-highlighter/dist/esm/languages/prism/json5.js',
      'react-syntax-highlighter/dist/esm/languages/prism/json.js',
      'react-syntax-highlighter/dist/esm/languages/prism/jsx.js',
      'react-syntax-highlighter/dist/esm/languages/prism/markdown.js',
      'react-syntax-highlighter/dist/esm/languages/prism/markup.js',
      'react-syntax-highlighter/dist/esm/languages/prism/python.js',
      'react-syntax-highlighter/dist/esm/languages/prism/scss.js',
      'react-syntax-highlighter/dist/esm/languages/prism/sql.js',
      'react-syntax-highlighter/dist/esm/languages/prism/toml.js',
      'react-syntax-highlighter/dist/esm/languages/prism/tsx.js',
      'react-syntax-highlighter/dist/esm/languages/prism/typescript.js',
      'react-syntax-highlighter/dist/esm/languages/prism/yaml.js',
    ],
  },
});
