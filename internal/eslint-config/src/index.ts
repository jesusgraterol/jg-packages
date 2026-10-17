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

  // globs of classic service worker scripts, such as worker templates, linted with the service
  // worker globals instead of Node.js's
  serviceWorkerFiles?: string[];
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
 * configuration files and service worker scripts, type-aware TypeScript rules for its sources and
 * tests, and Prettier's overrides last, so formatting is left to Prettier.
 * @param options The package directory whose `tsconfig.json` type-aware rules use, and the globs
 * of its service worker scripts.
 * @returns The flat configuration array.
 * @example
 * export default createEslintConfig({ rootDirectory: import.meta.dirname });
 * @example
 * export default createEslintConfig({
 *   rootDirectory: import.meta.dirname,
 *   serviceWorkerFiles: ['src/build/templates/*.sw.js'],
 * });
 */
export const createEslintConfig = ({
  rootDirectory,
  serviceWorkerFiles = [],
}: IEslintConfigOptions): Linter.Config[] =>
  defineConfig([
    globalIgnores(IGNORED_PATHS),
    {
      files: ['**/*.{js,mjs}'],
      ignores: serviceWorkerFiles,
      extends: [js.configs.recommended],
      languageOptions: {
        globals: globals.node,
        sourceType: 'module',
      },
    },
    ...(serviceWorkerFiles.length === 0
      ? []
      : [
          {
            // service workers load these as classic scripts, so they have no imports
            files: serviceWorkerFiles,
            extends: [js.configs.recommended],
            languageOptions: {
              globals: globals.serviceworker,
              sourceType: 'script' as const,
            },
          },
        ]),
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
