import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createVitestConfig } from './index.ts';

// dependency and archive patterns retained by every project
const TEST_EXCLUDE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/_archive/**',
  '**/_archives/**',
  '**/_backup/**',
  '**/_backups/**',
];

// the tag every project defines, as the full suite configures it
const FULL_TAG = {
  name: 'full',
  description: 'Secondary coverage outside the essential guarantees.',
  skip: false,
};

describe('createVitestConfig', () => {
  // the run that executes these tests may itself select a suite, which they must not inherit
  beforeEach(() => {
    vi.stubEnv('JG_TEST_SUITE', undefined);
  });

  test('creates one isolated project per category, named after it, none caching modules on disk', () => {
    expect(createVitestConfig({ categories: ['unit', 'integration'] })).toStrictEqual({
      test: {
        fsModuleCache: false,
        projects: [
          {
            test: {
              name: 'unit',
              exclude: TEST_EXCLUDE,
              fsModuleCache: false,
              environment: 'node',
              unstubEnvs: true,
              unstubGlobals: true,
              testTimeout: 30_000,
              hookTimeout: 30_000,
              tags: [FULL_TAG],
              include: ['src/**/*.test-unit.{ts,tsx}'],
            },
          },
          {
            test: {
              name: 'integration',
              exclude: TEST_EXCLUDE,
              fsModuleCache: false,
              environment: 'node',
              unstubEnvs: true,
              unstubGlobals: true,
              testTimeout: 30_000,
              hookTimeout: 30_000,
              tags: [FULL_TAG],
              include: ['src/**/*.test-integration.{ts,tsx}'],
            },
          },
        ],
        coverage: {
          provider: 'v8',
          include: ['src/**/*.{ts,tsx}'],
          exclude: [
            'src/**/*.test-*.{ts,tsx}',
            'src/**/test-utils/**',
            'src/**/fixtures/**',
            'src/**/*.d.ts',
          ],
          reporter: ['text-summary'],
        },
      },
    });
  });

  test('keeps benchmarks out of test runs and discovers them only in bench mode', () => {
    expect(createVitestConfig({ categories: ['bench'] }).test?.projects).toStrictEqual([
      {
        test: {
          name: 'bench',
          exclude: TEST_EXCLUDE,
          fsModuleCache: false,
          environment: 'node',
          unstubEnvs: true,
          unstubGlobals: true,
          testTimeout: 30_000,
          hookTimeout: 30_000,
          tags: [FULL_TAG],
          include: [],
          benchmark: { include: ['src/**/*.test-bench.{ts,tsx}'] },
        },
      },
    ]);
  });

  test('applies the requested environment to every project', () => {
    const projects = createVitestConfig({
      categories: ['unit', 'integration'],
      environment: 'jsdom',
    }).test?.projects;
    expect(
      projects?.map(
        (project) => typeof project === 'object' && 'test' in project && project.test?.environment,
      ),
    ).toStrictEqual(['jsdom', 'jsdom']);
  });

  test('runs the browser category headless in Chromium, Firefox, and WebKit with Playwright', () => {
    const [project] = createVitestConfig({ categories: ['browser'] }).test?.projects ?? [];

    expect(project).toMatchObject({
      test: {
        name: 'browser',
        fsModuleCache: false,
        unstubEnvs: true,
        unstubGlobals: true,
        testTimeout: 30_000,
        hookTimeout: 30_000,
        include: ['src/**/*.test-browser.{ts,tsx}'],
        browser: {
          enabled: true,
          headless: true,
          provider: { name: 'playwright' },
          instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
        },
      },
    });
    expect(project).not.toHaveProperty('test.environment');
  });

  test('passes coverage thresholds through, and sets none by default', () => {
    const thresholds = { lines: 95, branches: 90, functions: 100, statements: 95 };

    expect(
      createVitestConfig({ categories: ['unit'], coverage: { thresholds } }).test?.coverage,
    ).toMatchObject({ provider: 'v8', thresholds });
    expect(createVitestConfig({ categories: ['unit'] }).test?.coverage).not.toHaveProperty(
      'thresholds',
    );
  });

  test('runs the global setup around the integration project only, and sets none by default', () => {
    const globalSetup = './src/test-utils/postgres.global-setup.ts';
    const projects = createVitestConfig({
      categories: ['unit', 'integration', 'browser'],
      globalSetup,
    }).test?.projects;
    const readGlobalSetup = (project: unknown): unknown =>
      (project as { test?: { globalSetup?: unknown } }).test?.globalSetup;

    expect(projects?.map(readGlobalSetup)).toStrictEqual([undefined, globalSetup, undefined]);
    expect(
      createVitestConfig({ categories: ['integration'] }).test?.projects?.map(readGlobalSetup),
    ).toStrictEqual([undefined]);
  });

  test('skips the tests tagged full in every project when JG_TEST_SUITE selects the essential suite', () => {
    vi.stubEnv('JG_TEST_SUITE', 'essential');
    const projects = createVitestConfig({ categories: ['unit', 'integration', 'browser'] }).test
      ?.projects;
    const readTags = (project: unknown): unknown =>
      (project as { test?: { tags?: unknown } }).test?.tags;

    expect(projects?.map(readTags)).toStrictEqual([
      [{ ...FULL_TAG, skip: true }],
      [{ ...FULL_TAG, skip: true }],
      [{ ...FULL_TAG, skip: true }],
    ]);
  });

  test('rejects a JG_TEST_SUITE that names no suite', () => {
    vi.stubEnv('JG_TEST_SUITE', 'quick');

    expect(() => createVitestConfig({ categories: ['unit'] })).toThrow(
      'JG_TEST_SUITE must be "essential" or "full" when set.',
    );
  });

  test.each([
    [[], 'needs at least one test category'],
    [['unit', 'unit'], 'duplicated test category'],
  ] as const)('createVitestConfig(%o) -> throws', (categories, message) => {
    expect(() => createVitestConfig({ categories: [...categories] })).toThrow(message);
  });
});
