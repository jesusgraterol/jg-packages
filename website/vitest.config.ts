import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit', 'integration'],
  fullOnlyFiles: [
    'src/utilities/package-docs/package-docs.test-unit.ts',
    'src/utilities/markdown-pages/markdown-pages.test-unit.ts',
    'src/utilities/home-content/home-content.test-unit.ts',
  ],
});
