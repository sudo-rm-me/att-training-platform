import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

/**
 * End-to-end tests run against a dedicated dev server (own build cache and a
 * fresh PGlite database), so they can run alongside `npm run dev`.
 * Locally they use the installed Microsoft Edge; CI uses Playwright's Chromium.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    channel: process.env.CI ? undefined : "msedge",
  },
  webServer: {
    command: `node -e "require('fs').rmSync('.data/e2e',{recursive:true,force:true})" && npx next dev -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: "pglite:./.data/e2e",
      AUTH_SECRET: "e2e-only-secret-not-for-production",
      AUTH_DEV_LOGIN: "true",
      AUTH_URL: baseURL,
      INITIAL_ADMIN_EMAILS: "admin@e2e.test",
      APP_TIMEZONE: "Europe/London",
    },
  },
});
