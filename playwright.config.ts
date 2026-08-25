import { defineConfig, devices } from "@playwright/test";

const node = process.execPath;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  globalSetup: "./tests/setup/auth.global.ts",
  use: {
    baseURL: "http://127.0.0.1:3004",
    trace: "retain-on-failure",
    storageState: ".playwright/auth-e2e.json",
  },
  webServer: {
    command: `"${node}" ./scripts/next-dev.mjs 3004 .next-e2e`,
    url: "http://127.0.0.1:3004",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
