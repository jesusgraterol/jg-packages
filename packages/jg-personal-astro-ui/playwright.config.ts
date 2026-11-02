import { defineConfig, devices } from '@playwright/test';

// the release fixture copies this runner with the gallery into an installed consumer
const consumerRoot = process.env['JG_UI_GALLERY_ROOT'];
const requestedSuite = process.env['JG_TEST_SUITE'];
if (requestedSuite !== undefined && requestedSuite !== 'essential' && requestedSuite !== 'full') {
  throw new Error('JG_TEST_SUITE must be "essential" or "full" when set.');
}

// installed consumers qualify all cases and engines, including under inherited essential mode.
const isEssential = consumerRoot === undefined && requestedSuite === 'essential';

export default defineConfig({
  testDir: consumerRoot ?? '.',
  testMatch: '**/*.test-e2e.ts',
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.astro/**',
    '**/_archive/**',
    '**/_archives/**',
    '**/_backup/**',
    '**/_backups/**',
    ...(isEssential
      ? [
          '**/src/components/code-diff/code-diff.test-e2e.ts',
          '**/src/components/conversation-message/conversation-message.test-e2e.ts',
          '**/src/components/conversation/conversation.test-e2e.ts',
          '**/src/components/copy-button/copy-button.test-e2e.ts',
          '**/src/components/document-head/document-head.test-e2e.ts',
          '**/src/components/documentation-outline/documentation-outline.test-e2e.ts',
          '**/src/components/documentation-shell/documentation-shell.test-e2e.ts',
          '**/src/components/file-preview/file-preview.test-e2e.ts',
          '**/src/components/file-tree/file-tree.test-e2e.ts',
          '**/src/components/jg-mark/jg-mark.test-e2e.ts',
          '**/src/components/page-header/page-header.test-e2e.ts',
          '**/src/components/page-navigation/page-navigation.test-e2e.ts',
          '**/src/components/result-summary/result-summary.test-e2e.ts',
          '**/src/components/section/section.test-e2e.ts',
          '**/src/components/step/step.test-e2e.ts',
          '**/src/components/steps/steps.test-e2e.ts',
          '**/src/components/timeline-item/timeline-item.test-e2e.ts',
          '**/src/components/timeline/timeline.test-e2e.ts',
        ]
      : []),
  ],
  forbidOnly: process.env['CI'] !== undefined,
  fullyParallel: true,
  retries: 0,
  ...(isEssential ? { grepInvert: /@full/ } : {}),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4332',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ].filter((project) => !isEssential || project.name === 'chromium'),
  webServer: {
    command: consumerRoot === undefined ? 'node gallery/preview.ts' : 'node preview.ts',
    url: 'http://127.0.0.1:4332/',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
