import { defineConfig, devices } from '@playwright/test';

import { readTestSuite } from '@jg-packages/vitest-config/test-suite';

const suite = readTestSuite();

// the browsers the end-to-end tests run in; the essential suite keeps only Chromium
const PROJECTS = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];

// the end-to-end tests, which run the runtime and a generated worker in Chromium, Firefox, and
// WebKit
export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.test-e2e.ts',
  testIgnore: ['**/_archive/**', '**/_archives/**', '**/_backup/**', '**/_backups/**'],
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: 'list',
  projects:
    suite === 'essential' ? PROJECTS.filter((project) => project.name === 'chromium') : PROJECTS,
});
