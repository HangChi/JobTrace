import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/integration",
  workers: 1,
  globalSetup: "./tests/setup/auth.global.ts",
  use: {
    baseURL: "http://127.0.0.1:3002",
    storageState: ".playwright/auth.json",
  },
  webServer: {
    command: `"${process.execPath}" ./scripts/next-dev.mjs 3002 .next-integration`,
    url: "http://127.0.0.1:3002/api/health",
    reuseExistingServer: false,
  },
});
