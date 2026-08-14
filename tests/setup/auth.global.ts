import { request, type FullConfig } from "@playwright/test";
import { mkdir } from "node:fs/promises";

export default async function globalSetup(config: FullConfig) {
  const baseURL = String(
    config.projects[0]?.use?.baseURL ?? "http://127.0.0.1:3000",
  );
  const context = await request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL },
  });
  await context.post("/api/auth/register", {
    data: { username: "playwright_user", password: "Playwright-Password-123!" },
  });
  const login = await context.post("/api/auth/login", {
    data: { username: "playwright_user", password: "Playwright-Password-123!" },
  });
  if (!login.ok())
    throw new Error(
      `Playwright login failed: ${login.status()} ${await login.text()}`,
    );
  await mkdir(".playwright", { recursive: true });
  await context.storageState({ path: ".playwright/auth.json" });
  await context.dispose();
}
