import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("互动明细表启用 RLS，且浏览器数据库角色没有直连权限", async () => {
  const sql = testDatabase();
  const tables = [
    "interview_review_likes",
    "interview_review_comments",
    "interview_review_views",
  ];
  const policies = await sql<{ relname: string; relrowsecurity: boolean }[]>`
    select relname,relrowsecurity
    from pg_class
    where relnamespace='public'::regnamespace and relname=any(${tables})
    order by relname
  `;
  expect(policies).toHaveLength(3);
  expect(policies.every((table) => table.relrowsecurity)).toBe(true);

  const privileges = await sql<
    { role_name: string; table_name: string; can_access: boolean }[]
  >`
    select roles.rolname role_name,tables.table_name,
      has_table_privilege(roles.rolname,'public.'||tables.table_name,
        'SELECT,INSERT,UPDATE,DELETE') can_access
    from pg_roles roles
    cross join unnest(${tables}::text[]) tables(table_name)
    where roles.rolname=any(array['anon','authenticated'])
  `;
  expect(privileges.every((privilege) => !privilege.can_access)).toBe(true);
});

test("点赞切换、浏览去重、评论和级联计数保持一致", async () => {
  const sql = testDatabase();
  const owner = testId("engagement-owner");
  const viewer = testId("engagement-viewer");
  const commenter = testId("engagement-commenter");
  await createTestUser(sql, owner);
  await createTestUser(sql, viewer);
  await createTestUser(sql, commenter);
  try {
    const [application] = await sql<{ id: string }[]>`
      select id from create_application_for_owner(${owner},${sql.json({
        companyName: "Engagement Corp",
        positionName: "Engineer",
        city: "上海",
        appliedDate: "2026-08-01",
        status: "submitted",
      })}::jsonb)
    `;
    const [review] = await sql<{ id: string }[]>`
      select id from create_interview_review_for_owner(
        ${owner},${application.id},null,'interview_1','2026-08-18',${sql.json({})}::jsonb
      )
    `;
    await sql`select update_interview_review_for_owner(
      ${owner},${review.id},1,${sql.json({
        status: "completed",
        visibility: "public",
        authorMode: "anonymous",
        questions: [{ question: "公开问题" }],
        actionItems: [],
      })}::jsonb
    )`;

    const [liked] = await sql<
      { liked: boolean; like_count: number }[]
    >`select * from toggle_public_interview_like(${viewer},${review.id})`;
    expect(liked).toMatchObject({ liked: true, like_count: 1 });
    const [unliked] = await sql<
      { liked: boolean; like_count: number }[]
    >`select * from toggle_public_interview_like(${viewer},${review.id})`;
    expect(unliked).toMatchObject({ liked: false, like_count: 0 });

    await sql`select * from record_public_interview_view(${viewer},${review.id})`;
    await sql`select * from record_public_interview_view(${viewer},${review.id})`;
    await sql`select * from add_public_interview_comment(${commenter},${review.id},' 很有帮助 ')`;
    const [engagement] = await sql<
      { view_count: number; comment_count: number; hot_score: string }[]
    >`select view_count,comment_count,hot_score from interview_reviews where id=${review.id}`;
    expect(engagement).toMatchObject({
      view_count: 1,
      comment_count: 1,
    });
    expect(Number(engagement.hot_score)).toBe(3);

    await sql`delete from users where id=${commenter}`;
    const [afterCascade] = await sql<
      { comment_count: number }[]
    >`select comment_count from interview_reviews where id=${review.id}`;
    expect(afterCascade.comment_count).toBe(0);
  } finally {
    await cleanupTestUsers(sql, [owner, viewer, commenter]);
  }
});
