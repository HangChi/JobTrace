import { expect, test } from "@playwright/test";
import { testDatabase } from "../../setup/database";

test("问题和行动项原子替换、排序、删除与乐观冲突", async ({ request }) => {
  const sql = testDatabase();
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "Interview Update",
        positionName: "Engineer",
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
        },
      })
    ).json();
    const first = {
      version: 1,
      interviewedOn: "2026-08-19",
      status: "pending_review",
      roundResult: "pending",
      questions: [
        { category: "project", question: "问题 B" },
        { category: "technical", question: "问题 A" },
      ],
      actionItems: [
        { content: "行动 B", completed: false },
        { content: "行动 A", completed: true },
      ],
    };
    expect(
      (
        await request.patch(`/api/interviews/${review.id}`, { data: first })
      ).status(),
    ).toBe(200);
    expect(
      await (await request.get(`/api/interviews/${review.id}`)).json(),
    ).toMatchObject({ interviewedOn: "2026-08-19" });
    const [aggregate] = await sql<
      { questions: string[]; actions: string[] }[]
    >`select
      array(select question from interview_questions where interview_review_id=${review.id} order by sort_order) questions,
      array(select content from interview_action_items where interview_review_id=${review.id} order by sort_order) actions`;
    expect(aggregate.questions).toEqual(["问题 B", "问题 A"]);
    expect(aggregate.actions).toEqual(["行动 B", "行动 A"]);

    const second = await request.patch(`/api/interviews/${review.id}`, {
      data: {
        ...first,
        version: 2,
        questions: [first.questions[1]],
        actionItems: [first.actionItems[1]],
      },
    });
    expect(second.status()).toBe(200);
    const [replaced] = await sql<
      { questions: number; actions: number }[]
    >`select
      (select count(*)::int from interview_questions where interview_review_id=${review.id}) questions,
      (select count(*)::int from interview_action_items where interview_review_id=${review.id}) actions`;
    expect(replaced).toMatchObject({ questions: 1, actions: 1 });

    expect(
      (
        await request.patch(`/api/interviews/${review.id}`, {
          data: { ...first, version: 2 },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await request.delete(`/api/applications/${application.id}`);
    await sql.end();
  }
});

test("同一自动保存会话以最新修订为准并保持跨标签版本冲突", async ({
  request,
}) => {
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "Autosave Ordering",
        positionName: "Engineer",
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
        },
      })
    ).json();
    const autosaveSessionId = crypto.randomUUID();
    const payload = (autosaveRevision: number, question: string) => ({
      version: 1,
      autosaveSessionId,
      autosaveRevision,
      status: "pending_review",
      roundResult: "pending",
      questions: [{ category: "other", question }],
      actionItems: [],
    });

    const first = await request.patch(`/api/interviews/${review.id}`, {
      data: payload(1, "旧修订"),
    });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ version: 2 });

    const latest = await request.patch(`/api/interviews/${review.id}`, {
      data: payload(2, "离页前最新修订"),
    });
    expect(latest.status()).toBe(200);
    expect(await latest.json()).toMatchObject({
      version: 3,
      questions: [{ question: "离页前最新修订" }],
    });

    const lateOldRequest = await request.patch(`/api/interviews/${review.id}`, {
      data: payload(1, "迟到的旧修订"),
    });
    expect(lateOldRequest.status()).toBe(200);
    expect(await lateOldRequest.json()).toMatchObject({
      version: 3,
      questions: [{ question: "离页前最新修订" }],
    });

    const otherTab = await request.patch(`/api/interviews/${review.id}`, {
      data: {
        ...payload(3, "其他标签页的陈旧内容"),
        autosaveSessionId: crypto.randomUUID(),
      },
    });
    expect(otherTab.status()).toBe(409);
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});
