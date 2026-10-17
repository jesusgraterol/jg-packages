import { defineConfig } from 'vitest/config';

/*
 * This package can't use @jg-packages/vitest-config, which is linted with this package's
 * configuration, without a dependency cycle, so it declares its one project directly.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'integration',
          environment: 'node',
          unstubEnvs: true,
          unstubGlobals: true,
          include: ['src/**/*.test-integration.ts'],
          // type-aware linting builds a TypeScript program, which takes several seconds on a busy
          // machine
          testTimeout: 30_000,
        },
      },
    ],
    // the same coverage settings as @jg-packages/vitest-config
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
