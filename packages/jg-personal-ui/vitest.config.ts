import { createVitestConfig } from '@jg-packages/vitest-config';

const config = createVitestConfig({
  categories: ['unit'],
  fullOnlyFiles: [
    'src/tokens/constants.test-unit.ts',
    'scripts/brand-assets/utilities.test-unit.ts',
  ],
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});

for (const project of config.test?.projects ?? []) {
  if (typeof project === 'object' && 'test' in project && project.test?.name === 'unit') {
    project.test.include = ['src/**/*.test-unit.ts', 'scripts/**/*.test-unit.ts'];
    project.test.exclude = [
      ...(project.test.exclude ?? []),
      '**/_archive/**',
      '**/_archives/**',
      '**/_backup/**',
      '**/_backups/**',
      '**/node_modules/**',
      '**/dist/**',
    ];
  }
}
export default config;
