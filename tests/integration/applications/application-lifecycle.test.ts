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
    expect(detail.stageOccurrences).toHaveLength(1);
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
