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

test("public registration enforces the 8–16 character password boundary", async ({
  request,
  baseURL,
}) => {
  for (const [index, password] of ["1234567", "12345678901234567"].entries()) {
    const response = await request.post("/api/auth/register", {
      data: { username: `boundary_${password.length}`, password },
      headers: {
        origin: baseURL!,
        "x-forwarded-for": `198.51.100.${40 + index}`,
      },
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation" });
  }

  for (const [index, password] of ["12345678", "1234567890123456"].entries()) {
    const response = await request.post("/api/auth/register", {
      data: { username: `accepted_${password.length}`, password },
      headers: {
        origin: baseURL!,
        "x-forwarded-for": `198.51.100.${50 + index}`,
      },
    });
    expect(response.status()).toBe(202);
  }
});

test("duplicate usernames return a specific field-level conflict", async ({
  request,
  baseURL,
}) => {
  const username = `duplicate_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const options = {
    data: { username, password: "Duplicate123!" },
    headers: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.60",
    },
  };

  expect((await request.post("/api/auth/register", options)).status()).toBe(
    202,
  );
  const duplicate = await request.post("/api/auth/register", options);
  expect(duplicate.status()).toBe(409);
  expect(await duplicate.json()).toMatchObject({
    code: "registration_conflict",
    message: "该用户名已注册。",
    fieldErrors: [
      {
        field: "username",
        code: "registration_conflict",
        message: "该用户名已注册，请更换一个。",
      },
    ],
  });
});
