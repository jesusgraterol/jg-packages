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
              include: ['src/**/*.test-unit.ts'],
            },
          },
          {
            test: {
              name: 'integration',
              environment: 'node',
              unstubEnvs: true,
              unstubGlobals: true,
              include: ['src/**/*.test-integration.ts'],
            },
          },
        ],
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

  test.each([
    [[], 'needs at least one test category'],
    [['unit', 'unit'], 'duplicated test category'],
  ] as const)('createVitestConfig(%o) -> throws', (categories, message) => {
    expect(() => createVitestConfig({ categories: [...categories] })).toThrow(message);
  });
});
