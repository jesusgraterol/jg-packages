import { defineConfig, devices } from '@playwright/test';

// the end-to-end tests, which run the runtime and a generated worker in Chromium, Firefox, and
// WebKit
export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.test-e2e.ts',
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
