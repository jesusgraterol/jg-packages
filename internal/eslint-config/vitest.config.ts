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
        },
      },
    ],
  },
});
