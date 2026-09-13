import { expect, test } from "@playwright/test";

test("公开面经接口只返回脱敏 DTO", async ({ request }) => {
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "Public Contract",
        positionName: "Privacy Engineer",
        city: "上海",
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
          highlights: "公开亮点",
          gaps: "公开不足",
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
      city: "上海",
      author: null,
      questions: [{ question: "公开问题", originalAnswer: "公开回答" }],
      engagement: {
        likeCount: 0,
        commentCount: 0,
        viewCount: 1,
        likedByViewer: false,
      },
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
    expect(list.items[0]).toMatchObject({
      highlights: "公开亮点",
      gaps: "公开不足",
      questions: [{ question: "公开问题", originalAnswer: "公开回答" }],
      city: "上海",
    });
    expect(list.facets).toMatchObject({
      cities: expect.arrayContaining(["上海"]),
      positions: expect.arrayContaining(["Privacy Engineer"]),
    });
    const filtered = await (
      await request.get(
        "/api/interviews/public?city=%E4%B8%8A%E6%B5%B7&position=Privacy%20Engineer&sort=hot",
      )
    ).json();
    expect(filtered.items).toHaveLength(1);
    expect(list.items[0]).not.toHaveProperty("applicationId");
    expect(list.items[0].questions[0]).not.toHaveProperty("selfRating");

    const bodySearch = await (
      await request.get("/api/interviews/public?q=公开问题")
    ).json();
    expect(bodySearch.items).toEqual([]);

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

    const liked = await (
      await request.post(`/api/interviews/public/${review.id}/like`)
    ).json();
    expect(liked).toMatchObject({ likeCount: 1, likedByViewer: true });
    const unliked = await (
      await request.post(`/api/interviews/public/${review.id}/like`)
    ).json();
    expect(unliked).toMatchObject({ likeCount: 0, likedByViewer: false });

    const commentResponse = await request.post(
      `/api/interviews/public/${review.id}/comments`,
      { data: { content: "  很有帮助  " } },
    );
    expect(commentResponse.status()).toBe(201);
    expect(await commentResponse.json()).toMatchObject({
      comment: {
        content: "很有帮助",
        author: { username: expect.any(String) },
      },
      engagement: { commentCount: 1 },
    });
    expect(
      await (
        await request.get(`/api/interviews/public/${review.id}/comments`)
      ).json(),
    ).toEqual([
      expect.objectContaining({
        content: "很有帮助",
        author: expect.objectContaining({ username: expect.any(String) }),
      }),
    ]);

    const privateReview = await request.patch(`/api/interviews/${review.id}`, {
      data: {
        version: attributed.version,
        status: "completed",
        visibility: "private",
        authorMode: "anonymous",
        questions: [{ category: "technical", question: "公开问题" }],
        actionItems: [],
      },
    });
    expect(privateReview.status()).toBe(200);
    expect(
      (await request.post(`/api/interviews/public/${review.id}/like`)).status(),
    ).toBe(404);
    expect(
      (
        await request.post(`/api/interviews/public/${review.id}/comments`, {
          data: { content: "不可评论" },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});
