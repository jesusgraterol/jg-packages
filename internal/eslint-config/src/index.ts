import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import type { Linter } from 'eslint';

// options accepted by createEslintConfig
export type IEslintConfigOptions = {
  // absolute path of the package whose tsconfig.json drives type-aware rules
  rootDirectory: string;
};

// generated, installed, and test-report directories that are never linted
const IGNORED_PATHS = [
  '.astro/**',
  '.turbo/**',
  'coverage/**',
  'dist/**',
  'node_modules/**',
  'playwright-report/**',
  'test-results/**',
];

/**
 * Creates a package's ESLint flat configuration: the recommended JavaScript rules for its
 * configuration files, type-aware TypeScript rules for its sources and tests, and Prettier's
 * overrides last, so formatting is left to Prettier.
 * @param options The package directory whose `tsconfig.json` type-aware rules use.
 * @returns The flat configuration array.
 * @example
 * export default createEslintConfig({ rootDirectory: import.meta.dirname });
 */
export const createEslintConfig = ({ rootDirectory }: IEslintConfigOptions): Linter.Config[] =>
  defineConfig([
    globalIgnores(IGNORED_PATHS),
    {
      files: ['**/*.{js,mjs}'],
      extends: [js.configs.recommended],
      languageOptions: {
        globals: globals.node,
        sourceType: 'module',
      },
    },
    {
      files: ['**/*.ts'],
      extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir: rootDirectory,
        },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        // TypeScript already reports undefined identifiers, with the right globals per runtime
        'no-undef': 'off',
      },
    },
    eslintConfigPrettier,
  ]);
