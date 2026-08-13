import { expect, test } from "@playwright/test";
test("public auth validation and protected admin contract", async ({
  request,
}) => {
  const invalid = await request.post("/api/auth/register", {
    data: { email: "bad", password: "short" },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    requestId: expect.any(String),
  });
  const admin = await request.get("/api/admin/users");
  expect(admin.status()).toBe(401);
  expect(await admin.json()).toMatchObject({ code: "unauthorized" });
});
