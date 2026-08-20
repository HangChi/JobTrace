import { expect, test } from "@playwright/test";
import { testDatabase } from "../../setup/database";

test("已有阶段创建、新阶段原子创建、重复关联和事务回滚", async ({
  request,
}) => {
  const sql = testDatabase();
  const applicationResponse = await request.post("/api/applications", {
    data: {
      companyName: "Interview Creation",
      positionName: "Engineer",
      appliedDate: "2026-08-01",
      status: "submitted",
    },
  });
  const application = await applicationResponse.json();
  try {
    const stageApplication = await (
      await request.post(`/api/applications/${application.id}/stages`, {
        data: { stage: "interview_1", occurredOn: "2026-08-17" },
      })
    ).json();
    const occurrence = stageApplication.stageOccurrences.find(
      (item: { stage: string }) => item.stage === "interview_1",
    );
    const existing = await request.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stageOccurrenceId: occurrence.id,
      },
    });
    expect(existing.status()).toBe(201);

    const duplicate = await request.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stageOccurrenceId: occurrence.id,
      },
    });
    expect(duplicate.status()).toBe(409);

    const atomic = await request.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stage: "interview_2",
        interviewedOn: "2026-08-18",
      },
    });
    expect(atomic.status()).toBe(201);
    const [counts] = await sql<{ stages: number; reviews: number }[]>`select
        (select count(*)::int from application_stage_occurrences where application_id=${application.id}) stages,
        (select count(*)::int from interview_reviews where application_id=${application.id}) reviews`;
    expect(counts).toMatchObject({ stages: 3, reviews: 2 });

    const failed = await request.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stage: "interview_3",
        interviewedOn: "2026-07-01",
      },
    });
    expect(failed.status()).toBe(400);
    const [rolledBack] = await sql<
      { total: number }[]
    >`select count(*)::int total from application_stage_occurrences
      where application_id=${application.id} and stage='interview_3'`;
    expect(rolledBack.total).toBe(0);
  } finally {
    await request.delete(`/api/applications/${application.id}`);
    await sql.end();
  }
});
