import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1"
      ? undefined
      : {
          command: `${npmCmd} run build && ${npmCmd} run start -- --hostname 127.0.0.1 --port ${new URL(baseURL).port || "3000"}`,
          url: `${baseURL}/api/health`,
          reuseExistingServer: false,
          timeout: 180_000,
          env: {
            AI_E2E_MOCK_MODE: "1",
          },
        },
});
