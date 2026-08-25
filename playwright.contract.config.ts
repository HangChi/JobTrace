import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/contract",
  workers: 1,
  globalSetup: "./tests/setup/auth.global.ts",
  use: {
    baseURL: "http://127.0.0.1:3001",
    storageState: ".playwright/auth-contract.json",
  },
  webServer: {
    command: `"${process.execPath}" ./scripts/next-dev.mjs 3001 .next-contract`,
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: false,
  },
});
