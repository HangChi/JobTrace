import { expect, test } from "@playwright/test";

test("统计与更新后跟进移除", async ({ request }) => {
  const created = await request.post("/api/applications", {
    data: {
      companyName: "Integration FollowUp",
      positionName: "Engineer",
      appliedDate: "2026-08-01",
      status: "active",
    },
  });
  const app = await created.json();
  try {
    let summary = await (await request.get("/api/analytics/summary")).json();
    expect(
      summary.followUps.some((item: { id: string }) => item.id === app.id),
    ).toBe(true);
    await request.patch(`/api/applications/${app.id}`, {
      data: {
        companyName: app.companyName,
        positionName: app.positionName,
        appliedDate: app.appliedDate,
        status: "active",
        stages: [],
        version: 1,
        changeDate: "2026-08-13",
      },
    });
    summary = await (await request.get("/api/analytics/summary")).json();
    expect(
      summary.followUps.some((item: { id: string }) => item.id === app.id),
    ).toBe(false);
  } finally {
    await request.delete(`/api/applications/${app.id}`);
  }
});
