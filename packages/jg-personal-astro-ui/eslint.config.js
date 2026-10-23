import { globalIgnores } from 'eslint/config';

import { createEslintConfig } from '@jg-packages/eslint-config';

export default [
  globalIgnores([
    'gallery/.astro/**',
    'gallery/dist/**',
    '**/_archive/**',
    '**/_archives/**',
    '**/_backup/**',
    '**/_backups/**',
  ]),
  ...createEslintConfig({ rootDirectory: import.meta.dirname, isAstro: true }),
];
