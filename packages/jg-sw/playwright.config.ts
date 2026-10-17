import { defineConfig, devices } from '@playwright/test';

// the end-to-end tests, which run the runtime and a generated worker in Chromium
export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.test-e2e.ts',
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
