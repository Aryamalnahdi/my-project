import { defineConfig } from "@playwright/test";

const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;
// Failure page snapshots can include credentials even when traces are disabled.
if (process.env.TICKET_E2E_LIVE === "1") process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL: remoteBaseURL ?? "http://127.0.0.1:3000",
    headless: true,
    channel: "msedge",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
  },
  webServer: remoteBaseURL ? undefined : {
    command: process.platform === "win32" ? "npm.cmd run start -- --hostname 127.0.0.1 --port 3000" : "npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
