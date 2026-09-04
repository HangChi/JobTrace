import { expect, test } from "@playwright/test";

test("创建、更新、阶段与历史完整性", async ({ request }) => {
  const created = await request.post("/api/applications", {
    data: {
      companyName: "Integration Lifecycle",
      positionName: "Engineer",
      appliedDate: "2026-08-01",
      status: "submitted",
    },
  });
  const application = await created.json();
  try {
    await request.post(`/api/applications/${application.id}/stages`, {
      data: { stage: "screening", occurredOn: "2026-08-05" },
    });
    const updated = await request.patch(`/api/applications/${application.id}`, {
      data: {
        companyName: "Integration Lifecycle",
        positionName: "Senior Engineer",
        appliedDate: "2026-08-01",
        status: "offer",
        stages: [],
        version: 2,
        changeDate: "2026-08-13",
      },
    });
    expect(updated.status()).toBe(200);
    const detail = await (
      await request.get(`/api/applications/${application.id}`)
    ).json();
    expect(detail.version).toBe(3);
    expect(detail.stageOccurrences).toHaveLength(2);
    expect(detail.stageOccurrences[0]).toMatchObject({
      stage: "screening",
      occurredOn: "2026-08-01",
    });
    expect(detail.events.map((event: { type: string }) => event.type)).toEqual(
      expect.arrayContaining(["created", "stage_added", "status_changed"]),
    );
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
  expect(
    (await request.get(`/api/applications/${application.id}`)).status(),
  ).toBe(404);
});

test("删除阶段时必须匹配 URL 中的投递记录", async ({ request }) => {
  const create = async (companyName: string) => {
    const response = await request.post("/api/applications", {
      data: {
        companyName,
        positionName: "Engineer",
        appliedDate: "2026-08-01",
        status: "submitted",
      },
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  const applicationA = await create("Stage Parent A");
  const applicationB = await create("Stage Parent B");
  const occurrenceId = applicationA.stageOccurrences[0].id;

  try {
    const response = await request.delete(
      `/api/applications/${applicationB.id}/stages/${occurrenceId}`,
      { data: { changeDate: "2026-08-13" } },
    );
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ code: "not_found" });

    const [afterA, afterB] = await Promise.all(
      [applicationA.id, applicationB.id].map(async (id) =>
        (await request.get(`/api/applications/${id}`)).json(),
      ),
    );
    expect(afterA).toMatchObject({
      version: applicationA.version,
      latestDate: applicationA.latestDate,
    });
    expect(
      afterA.stageOccurrences.map((stage: { id: string }) => stage.id),
    ).toContain(occurrenceId);
    expect(afterA.events).toHaveLength(applicationA.events.length);
    expect(afterB).toMatchObject({
      version: applicationB.version,
      latestDate: applicationB.latestDate,
    });
    expect(afterB.events).toHaveLength(applicationB.events.length);
  } finally {
    await Promise.all(
      [applicationA.id, applicationB.id].map((id) =>
        request.delete(`/api/applications/${id}`),
      ),
    );
  }
});
