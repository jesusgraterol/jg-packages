import {
  defineConfig,
  type TestProjectInlineConfiguration,
  type ViteUserConfig,
} from 'vitest/config';

// test categories a package can run, each discovered by its own file suffix
export type ITestCategory = 'unit' | 'integration' | 'bench';

// environments a category runs in; browser behavior that needs a real browser belongs to Playwright
export type ITestEnvironment = 'node' | 'jsdom';

// options accepted by createVitestConfig
export type IVitestConfigOptions = {
  categories: ITestCategory[];
  environment?: ITestEnvironment;
};

// file suffix that identifies each category's test files
const CATEGORY_FILE_PATTERNS: Record<ITestCategory, string> = {
  unit: 'src/**/*.test-unit.ts',
  integration: 'src/**/*.test-integration.ts',
  bench: 'src/**/*.test-bench.ts',
};

/**
 * Builds a project for one test category, so `--project <category>` runs only its files and
 * stubbed environment variables and globals are restored after every test.
 * @param category The category the project runs.
 * @param environment The environment its tests run in.
 * @returns The inline project configuration.
 */
const buildProject = (
  category: ITestCategory,
  environment: ITestEnvironment,
): TestProjectInlineConfiguration => {
  const pattern = CATEGORY_FILE_PATTERNS[category];
  return {
    test: {
      name: category,
      environment,
      unstubEnvs: true,
      unstubGlobals: true,
      ...(category === 'bench'
        ? { include: [], benchmark: { include: [pattern] } }
        : { include: [pattern] }),
    },
  };
};

/**
 * Creates a package's Vitest configuration with one project per test category it has, named after
 * the category, so `vitest run --project unit` or `vitest bench --run --project bench` runs exactly
 * that category.
 * @param options The categories the package has and the environment its tests run in.
 * @returns The Vitest configuration.
 * @example
 * export default createVitestConfig({ categories: ['unit', 'integration'] });
 * @throws
 * - createVitestConfig needs at least one test category.
 * - createVitestConfig received a duplicated test category: {categories}.
 */
export const createVitestConfig = ({
  categories,
  environment = 'node',
}: IVitestConfigOptions): ViteUserConfig => {
  if (categories.length === 0) {
    throw new Error('createVitestConfig needs at least one test category.');
  }
  if (new Set(categories).size !== categories.length) {
    throw new Error(
      `createVitestConfig received a duplicated test category: ${categories.join(', ')}.`,
    );
  }
  return defineConfig({
    test: {
      projects: categories.map((category) => buildProject(category, environment)),
    },
  });
};
