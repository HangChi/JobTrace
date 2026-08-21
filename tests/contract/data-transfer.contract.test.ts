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

test("所选导出只包含明确选择的投递记录", async ({ request }) => {
  const created = await Promise.all(
    ["所选导出甲", "所选导出乙"].map(async (companyName) => {
      const response = await request.post("/api/applications", {
        data: {
          companyName,
          positionName: "Engineer",
          appliedDate: "2026-08-13",
          status: "submitted",
        },
      });
      expect(response.status()).toBe(201);
      return response.json();
    }),
  );
  try {
    const exported = await request.get(
      `/api/exports/applications?scope=selected&format=csv&id=${created[0].id}`,
    );
    expect(exported.status()).toBe(200);
    const csv = await exported.text();
    expect(csv).toContain("所选导出甲");
    expect(csv).not.toContain("所选导出乙");
  } finally {
    await request.delete("/api/applications", {
      data: { ids: created.map((item) => item.id) },
    });
  }
});
