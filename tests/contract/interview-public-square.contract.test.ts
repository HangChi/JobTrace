import { expect, test } from "@playwright/test";

test("公开面经接口只返回脱敏 DTO", async ({ request }) => {
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "Public Contract",
        positionName: "Privacy Engineer",
        appliedDate: "2026-08-01",
        status: "submitted",
      },
    })
  ).json();
  try {
    const review = await (
      await request.post("/api/interviews", {
        data: {
          applicationId: application.id,
          stage: "interview_1",
          interviewedOn: "2026-08-18",
          interviewerNotes: "不得公开的面试官信息",
          roundResult: "passed",
        },
      })
    ).json();

    expect(
      (await request.get(`/api/interviews/public/${review.id}`)).status(),
    ).toBe(404);

    const published = await (
      await request.patch(`/api/interviews/${review.id}`, {
        data: {
          version: review.version,
          status: "completed",
          visibility: "public",
          authorMode: "anonymous",
          questions: [
            {
              category: "technical",
              question: "公开问题",
              originalAnswer: "公开回答",
              selfRating: 5,
            },
          ],
          actionItems: [{ content: "不得公开的行动项", completed: false }],
        },
      })
    ).json();

    const detailResponse = await request.get(
      `/api/interviews/public/${review.id}`,
    );
    expect(detailResponse.status()).toBe(200);
    const detail = await detailResponse.json();
    expect(detail).toMatchObject({
      id: review.id,
      companyName: "Public Contract",
      positionName: "Privacy Engineer",
      author: null,
      questions: [{ question: "公开问题", originalAnswer: "公开回答" }],
    });
    for (const forbidden of [
      "ownerId",
      "applicationId",
      "stageOccurrenceId",
      "version",
      "interviewerNotes",
      "actionItems",
      "roundResult",
    ]) {
      expect(detail).not.toHaveProperty(forbidden);
    }
    expect(detail.questions[0]).not.toHaveProperty("id");
    expect(detail.questions[0]).not.toHaveProperty("selfRating");

    const list = await (
      await request.get("/api/interviews/public?q=Public%20Contract")
    ).json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).not.toHaveProperty("applicationId");

    const attributed = await (
      await request.patch(`/api/interviews/${review.id}`, {
        data: {
          version: published.version,
          status: "completed",
          visibility: "public",
          authorMode: "attributed",
          questions: [{ category: "technical", question: "公开问题" }],
          actionItems: [],
        },
      })
    ).json();
    expect(attributed.authorMode).toBe("attributed");
    const attributedDetail = await (
      await request.get(`/api/interviews/public/${review.id}`)
    ).json();
    expect(Object.keys(attributedDetail.author).sort()).toEqual([
      "image",
      "username",
    ]);
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});
