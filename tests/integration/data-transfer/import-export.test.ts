import { expect, test } from "@playwright/test";
import { testDatabase } from "../../setup/database";

test("导入部分成功与 XLSX 往返", async ({ request }) => {
  const preview = await request.post("/api/imports/preview", {
    multipart: {
      file: {
        name: "mixed.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "公司,岗位,城市,职位链接,投递日期,类型,状态,阶段历史,备注\nIntegration Import,Engineer,上海,https://example.com/job,2026-08-13,暑期实习,已投递,interview_1/一面 + 2026-08-14；interview_1/一面 + 2026-08-15,完整往返\n,Invalid,,,2026-08-13,,,,",
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
    const workbook = await exported.body();
    expect(workbook.subarray(0, 2).toString()).toBe("PK");
    await request.delete(`/api/applications/${result.rows[0].applicationId}`);
    result.rows[0].applicationId = null;

    const roundTripPreview = await request.post("/api/imports/preview", {
      multipart: {
        file: {
          name: "round-trip.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: workbook,
        },
      },
    });
    expect(roundTripPreview.status()).toBe(201);
    const roundTripBatch = await roundTripPreview.json();
    expect(roundTripBatch.columns).toMatchObject({
      ID: "",
      公司: "companyName",
      阶段历史: "stages",
      创建时间: "",
    });
    const roundTripResult = await (
      await request.post(`/api/imports/${roundTripBatch.id}/confirm`, {
        data: { decisions: [{ rowNumber: 2, action: "import" }] },
      })
    ).json();
    expect(roundTripResult).toMatchObject({ created: 1, failed: 0 });
    result.rows.push(...roundTripResult.rows);
    const restored = await (
      await request.get(
        `/api/applications/${roundTripResult.rows[0].applicationId}`,
      )
    ).json();
    expect(restored).toMatchObject({
      companyName: "Integration Import",
      positionName: "Engineer",
      city: "上海",
      jobUrl: "https://example.com/job",
      type: "summer_internship",
      status: "submitted",
      notes: "完整往返",
      latestDate: "2026-08-15",
    });
    expect(restored.stageOccurrences).toEqual([
      expect.objectContaining({
        stage: "interview_1",
        occurredOn: "2026-08-14",
      }),
      expect.objectContaining({
        stage: "interview_1",
        occurredOn: "2026-08-15",
      }),
    ]);
  } finally {
    for (const row of result.rows)
      if (row.applicationId)
        await request.delete(`/api/applications/${row.applicationId}`);
  }
});

test("自定义列映射成功后才废弃旧预览", async ({ request }) => {
  const sql = testDatabase();
  const file = {
    name: "custom.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("企业简称,职位名,日期\n映射公司,工程师,2026-08-13"),
  };
  try {
    const initial = await request.post("/api/imports/preview", {
      multipart: { file },
    });
    expect(initial.status()).toBe(201);
    const oldBatch = await initial.json();
    expect(oldBatch).toMatchObject({ validRows: 0, columns: { 企业简称: "" } });

    const invalid = await request.post("/api/imports/preview", {
      multipart: {
        file,
        mapping: JSON.stringify({
          企业简称: "companyName",
          职位名: "companyName",
          日期: "appliedDate",
        }),
        replaceBatchId: oldBatch.id,
      },
    });
    expect(invalid.status()).toBe(400);
    const [stillPreviewed] = await sql<{ status: string }[]>`
      select status::text from import_batches where id=${oldBatch.id}`;
    expect(stillPreviewed.status).toBe("previewed");

    const corrected = await request.post("/api/imports/preview", {
      multipart: {
        file,
        mapping: JSON.stringify({
          企业简称: "companyName",
          职位名: "positionName",
          日期: "appliedDate",
        }),
        replaceBatchId: oldBatch.id,
      },
    });
    expect(corrected.status()).toBe(201);
    const newBatch = await corrected.json();
    expect(newBatch).toMatchObject({ validRows: 1 });
    const statuses = await sql<{ id: string; status: string }[]>`
      select id::text,status::text from import_batches
      where id in (${oldBatch.id},${newBatch.id}) order by id`;
    expect(
      Object.fromEntries(statuses.map((row) => [row.id, row.status])),
    ).toEqual({
      [oldBatch.id]: "expired",
      [newBatch.id]: "previewed",
    });
  } finally {
    await sql.end();
  }
});
