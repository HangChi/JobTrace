import { expect, test } from "@playwright/test";
import { seedAdminConsoleUser } from "../../fixtures/admin-console";
import { testDatabase, testId } from "../../setup/database";

test("directory supports combined filters, stable pages and minimal detail", async ({
  request,
}) => {
  const sql = testDatabase();
  await sql`update users set role='admin' where username='playwright_user'`;
  const first = testId("query-ops-alpha");
  const second = testId("query-ops-beta");
  const createdAt = new Date("2026-08-20T12:00:00.000Z");
  await seedAdminConsoleUser(sql, {
    id: first,
    username: "query_ops_alpha",
    role: "user",
    createdAt,
  });
  await seedAdminConsoleUser(sql, {
    id: second,
    username: "query_ops_beta",
    role: "user",
    createdAt,
  });
  const [application] = await sql<{ id: string }[]>`
    insert into applications(
      owner_id,company_name,position_name,city,job_url,type,status,
      applied_date,latest_date,notes
    ) values(
      ${first},'Integration Labs','Platform Engineer','上海',
      'https://example.test/jobs/platform','campus_recruitment','submitted',
      '2026-08-18','2026-08-20','管理员可见的投递备注'
    ) returning id`;
  const [stage] = await sql<{ id: string }[]>`
    insert into application_stage_occurrences(application_id,stage,occurred_on)
    values(${application.id},'interview_1','2026-08-20') returning id`;
  const [review] = await sql<{ id: string }[]>`
    insert into interview_reviews(
      owner_id,application_id,stage_occurrence_id,stage_snapshot,interviewed_on,
      format,duration_minutes,interviewer_notes,round_result,highlights,gaps,status
    ) values(
      ${first},${application.id},${stage.id},'interview_1','2026-08-20',
      'online',45,'管理员可见的面试官记录','passed','表达清楚','补充缓存知识','completed'
    ) returning id`;
  await sql`
    insert into interview_questions(
      interview_review_id,sort_order,category,question,original_answer,improved_answer,self_rating
    ) values(
      ${review.id},0,'technical','浏览器缓存如何工作？','强缓存','补充协商缓存',4
    )`;
  await sql`
    insert into interview_action_items(interview_review_id,sort_order,content,completed)
    values(${review.id},0,'复习缓存控制头',false)`;
  try {
    const response = await request.get(
      "/api/admin/users?q=query_ops&role=user&status=active&registeredFrom=2026-08-20&registeredTo=2026-08-20&page=1&limit=1",
    );
    expect(response.status()).toBe(200);
    const page = await response.json();
    expect(page).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect(page.items).toHaveLength(1);

    const page2 = await request.get(
      "/api/admin/users?q=query_ops&role=user&status=active&registeredFrom=2026-08-20&registeredTo=2026-08-20&page=2&limit=1",
    );
    const next = await page2.json();
    expect(next.items[0].id).not.toBe(page.items[0].id);

    const overPage = await request.get(
      "/api/admin/users?q=query_ops&page=99&limit=1",
    );
    expect(await overPage.json()).toMatchObject({ page: 2, totalPages: 2 });

    const detail = await request.get(`/api/admin/users/${first}`);
    const body = await detail.json();
    expect(body).toMatchObject({
      id: first,
      lastSignInAt: null,
      applicationCount: 1,
      interviewCount: 1,
      recentAuditEvents: [],
      applications: {
        total: 1,
        page: 1,
        items: [
          {
            companyName: "Integration Labs",
            positionName: "Platform Engineer",
            notes: "管理员可见的投递备注",
            stages: [{ stage: "interview_1", occurredOn: "2026-08-20" }],
          },
        ],
      },
      interviews: {
        total: 1,
        page: 1,
        items: [
          {
            companyName: "Integration Labs",
            interviewerNotes: "管理员可见的面试官记录",
            questions: [
              expect.objectContaining({ question: "浏览器缓存如何工作？" }),
            ],
            actionItems: [
              expect.objectContaining({ content: "复习缓存控制头" }),
            ],
          },
        ],
      },
    });
    expect(JSON.stringify(body)).not.toMatch(/password|session|token/i);

    const paged = await request.get(
      `/api/admin/users/${first}?applicationsPage=2&interviewsPage=2`,
    );
    expect(await paged.json()).toMatchObject({
      applications: { page: 1, totalPages: 1 },
      interviews: { page: 1, totalPages: 1 },
    });
  } finally {
    await sql`delete from applications where owner_id in (${first},${second})`;
    await sql`delete from users where id in (${first},${second})`;
    await sql.end();
  }
});
