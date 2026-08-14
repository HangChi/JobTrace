import { expect, test } from "@playwright/test";
test("public auth validation and protected admin contract", async ({
  request,
}) => {
  const invalid = await request.post("/api/auth/register", {
    data: { username: "bad name", password: "short" },
    headers: { origin: "http://127.0.0.1:3001" },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    requestId: expect.any(String),
  });
  const csrf = await request.post("/api/auth/login", {
    data: { username: "nobody", password: "password" },
    headers: { origin: "https://evil.example" },
  });
  expect(csrf.status()).toBe(403);
  expect(await csrf.json()).toMatchObject({ code: "csrf_rejected" });
});
