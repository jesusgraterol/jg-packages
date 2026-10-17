import { playwright } from '@vitest/browser-playwright';
import {
  defineConfig,
  type TestProjectInlineConfiguration,
  type ViteUserConfig,
} from 'vitest/config';

// test categories a package can run, each discovered by its own file suffix
export type ITestCategory = 'unit' | 'integration' | 'bench' | 'browser';

// environments the Node.js categories run in; the browser category runs in real browsers
export type ITestEnvironment = 'node' | 'jsdom';

// the least share of the code, in percent, the unit and integration tests must cover
export type ICoverageThresholds = {
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
};

// options accepted by createVitestConfig
export type IVitestConfigOptions = {
  categories: ITestCategory[];
  environment?: ITestEnvironment;

  // the coverage `vitest run --coverage` must reach. Without thresholds, it only reports
  coverage?: { thresholds?: ICoverageThresholds };
};

// file suffix that identifies each category's test files
const CATEGORY_FILE_PATTERNS: Record<ITestCategory, string> = {
  unit: 'src/**/*.test-unit.ts',
  integration: 'src/**/*.test-integration.ts',
  bench: 'src/**/*.test-bench.ts',
  browser: 'src/**/*.test-browser.ts',
};

// how long a test or hook may run before it fails: long enough that a CI runner several times
// slower than a laptop never fails a working test, short enough to catch one that hangs
const TEST_TIMEOUT_MS = 30_000;

// the browsers the browser category runs every test in, headless
export const BROWSER_INSTANCES = ['chromium', 'firefox', 'webkit'] as const;

// the files coverage measures: the source, without tests, test utilities, fixtures, or declarations
const COVERAGE_INCLUDE = ['src/**/*.ts'];
const COVERAGE_EXCLUDE = [
  'src/**/*.test-*.ts',
  'src/**/test-utils/**',
  'src/**/fixtures/**',
  'src/**/*.d.ts',
];

/**
 * Builds a project for one test category, so `--project <category>` runs only its files and
 * stubbed environment variables and globals are restored after every test.
 * @param category The category the project runs.
 * @param environment The environment its tests run in, for every category but browser.
 * @returns The inline project configuration.
 */
const buildProject = (
  category: ITestCategory,
  environment: ITestEnvironment,
): TestProjectInlineConfiguration => {
  const pattern = CATEGORY_FILE_PATTERNS[category];
  const shared = {
    name: category,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: TEST_TIMEOUT_MS,
    hookTimeout: TEST_TIMEOUT_MS,
  };
  if (category === 'browser') {
    return {
      test: {
        ...shared,
        include: [pattern],
        browser: {
          enabled: true,
          headless: true,
          provider: playwright(),
          instances: BROWSER_INSTANCES.map((browser) => ({ browser })),
        },
      },
    };
  }
  return {
    test: {
      ...shared,
      environment,
      ...(category === 'bench'
        ? { include: [], benchmark: { include: [pattern] } }
        : { include: [pattern] }),
    },
  };
};

/**
 * Creates a package's Vitest configuration with one project per test category it has, named after
 * the category, so `vitest run --project unit` runs exactly that category. Benchmarks live in a
 * `bench` project that runs no regular tests, and `vitest bench --run` runs them. The `browser`
 * project runs its tests in headless Chromium, Firefox, and WebKit. Tests and hooks fail after 30
 * seconds unless they set their own timeout. `vitest run --coverage`
 * measures the source with V8 and prints a summary, failing below the thresholds when there are
 * any.
 * @param options The categories the package has, the environment its tests run in, and its
 * coverage thresholds.
 * @returns The Vitest configuration.
 * @example
 * export default createVitestConfig({ categories: ['unit', 'integration'] });
 * @example
 * export default createVitestConfig({
 *   categories: ['unit', 'browser'],
 *   coverage: { thresholds: { lines: 95, branches: 90 } },
 * });
 * @throws
 * - createVitestConfig needs at least one test category.
 * - createVitestConfig received a duplicated test category: {categories}.
 */
export const createVitestConfig = ({
  categories,
  environment = 'node',
  coverage = {},
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
      coverage: {
        provider: 'v8',
        include: COVERAGE_INCLUDE,
        exclude: COVERAGE_EXCLUDE,
        reporter: ['text-summary'],
        ...(coverage.thresholds === undefined ? {} : { thresholds: coverage.thresholds }),
      },
    },
  });
};
