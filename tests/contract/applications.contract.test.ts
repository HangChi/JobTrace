import { expect, test } from "@playwright/test";
import { testDatabase, testId } from "../setup/database";

test("投递 CRUD、Problem 和 409 契约", async ({ request }) => {
  const invalid = await request.post("/api/applications", { data: {} });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    message: expect.any(String),
    requestId: expect.any(String),
    fieldErrors: expect.any(Array),
  });

  const created = await request.post("/api/applications", {
    data: {
      companyName: "Contract CRUD",
      positionName: "Engineer",
      appliedDate: "2026-08-13",
      status: "submitted",
    },
  });
  expect(created.status()).toBe(201);
  const application = await created.json();
  expect(application).toMatchObject({
    id: expect.any(String),
    type: "campus_recruitment",
    version: 1,
  });
  expect(application.stageOccurrences).toEqual([
    expect.objectContaining({
      stage: "screening",
      occurredOn: "2026-08-13",
    }),
  ]);
  try {
    expect(
      (await request.get(`/api/applications/${application.id}`)).status(),
    ).toBe(200);
    const dialogDetail = await request.get(
      `/api/applications/${application.id}/detail`,
    );
    expect(dialogDetail.status()).toBe(200);
    const serverTiming = dialogDetail.headers()["server-timing"];
    expect(serverTiming).toContain("auth;dur=");
    expect(serverTiming).toContain("application;dur=");
    expect(serverTiming).toContain("interviews;dur=");
    expect(serverTiming).toContain("total;dur=");
    expect(await dialogDetail.json()).toMatchObject({
      application: { id: application.id, events: expect.any(Array) },
      interviews: [],
    });
    const update = {
      companyName: "Contract CRUD",
      positionName: "Senior Engineer",
      appliedDate: "2026-08-13",
      status: "submitted",
      stages: [],
      version: 1,
      changeDate: "2026-08-13",
    };
    expect(
      (
        await request.patch(`/api/applications/${application.id}`, {
          data: update,
        })
      ).status(),
    ).toBe(200);
    const statusUpdate = await request.patch(
      `/api/applications/${application.id}/status`,
      { data: { status: "offer", version: 2 } },
    );
    expect(statusUpdate.status()).toBe(200);
    expect(await statusUpdate.json()).toMatchObject({
      id: application.id,
      status: "offer",
      version: 3,
      latestDate: expect.any(String),
    });
    const conflict = await request.patch(
      `/api/applications/${application.id}`,
      { data: update },
    );
    expect(conflict.status()).toBe(409);
    expect(await conflict.json()).toMatchObject({
      code: "conflict",
      requestId: expect.any(String),
    });
  } finally {
    expect(
      (await request.delete(`/api/applications/${application.id}`)).status(),
    ).toBe(204);
  }
});

test("批量删除校验选择范围并删除当前用户的所选记录", async ({ request }) => {
  const invalid = await request.delete("/api/applications", {
    data: { ids: [] },
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    fieldErrors: expect.arrayContaining([
      expect.objectContaining({ field: "ids" }),
    ]),
  });

  const created = await Promise.all(
    ["批量删除甲", "批量删除乙"].map(async (companyName) => {
      const response = await request.post("/api/applications", {
        data: {
          companyName,
          positionName: "Engineer",
          appliedDate: "2026-08-13",
          status: "submitted",
        },
      });
      expect(response.status()).toBe(201);
      return response.json();
    }),
  );

  const removed = await request.delete("/api/applications", {
    data: { ids: created.map((item) => item.id) },
  });
  expect(removed.status()).toBe(200);
  expect(await removed.json()).toEqual({ deletedCount: 2 });
  for (const item of created) {
    expect((await request.get(`/api/applications/${item.id}`)).status()).toBe(
      404,
    );
  }
});

test("创建秋招提前批投递", async ({ request }) => {
  const created = await request.post("/api/applications", {
    data: {
      companyName: "Contract Early Recruitment",
      positionName: "Engineer",
      appliedDate: "2026-08-13",
      type: "early_campus_recruitment",
      status: "submitted",
    },
  });
  expect(created.status()).toBe(201);
  const application = await created.json();
  expect(application.type).toBe("early_campus_recruitment");
  expect(
    (await request.delete(`/api/applications/${application.id}`)).status(),
  ).toBe(204);
});

test("从公共岗位创建投递时使用服务端字段并返回可导航的重复冲突", async ({
  request,
}) => {
  const sql = testDatabase();
  const identity = testId("application-contract-company");
  const [company] = await sql<
    Array<{ id: string }>
  >`insert into job_market_companies(canonical_name,normalized_name,identity_key) values('可信公司','可信公司',${identity}) returning id`;
  const [campaign] = await sql<
    Array<{ id: string }>
  >`insert into job_market_campaigns(company_id,campaign_key) values(${company.id},${testId("campaign")}) returning id`;
  const [post] = await sql<
    Array<{ id: string }>
  >`insert into job_market_posts(company_id,campaign_id,title,normalized_title,content_hash,primary_apply_url) values(${company.id},${campaign.id},'可信岗位','可信岗位',${"d".repeat(64)},'https://jobs.example.com/trusted') returning id`;
  let applicationId: string | undefined;
  try {
    const created = await request.post("/api/applications", {
      data: {
        jobMarketPostId: post.id,
        companyName: "伪造公司",
        positionName: "伪造岗位",
        city: "伪造地点",
        jobUrl: "https://attacker.example/apply",
        appliedDate: "2026-08-30",
        status: "submitted",
      },
    });
    expect(created.status()).toBe(201);
    const application = await created.json();
    applicationId = application.id;
    expect(application).toMatchObject({
      companyName: "可信公司",
      positionName: "可信岗位",
      jobUrl: "https://jobs.example.com/trusted",
    });

    const duplicate = await request.post("/api/applications", {
      data: {
        jobMarketPostId: post.id,
        companyName: "可信公司",
        positionName: "可信岗位",
        appliedDate: "2026-08-30",
      },
    });
    expect(duplicate.status()).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      code: "job_market_application_exists",
      existingApplicationId: application.id,
    });
  } finally {
    if (applicationId)
      await sql`delete from applications where id=${applicationId}`;
    await sql`delete from job_market_posts where id=${post.id}`;
    await sql`delete from job_market_campaigns where id=${campaign.id}`;
    await sql`delete from job_market_companies where id=${company.id}`;
    await sql.end();
  }
});
