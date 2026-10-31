import { createVitestConfig } from '@jg-packages/vitest-config';

const config = createVitestConfig({
  categories: ['unit', 'integration', 'browser'],
  essentialBrowser: 'chromium',
  fullOnlyFiles: [
    'scripts/foundation/utilities.test-unit.ts',
    'src/code-window-plugin/code-window-plugin.test-unit.ts',
    'src/components/badge/badge-classes.test-unit.ts',
    'src/components/brand-logo/brand-logo-classes.test-unit.ts',
    'src/components/breadcrumb/breadcrumb-classes.test-unit.ts',
    'src/components/button/button-classes.test-unit.ts',
    'src/components/document-head/head-meta.test-unit.ts',
    'src/components/document-head/page-transitions.test-unit.ts',
    'src/components/document-head/speculation-rules.test-unit.ts',
    'src/components/icon-tile/icon-tile-classes.test-unit.ts',
    'src/components/jg-mark/jg-mark.test-unit.ts',
    'src/components/navigation-progress/navigation-progress-behavior.test-unit.ts',
    'src/components/page-header/page-header-classes.test-unit.ts',
    'src/components/section/section-classes.test-unit.ts',
    'src/components/site-header/navigation-items.test-unit.ts',
    'src/components/site-header/section-tracking-behavior.test-unit.ts',
    'src/components/table/table-classes.test-unit.ts',
    'src/components/theme-init-script/constants.test-unit.ts',
    'src/styles/tokens.test-unit.ts',
    'src/components/site-header/section-tracking.test-browser.ts',
  ],
  // the coverage measured after the gap pass, rounded down; raise them as tests improve
  coverage: { thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 } },
});

// this private CLI lives outside the published src tree; keep the override local
for (const project of config.test?.projects ?? []) {
  if (typeof project === 'object' && 'test' in project && project.test !== undefined) {
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
  if (typeof project === 'object' && 'test' in project && project.test?.name === 'integration') {
    project.test.include = ['gallery/**/*.test-integration.ts', 'scripts/**/*.test-integration.ts'];
  }
  if (typeof project === 'object' && 'test' in project && project.test?.name === 'unit') {
    project.test.include = [...(project.test.include ?? []), 'scripts/**/*.test-unit.ts'];
  }
}

export default config;
