import { playwright } from '@vitest/browser-playwright';
import {
  configDefaults,
  defineConfig,
  type TestProjectInlineConfiguration,
  type ViteUserConfig,
} from 'vitest/config';

// imported by the package's own name, which works both when Node.js runs this file directly and
// when a package's typecheck reaches it, unlike a relative './test-suite.ts'
import {
  FULL_TEST_TAG,
  type ITestSuite,
  readTestSuite,
} from '@jg-packages/vitest-config/test-suite';

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

  // a file the integration project runs once before its tests and tears down after them, such as
  // one that starts a database container and provides its connection details
  globalSetup?: string;

  // secondary files omitted before imports/setup only when the essential suite is selected
  fullOnlyFiles?: string[];
};

// file suffix that identifies each category's test files; a test of a `.tsx` file is `.tsx` too
const CATEGORY_FILE_PATTERNS: Record<ITestCategory, string> = {
  unit: 'src/**/*.test-unit.{ts,tsx}',
  integration: 'src/**/*.test-integration.{ts,tsx}',
  bench: 'src/**/*.test-bench.{ts,tsx}',
  browser: 'src/**/*.test-browser.{ts,tsx}',
};

// how long a test or hook may run before it fails: long enough that a CI runner several times
// slower than a laptop never fails a working test, short enough to catch one that hangs
const TEST_TIMEOUT_MS = 30_000;

// repository context exclusions also apply to native test discovery
const TEST_EXCLUDE = [
  ...configDefaults.exclude,
  '**/_archive/**',
  '**/_archives/**',
  '**/_backup/**',
  '**/_backups/**',
];

// the browsers the browser category runs every test in, headless
export const BROWSER_INSTANCES = ['chromium', 'firefox', 'webkit'] as const;

// the files coverage measures: the source, without tests, test utilities, fixtures, or declarations
const COVERAGE_INCLUDE = ['src/**/*.{ts,tsx}'];
const COVERAGE_EXCLUDE = [
  'src/**/*.test-*.{ts,tsx}',
  'src/**/test-utils/**',
  'src/**/fixtures/**',
  'src/**/*.d.ts',
];

/**
 * Builds a project for one test category, so `--project <category>` runs only its files and
 * stubbed environment variables and globals are restored after every test.
 * @param category The category the project runs.
 * @param environment The environment its tests run in, for every category but browser.
 * @param globalSetup The file the integration project runs once around its tests, if any.
 * @param suite The suite the run selected, which decides whether tests tagged `full` are skipped.
 * @param fullOnlyFiles Secondary file patterns excluded before imports in essential.
 * @returns The inline project configuration.
 */
const buildProject = (
  category: ITestCategory,
  environment: ITestEnvironment,
  globalSetup: string | undefined,
  suite: ITestSuite,
  fullOnlyFiles: string[],
): TestProjectInlineConfiguration => {
  const pattern = CATEGORY_FILE_PATTERNS[category];
  const shared = {
    name: category,
    exclude: [...TEST_EXCLUDE, ...(suite === 'essential' ? fullOnlyFiles : [])],
    fsModuleCache: false,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: TEST_TIMEOUT_MS,
    hookTimeout: TEST_TIMEOUT_MS,
    tags: [
      {
        name: FULL_TEST_TAG,
        description: 'Secondary coverage outside the essential guarantees.',
        skip: suite === 'essential',
      },
    ],
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
      ...(category === 'integration' && globalSetup !== undefined ? { globalSetup } : {}),
    },
  };
};

/**
 * Creates a package's Vitest configuration with one project per test category it has, named after
 * the category, so `vitest run --project unit` runs exactly that category. Benchmarks live in a
 * `bench` project that runs no regular tests, and `vitest bench --run` runs them. The `browser`
 * project runs its tests in headless Chromium, Firefox, and WebKit. Tests and hooks fail after 30
 * seconds unless they set their own timeout, and no run uses Vitest's file module cache. `vitest run --coverage`
 * measures the source with V8 and prints a summary, failing below the thresholds when there are
 * any. A `globalSetup` file runs once around the integration project, such as to start a database
 * container for it, and the other projects never run it.
 *
 * Every project defines the `full` tag for useful secondary coverage. Those cases run
 * unless JG_TEST_SUITE selects essential. Wholly secondary files are excluded before imports;
 * empty projects do not run global setup, and unexpectedly empty required selections fail.
 * @param options The categories the package has, the environment its tests run in, its coverage
 * thresholds, the integration project's global setup, and wholly secondary file patterns.
 * @returns The Vitest configuration.
 * @example
 * export default createVitestConfig({ categories: ['unit', 'integration'] });
 * @example
 * export default createVitestConfig({
 *   categories: ['unit', 'browser'],
 *   coverage: { thresholds: { lines: 95, branches: 90 } },
 * });
 * @example
 * export default createVitestConfig({
 *   categories: ['unit', 'integration'],
 *   globalSetup: './src/test-utils/postgres.global-setup.ts',
 * });
 * @throws
 * - createVitestConfig needs at least one test category.
 * - createVitestConfig received a duplicated test category: {categories}.
 * - JG_TEST_SUITE must be "essential" or "full" when set.
 */
export const createVitestConfig = ({
  categories,
  environment = 'node',
  coverage = {},
  globalSetup,
  fullOnlyFiles = [],
}: IVitestConfigOptions): ViteUserConfig => {
  if (categories.length === 0) {
    throw new Error('createVitestConfig needs at least one test category.');
  }
  if (new Set(categories).size !== categories.length) {
    throw new Error(
      `createVitestConfig received a duplicated test category: ${categories.join(', ')}.`,
    );
  }
  const suite = readTestSuite();
  return defineConfig({
    test: {
      /*
       * Vitest's file module cache is one directory in the workspace's node_modules. A lockfile
       * change makes every run clear it, and runs turbo starts together then race, failing with
       * ENOTEMPTY. It saved no measurable time here, so neither the root nor any project uses it.
       */
      fsModuleCache: false,
      projects: categories.map((category) =>
        buildProject(category, environment, globalSetup, suite, fullOnlyFiles),
      ),
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
