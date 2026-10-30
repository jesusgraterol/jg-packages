import { defineConfig, devices } from '@playwright/test';

const consumerRoot = process.env['JG_REACT_UI_GALLERY_ROOT'];
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
  ],
  forbidOnly: process.env['CI'] !== undefined,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4178',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: consumerRoot === undefined ? 'node gallery/preview.ts' : 'node preview.ts',
    url: 'http://127.0.0.1:4178/',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
