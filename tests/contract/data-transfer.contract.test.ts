import { expect, test } from "@playwright/test";

test("导入格式边界和导出空范围契约", async ({ request }) => {
  const unsupported = await request.post("/api/imports/preview", {
    multipart: {
      file: {
        name: "fake.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("fake"),
      },
    },
  });
  expect(unsupported.status()).toBe(415);
  expect(await unsupported.json()).toMatchObject({
    code: "unsupported_format",
    requestId: expect.any(String),
  });
  const missing = await request.post(
    "/api/imports/00000000-0000-0000-0000-000000000000/confirm",
    { data: { decisions: [] } },
  );
  expect(missing.status()).toBe(404);
});
