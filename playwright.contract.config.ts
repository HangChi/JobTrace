import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/contract",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3001" },
  webServer: {
    command: `"${process.execPath}" ./node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3001`,
    url: "http://127.0.0.1:3001/api/health",
    reuseExistingServer: false,
  },
});
