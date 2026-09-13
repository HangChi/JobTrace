import { expect, test } from "@playwright/test";
import { testDatabase } from "../../setup/database";

test("面经默认私有，仅完成后可发布且降级自动下架", async ({ request }) => {
  const sql = testDatabase();
  const application = await (
    await request.post("/api/applications", {
      data: {
        companyName: "Publication State",
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
    expect(review).toMatchObject({
      visibility: "private",
      authorMode: "anonymous",
      publishedAt: null,
    });

    const incomplete = await request.patch(`/api/interviews/${review.id}`, {
      data: {
        version: review.version,
        status: "pending_review",
        visibility: "public",
        authorMode: "anonymous",
        questions: [{ question: "未完成内容" }],
        actionItems: [],
      },
    });
    expect(incomplete.status()).toBe(400);

    const published = await (
      await request.patch(`/api/interviews/${review.id}`, {
        data: {
          version: review.version,
          status: "completed",
          visibility: "public",
          authorMode: "attributed",
          questions: [{ question: "已完成内容" }],
          actionItems: [],
        },
      })
    ).json();
    expect(published).toMatchObject({
      visibility: "public",
      authorMode: "attributed",
    });
    expect(published.publishedAt).toEqual(expect.any(String));

    const downgraded = await (
      await request.patch(`/api/interviews/${review.id}`, {
        data: {
          version: published.version,
          status: "pending_review",
          visibility: "public",
          authorMode: "attributed",
          questions: [{ question: "继续修改" }],
          actionItems: [],
        },
      })
    ).json();
    expect(downgraded).toMatchObject({
      visibility: "private",
      authorMode: "anonymous",
      publishedAt: null,
    });

    const [stored] = await sql<
      {
        visibility: string;
        author_mode: string;
        published_at: string | null;
      }[]
    >`select visibility, author_mode, published_at from interview_reviews where id=${review.id}`;
    expect(stored).toMatchObject({
      visibility: "private",
      author_mode: "anonymous",
      published_at: null,
    });
  } finally {
    await request.delete(`/api/applications/${application.id}`);
    await sql.end();
  }
});
