import { expect, test } from "@playwright/test";

test("profile update remains compatible and password input is validated", async ({
  request,
}) => {
  const updated = await request.patch("/api/profile", {
    data: { displayName: "契约测试用户", image: "" },
  });
  expect(updated.status()).toBe(200);
  expect(await updated.json()).toMatchObject({
    displayName: "契约测试用户",
    image: null,
  });

  const invalid = await request.post("/api/profile/password", {
    data: { currentPassword: "x", newPassword: "short" },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    requestId: expect.any(String),
    fieldErrors: expect.arrayContaining([
      expect.objectContaining({ field: "newPassword" }),
    ]),
  });

  const tooLong = await request.post("/api/profile/password", {
    data: { currentPassword: "x", newPassword: "12345678901234567" },
  });
  expect(tooLong.status()).toBe(400);
  expect(await tooLong.json()).toMatchObject({
    code: "validation",
    fieldErrors: expect.arrayContaining([
      expect.objectContaining({ field: "newPassword" }),
    ]),
  });

  const wrongCurrentPassword = await request.post("/api/profile/password", {
    data: {
      currentPassword: "Definitely-Wrong-Password",
      newPassword: "12345678",
    },
  });
  expect(wrongCurrentPassword.status()).toBe(400);
  expect(await wrongCurrentPassword.json()).toMatchObject({
    code: "invalid_password",
    message: "当前密码不正确，请重新输入。",
    fieldErrors: [expect.objectContaining({ field: "currentPassword" })],
  });
});

test("password endpoint rejects unauthenticated callers", async ({
  playwright,
  baseURL,
}) => {
  const anonymous = await playwright.request.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const response = await anonymous.post("/api/profile/password", {
    data: { currentPassword: "Current-Password", newPassword: "New-Password" },
  });
  expect(response.status()).toBe(401);
  await anonymous.dispose();
});
