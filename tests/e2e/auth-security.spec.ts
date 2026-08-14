import { expect, test } from "@playwright/test";

test("login does not enumerate users and rejects cross-origin requests", async ({
  request,
  baseURL,
}) => {
  const unknown = await request.post("/api/auth/login", {
    data: { username: "unknown_user", password: "wrong-password" },
    headers: { origin: baseURL! },
  });
  const wrong = await request.post("/api/auth/login", {
    data: { username: "another_unknown", password: "wrong-password" },
    headers: { origin: baseURL! },
  });
  expect(unknown.status()).toBe(401);
  expect(wrong.status()).toBe(401);
  expect((await unknown.json()).code).toBe((await wrong.json()).code);
  const csrf = await request.post("/api/auth/login", {
    data: { username: "unknown_user", password: "wrong-password" },
    headers: { origin: "https://evil.example" },
  });
  expect(csrf.status()).toBe(403);
});
