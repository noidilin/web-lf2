import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: /deployed.*smoke\.spec\.mjs$/,
  timeout: 30_000,
  retries: 2,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://dev.lf2.noidilin.dev',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'tests/results',
});
