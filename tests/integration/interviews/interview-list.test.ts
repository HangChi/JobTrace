import { expect, test } from "@playwright/test";

test("公司、岗位、问题搜索、组合筛选、稳定分页与级联删除", async ({
  request,
}) => {
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "Searchable Interview Corp",
        positionName: "Platform Engineer",
        appliedDate: "2026-08-01",
        status: "submitted",
      },
    })
  ).json();
  try {
    const first = await (
      await request.post("/api/interviews", {
        data: {
          applicationId: application.id,
          stage: "interview_1",
          interviewedOn: "2026-08-17",
        },
      })
    ).json();
    const second = await (
      await request.post("/api/interviews", {
        data: {
          applicationId: application.id,
          stage: "interview_2",
          interviewedOn: "2026-08-18",
        },
      })
    ).json();
    await request.patch(`/api/interviews/${first.id}`, {
      data: {
        version: 1,
        status: "pending_review",
        roundResult: "pending",
        questions: [{ category: "technical", question: "缓存击穿" }],
        actionItems: [],
      },
    });
    await request.patch(`/api/interviews/${second.id}`, {
      data: {
        version: 1,
        status: "completed",
        roundResult: "passed",
        gaps: "补充边界",
        questions: [{ category: "project", question: "项目复盘" }],
        actionItems: [],
      },
    });

    const searched = await (
      await request.get(
        "/api/interviews?q=%E7%BC%93%E5%AD%98%E5%87%BB%E7%A9%BF",
      )
    ).json();
    expect(searched.items.map((item: { id: string }) => item.id)).toEqual([
      first.id,
    ]);
    const filtered = await (
      await request.get(
        "/api/interviews?status=completed&stage=interview_2&result=passed&interviewedFrom=2026-08-18&interviewedTo=2026-08-18",
      )
    ).json();
    expect(filtered.items.map((item: { id: string }) => item.id)).toEqual([
      second.id,
    ]);

    const pageOne = await (await request.get("/api/interviews?limit=1")).json();
    expect(pageOne.items[0].id).toBe(second.id);
    const pageTwo = await (
      await request.get(
        `/api/interviews?limit=1&cursor=${encodeURIComponent(pageOne.nextCursor)}`,
      )
    ).json();
    expect(pageTwo.items[0].id).toBe(first.id);

    expect((await request.delete(`/api/interviews/${first.id}`)).status()).toBe(
      204,
    );
    expect((await request.get(`/api/interviews/${first.id}`)).status()).toBe(
      404,
    );
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});
