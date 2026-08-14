import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/performance",
  testMatch: "authentication-performance.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3003" },
  webServer: {
    command: `"${process.execPath}" ./scripts/next-dev.mjs 3003 .next-performance`,
    url: "http://127.0.0.1:3003/api/health",
    reuseExistingServer: false,
  },
});
