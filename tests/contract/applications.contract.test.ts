import { expect, test } from "@playwright/test";

test("投递 CRUD、Problem 和 409 契约", async ({ request }) => {
  const invalid = await request.post("/api/applications", { data: {} });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    message: expect.any(String),
    requestId: expect.any(String),
    fieldErrors: expect.any(Array),
  });

  const created = await request.post("/api/applications", {
    data: {
      companyName: "Contract CRUD",
      positionName: "Engineer",
      appliedDate: "2026-08-13",
      status: "submitted",
    },
  });
  expect(created.status()).toBe(201);
  const application = await created.json();
  expect(application).toMatchObject({
    id: expect.any(String),
    type: "campus_recruitment",
    version: 1,
  });
  expect(application.stageOccurrences).toEqual([
    expect.objectContaining({
      stage: "screening",
      occurredOn: "2026-08-13",
    }),
  ]);
  try {
    expect(
      (await request.get(`/api/applications/${application.id}`)).status(),
    ).toBe(200);
    const update = {
      companyName: "Contract CRUD",
      positionName: "Senior Engineer",
      appliedDate: "2026-08-13",
      status: "submitted",
      stages: [],
      version: 1,
      changeDate: "2026-08-13",
    };
    expect(
      (
        await request.patch(`/api/applications/${application.id}`, {
          data: update,
        })
      ).status(),
    ).toBe(200);
    const statusUpdate = await request.patch(
      `/api/applications/${application.id}/status`,
      { data: { status: "offer", version: 2 } },
    );
    expect(statusUpdate.status()).toBe(200);
    expect(await statusUpdate.json()).toMatchObject({
      id: application.id,
      status: "offer",
      version: 3,
      latestDate: expect.any(String),
    });
    const conflict = await request.patch(
      `/api/applications/${application.id}`,
      { data: update },
    );
    expect(conflict.status()).toBe(409);
    expect(await conflict.json()).toMatchObject({
      code: "conflict",
      requestId: expect.any(String),
    });
  } finally {
    expect(
      (await request.delete(`/api/applications/${application.id}`)).status(),
    ).toBe(204);
  }
});

test("批量删除校验选择范围并删除当前用户的所选记录", async ({ request }) => {
  const invalid = await request.delete("/api/applications", {
    data: { ids: [] },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    fieldErrors: expect.arrayContaining([
      expect.objectContaining({ field: "ids" }),
    ]),
  });

  const created = await Promise.all(
    ["批量删除甲", "批量删除乙"].map(async (companyName) => {
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

  const removed = await request.delete("/api/applications", {
    data: { ids: created.map((item) => item.id) },
  });
  expect(removed.status()).toBe(200);
  expect(await removed.json()).toEqual({ deletedCount: 2 });
  for (const item of created) {
    expect((await request.get(`/api/applications/${item.id}`)).status()).toBe(
      404,
    );
  }
});
