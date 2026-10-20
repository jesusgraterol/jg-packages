import { defineConfig, devices } from '@playwright/test';

import { readTestSuite } from '@jg-packages/vitest-config/test-suite';

// the browsers the end-to-end tests run in; the essential suite keeps only Chromium
const PROJECTS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];

// the end-to-end tests, which run each helper against local pages in Chromium, Firefox, and WebKit
export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.test-e2e.ts',
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: 'list',
  projects:
    readTestSuite() === 'essential'
      ? PROJECTS.filter((project) => project.name === 'chromium')
      : PROJECTS,
});
