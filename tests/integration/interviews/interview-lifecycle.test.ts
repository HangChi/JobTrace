import { expect, test } from "@playwright/test";
import { testDatabase } from "../../setup/database";

test("阶段修正保持 occurrence 和独立面试日期、删除 SET NULL、结果独立且投递删除级联", async ({
  request,
}) => {
  const sql = testDatabase();
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "Interview Lifecycle",
        positionName: "Engineer",
        appliedDate: "2026-08-01",
        status: "submitted",
      },
    })
  ).json();
  let reviewId = "";
  try {
    const review = await (
      await request.post("/api/interviews", {
        data: {
          applicationId: application.id,
          stage: "interview_1",
          interviewedOn: "2026-08-17",
        },
      })
    ).json();
    reviewId = review.id;
    const occurrenceId = review.stageOccurrenceId;
    const changed = await request.patch(
      `/api/applications/${application.id}/stages/${occurrenceId}`,
      {
        data: {
          stage: "interview_2",
          occurredOn: "2026-08-18",
          changeDate: "2026-08-20",
        },
      },
    );
    expect(changed.status()).toBe(200);
    const changedReview = await (
      await request.get(`/api/interviews/${review.id}`)
    ).json();
    expect(changedReview).toMatchObject({
      stageOccurrenceId: occurrenceId,
      stage: "interview_2",
      interviewedOn: "2026-08-17",
    });
    const changedList = await (
      await request.get(
        "/api/interviews?stage=interview_2&interviewedFrom=2026-08-17&interviewedTo=2026-08-17",
      )
    ).json();
    expect(changedList.items.map((item: { id: string }) => item.id)).toContain(
      review.id,
    );
    const staleFilter = await (
      await request.get("/api/interviews?stage=interview_1")
    ).json();
    expect(
      staleFilter.items.map((item: { id: string }) => item.id),
    ).not.toContain(review.id);
    const [event] = await sql<
      { type: string }[]
    >`select type::text type from application_events where application_id=${application.id} order by created_at desc limit 1`;
    expect(event.type).toBe("stage_changed");

    await request.patch(`/api/interviews/${review.id}`, {
      data: {
        version: changedReview.version,
        status: "draft",
        roundResult: "failed",
        questions: [],
        actionItems: [],
      },
    });
    const unchangedApplication = await (
      await request.get(`/api/applications/${application.id}`)
    ).json();
    expect(unchangedApplication.status).toBe("submitted");

    expect(
      (
        await request.delete(
          `/api/applications/${application.id}/stages/${occurrenceId}`,
          { data: { changeDate: "2026-08-20" } },
        )
      ).status(),
    ).toBe(200);
    expect(
      await (await request.get(`/api/interviews/${review.id}`)).json(),
    ).toMatchObject({
      linked: false,
      stageOccurrenceId: null,
      stage: "interview_1",
      interviewedOn: "2026-08-17",
    });
  } finally {
    await request.delete(`/api/applications/${application.id}`);
    if (reviewId)
      expect((await request.get(`/api/interviews/${reviewId}`)).status()).toBe(
        404,
      );
    await sql.end();
  }
});
