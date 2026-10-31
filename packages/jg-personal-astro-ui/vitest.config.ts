import { createVitestConfig } from '@jg-packages/vitest-config';

const config = createVitestConfig({
  categories: ['unit', 'integration', 'browser'],
  // the coverage measured after the gap pass, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});

// this private CLI lives outside the published src tree; keep the override local
for (const project of config.test?.projects ?? []) {
  if (typeof project === 'object' && 'test' in project && project.test !== undefined) {
    project.test.exclude = [
      '**/_archive/**',
      '**/_archives/**',
      '**/_backup/**',
      '**/_backups/**',
      '**/node_modules/**',
      '**/dist/**',
    ];
  }
  if (typeof project === 'object' && 'test' in project && project.test?.name === 'integration') {
    project.test.include = ['gallery/**/*.test-integration.ts', 'scripts/**/*.test-integration.ts'];
  }
  if (typeof project === 'object' && 'test' in project && project.test?.name === 'unit') {
    project.test.include = [...(project.test.include ?? []), 'scripts/**/*.test-unit.ts'];
  }
}

export default config;
