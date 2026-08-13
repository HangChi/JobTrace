import { expect, test } from "@playwright/test";

test("导入部分成功与 XLSX 往返", async ({ request }) => {
  const preview = await request.post("/api/imports/preview", {
    multipart: {
      file: {
        name: "mixed.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "公司,岗位,投递日期\nIntegration Import,Engineer,2026-08-13\n,Invalid,2026-08-13",
        ),
      },
    },
  });
  const batch = await preview.json();
  const confirmed = await request.post(`/api/imports/${batch.id}/confirm`, {
    data: {
      decisions: [
        { rowNumber: 2, action: "import" },
        { rowNumber: 3, action: "import" },
      ],
    },
  });
  const result = await confirmed.json();
  expect(result).toMatchObject({ created: 1, skipped: 1, failed: 0 });
  try {
    const exported = await request.get(
      "/api/exports/applications?scope=filtered&format=xlsx&q=Integration%20Import",
    );
    expect(exported.status()).toBe(200);
    expect(exported.headers()["content-type"]).toContain("spreadsheetml");
    expect((await exported.body()).subarray(0, 2).toString()).toBe("PK");
  } finally {
    for (const row of result.rows)
      if (row.applicationId)
        await request.delete(`/api/applications/${row.applicationId}`);
  }
});
