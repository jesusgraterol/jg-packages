import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({
  categories: ['unit'],
  fullOnlyFiles: [
    'src/find-undocumented-symbols.test-unit.ts',
    'src/presentation.test-unit.ts',
    'src/render-api-markdown.test-unit.ts',
  ],
});
