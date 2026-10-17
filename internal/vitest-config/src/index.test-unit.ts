import { describe, expect, test } from 'vitest';

import { createVitestConfig } from './index.ts';

describe('createVitestConfig', () => {
  test('creates one isolated project per category, named after it', () => {
    expect(createVitestConfig({ categories: ['unit', 'integration'] })).toStrictEqual({
      test: {
        projects: [
          {
            test: {
              name: 'unit',
              environment: 'node',
              unstubEnvs: true,
              unstubGlobals: true,
              testTimeout: 30_000,
              hookTimeout: 30_000,
              include: ['src/**/*.test-unit.ts'],
            },
          },
          {
            test: {
              name: 'integration',
              environment: 'node',
              unstubEnvs: true,
              unstubGlobals: true,
              testTimeout: 30_000,
              hookTimeout: 30_000,
              include: ['src/**/*.test-integration.ts'],
            },
          },
        ],
        coverage: {
          provider: 'v8',
          include: ['src/**/*.ts'],
          exclude: [
            'src/**/*.test-*.ts',
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
          environment: 'node',
          unstubEnvs: true,
          unstubGlobals: true,
          testTimeout: 30_000,
          hookTimeout: 30_000,
          include: [],
          benchmark: { include: ['src/**/*.test-bench.ts'] },
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
        unstubEnvs: true,
        unstubGlobals: true,
        testTimeout: 30_000,
        hookTimeout: 30_000,
        include: ['src/**/*.test-browser.ts'],
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

  test.each([
    [[], 'needs at least one test category'],
    [['unit', 'unit'], 'duplicated test category'],
  ] as const)('createVitestConfig(%o) -> throws', (categories, message) => {
    expect(() => createVitestConfig({ categories: [...categories] })).toThrow(message);
  });
});
