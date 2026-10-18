import { defineConfig, devices } from '@playwright/test';

// where the suite's own preview server listens, apart from the dev server's 4321
const PORT = 4330;

// the end-to-end suite, which runs the built site in Chromium, served by astro preview. `build`
// writes the site, with its search index, before the suite runs
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.test-e2e.ts',
  forbidOnly: process.env['CI'] !== undefined,
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${String(PORT)}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // in the foreground, apart from any background preview the developer started
    command: `astro preview --host 127.0.0.1 --port ${String(PORT)} --ignore-lock`,
    url: `http://127.0.0.1:${String(PORT)}/`,
    reuseExistingServer: false,
  },
});
