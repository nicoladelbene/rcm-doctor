import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, viewport: { width: 1280, height: 800 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npm run build && PORT=${PORT} npm run start`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 180_000 },
});
