import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'gallery/src',
  testMatch: '**/*.test-e2e.ts',
  testIgnore: ['**/_archive/**', '**/_archives/**', '**/_backup/**', '**/_backups/**'],
  forbidOnly: process.env['CI'] !== undefined,
  fullyParallel: true,
  retries: 0,
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
  ],
  webServer: {
    command: 'node gallery/preview.ts',
    url: 'http://127.0.0.1:4332/',
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
