import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("cohort 包含后续阶段和面经并保持 owner 隔离", async ({ request }) => {
  const ids: string[] = [];
  const sql = testDatabase();
  const otherOwner = testId("report-other");
  await createTestUser(sql, otherOwner);
  try {
    const inside = await request.post("/api/applications", {
      data: {
        companyName: "Analytics Cohort Inside",
        positionName: "Engineer",
        city: "上海",
        type: "campus_recruitment",
        appliedDate: "2026-08-05",
        status: "submitted",
      },
    });
    const application = await inside.json();
    ids.push(application.id);
    const outside = await request.post("/api/applications", {
      data: {
        companyName: "Analytics Cohort Outside",
        positionName: "Engineer",
        city: "北京",
        type: "campus_recruitment",
        appliedDate: "2026-07-31",
        status: "submitted",
      },
    });
    ids.push((await outside.json()).id);
    await sql`select create_application_for_owner(${otherOwner},${sql.json({ companyName: "Other owner", positionName: "Engineer", city: "上海", type: "campus_recruitment", appliedDate: "2026-08-05", status: "offer" })}::jsonb)`;

    const stageResponse = await request.post(
      `/api/applications/${application.id}/stages`,
      { data: { stage: "interview_1", occurredOn: "2026-08-15" } },
    );
    expect(stageResponse.ok()).toBe(true);
    const withStage = await stageResponse.json();
    const stage = withStage.stageOccurrences.find(
      (item: { stage: string }) => item.stage === "interview_1",
    );
    const interviewResponse = await request.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stageOccurrenceId: stage.id,
        roundResult: "passed",
      },
    });
    expect(interviewResponse.ok()).toBe(true);
    const interview = await interviewResponse.json();
    const completed = await request.patch(`/api/interviews/${interview.id}`, {
      data: {
        version: 1,
        status: "completed",
        roundResult: "passed",
        questions: [{ category: "technical", question: "复盘问题" }],
        gaps: "补充边界",
        actionItems: [],
      },
    });
    expect(completed.ok()).toBe(true);
    const offered = await request.patch(
      `/api/applications/${application.id}/status`,
      { data: { status: "offer", version: withStage.version } },
    );
    expect(offered.ok()).toBe(true);

    const response = await request.get(
      "/api/analytics/report?period=custom&from=2026-08-01&to=2026-08-10&type=campus_recruitment&city=%E4%B8%8A%E6%B5%B7",
    );
    expect(response.ok()).toBe(true);
    const report = await response.json();
    expect(report.metrics.applications.value).toBe(1);
    expect(report.metrics.interviewRate.value).toBe(100);
    expect(report.metrics.offerRate.value).toBe(100);
    expect(report.metrics.reviewCompletionRate.value).toBe(100);
    expect(
      report.stageReach.find(
        (item: { stage: string }) => item.stage === "interview_1",
      ).count,
    ).toBe(1);
    expect(report.availableCities).toEqual(["上海", "北京"]);
  } finally {
    for (const id of ids) await request.delete(`/api/applications/${id}`);
    await cleanupTestUsers(sql, [otherOwner]);
  }
});

test("无效自定义日期不执行分析查询", async ({ request }) => {
  const response = await request.get(
    "/api/analytics/report?period=custom&from=2026-08-20&to=2026-08-01",
  );
  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({
    code: "validation",
    message: "开始日期不能晚于结束日期。",
  });
});
