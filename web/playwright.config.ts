import { defineConfig, devices } from '@playwright/test'

// End-to-end tests. Run with `npm run e2e` (starts the dev server automatically).
// Browsers: `npx playwright install chromium` once (cached afterwards).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        // A short height like an iPhone with the Safari toolbars showing — the
        // layout must still fit (options on-screen, no scroll).
        viewport: { width: 390, height: 680 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
})
