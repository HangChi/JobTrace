import { expect, test } from "@playwright/test";
import { RECRUITMENT_STAGES } from "@/modules/applications/domain/catalog";

test("统计与更新后跟进移除", async ({ request }) => {
  const created = await request.post("/api/applications", {
    data: {
      companyName: "Integration FollowUp",
      positionName: "Engineer",
      appliedDate: "2026-07-01",
      status: "submitted",
    },
  });
  const app = await created.json();
  try {
    let summary = await (await request.get("/api/analytics/summary")).json();
    expect(
      Object.keys(summary.stageDistribution).every((stage) =>
        RECRUITMENT_STAGES.includes(stage as never),
      ),
    ).toBe(true);
    expect(
      summary.followUps.some((item: { id: string }) => item.id === app.id),
    ).toBe(true);
    await request.patch(`/api/applications/${app.id}`, {
      data: {
        companyName: app.companyName,
        positionName: app.positionName,
        appliedDate: app.appliedDate,
        status: "offer",
        stages: [],
        version: 1,
        changeDate: new Date().toISOString().slice(0, 10),
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
