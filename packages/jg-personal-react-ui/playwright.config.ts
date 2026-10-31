import { defineConfig, devices } from '@playwright/test';

const consumerRoot = process.env['JG_REACT_UI_GALLERY_ROOT'];
const requestedSuite = process.env['JG_TEST_SUITE'];
if (requestedSuite !== undefined && requestedSuite !== 'essential' && requestedSuite !== 'full') {
  throw new Error('JG_TEST_SUITE must be "essential" or "full" when set.');
}

// installed consumers qualify every case and engine, including under inherited essential mode.
const isEssential = consumerRoot === undefined && requestedSuite === 'essential';
const PROJECTS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  {
    name: 'firefox',
    use: {
      ...devices['Desktop Firefox'],
      launchOptions: {
        firefoxUserPrefs: {
          'media.navigator.streams.fake': true,
          'media.navigator.permission.disabled': true,
        },
      },
    },
  },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];
export default defineConfig({
  testDir: consumerRoot ?? '.',
  testMatch: '**/*.test-e2e.{ts,tsx}',
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/_archive/**',
    '**/_archives/**',
    '**/_backup/**',
    '**/_backups/**',
    ...(isEssential
      ? [
          '**/src/index.test-e2e.ts',
          '**/src/components/theme-provider/index.test-e2e.ts',
          '**/gallery.component.test-e2e.tsx',
          '**/controls-demo/controls-demo.component.test-e2e.tsx',
          '**/diff-demo/diff-demo.component.test-e2e.tsx',
          '**/editor-demo/editor-demo.component.test-e2e.tsx',
          '**/markdown-demo/markdown-demo.component.test-e2e.tsx',
          '**/overlay-demo/overlay-demo.component.test-e2e.tsx',
          '**/preferences-demo/preferences-demo.component.test-e2e.tsx',
          '**/remote-preferences/remote-preferences.component.test-e2e.tsx',
        ]
      : []),
  ],
  forbidOnly: process.env['CI'] !== undefined,
  fullyParallel: true,
  retries: 0,
  ...(isEssential ? { grepInvert: /@full/ } : {}),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4178',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: isEssential ? PROJECTS.filter((project) => project.name === 'chromium') : PROJECTS,
  webServer: {
    command: consumerRoot === undefined ? 'node gallery/preview.ts' : 'node preview.ts',
    url: 'http://127.0.0.1:4178/',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
