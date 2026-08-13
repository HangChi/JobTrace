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
  expect(application).toMatchObject({ id: expect.any(String), version: 1 });
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
