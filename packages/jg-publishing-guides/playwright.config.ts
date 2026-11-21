import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'src',
  testMatch: '**/*.test-e2e.ts',
  testIgnore: ['**/_archive/**', '**/_archives/**', '**/_backup/**', '**/_backups/**'],
  forbidOnly: process.env['CI'] !== undefined,
  retries: 0,
  reporter: 'list',
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
