import { expect, test } from "@playwright/test";

test("面经创建、详情、聚合更新、列表、删除和 Problem 契约", async ({
  request,
}) => {
  const invalid = await request.post("/api/interviews", { data: {} });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({
    code: "validation",
    requestId: expect.any(String),
    fieldErrors: expect.any(Array),
  });

  const applicationResponse = await request.post("/api/applications", {
    data: {
      companyName: "Interview Contract",
      positionName: "Engineer",
      appliedDate: "2026-08-01",
      status: "submitted",
    },
  });
  expect(applicationResponse.status()).toBe(201);
  const application = await applicationResponse.json();
  const stageResponse = await request.post(
    `/api/applications/${application.id}/stages`,
    { data: { stage: "interview_1", occurredOn: "2026-08-18" } },
  );
  expect(stageResponse.status()).toBe(201);
  const stageApplication = await stageResponse.json();
  const occurrence = stageApplication.stageOccurrences.find(
    (item: { stage: string }) => item.stage === "interview_1",
  );

  try {
    const createdResponse = await request.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stageOccurrenceId: occurrence.id,
        roundResult: "pending",
      },
    });
    expect(createdResponse.status()).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({
      id: expect.any(String),
      applicationId: application.id,
      stageOccurrenceId: occurrence.id,
      stage: "interview_1",
      interviewedOn: "2026-08-18",
      status: "draft",
      version: 1,
      questions: [],
      actionItems: [],
    });

    const duplicate = await request.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stageOccurrenceId: occurrence.id,
      },
    });
    expect(duplicate.status()).toBe(409);
    expect(await duplicate.json()).toMatchObject({
      code: "conflict",
      requestId: expect.any(String),
    });

    expect((await request.get(`/api/interviews/${created.id}`)).status()).toBe(
      200,
    );
    const incomplete = await request.patch(`/api/interviews/${created.id}`, {
      data: {
        version: 1,
        status: "completed",
        roundResult: "pending",
        questions: [],
        actionItems: [],
      },
    });
    expect(incomplete.status()).toBe(400);

    const update = {
      version: 1,
      status: "completed",
      roundResult: "passed",
      questions: [
        {
          category: "other",
          question: "# 缓存复盘\n\n只需一篇 Markdown 面经即可完成。",
        },
      ],
      actionItems: [],
    };
    const updatedResponse = await request.patch(
      `/api/interviews/${created.id}`,
      { data: update },
    );
    expect(updatedResponse.status()).toBe(200);
    expect(await updatedResponse.json()).toMatchObject({
      version: 2,
      status: "completed",
      roundResult: "passed",
      questionCount: 1,
      actionCount: 0,
    });

    const conflict = await request.patch(`/api/interviews/${created.id}`, {
      data: update,
    });
    expect(conflict.status()).toBe(409);

    const list = await request.get(
      "/api/interviews?q=Interview%20Contract&status=completed&limit=10",
    );
    expect(list.status()).toBe(200);
    expect(await list.json()).toMatchObject({
      total: 1,
      limit: 10,
      items: [
        expect.objectContaining({
          id: created.id,
          stageOccurrenceId: occurrence.id,
        }),
      ],
    });

    expect(
      (await request.delete(`/api/interviews/${created.id}`)).status(),
    ).toBe(204);
    expect((await request.get(`/api/interviews/${created.id}`)).status()).toBe(
      404,
    );
    expect(
      (await request.delete(`/api/interviews/${created.id}`)).status(),
    ).toBe(404);
  } finally {
    await request.delete(`/api/applications/${application.id}`);
  }
});

test("未知投递和面经统一返回 404", async ({ request }) => {
  const unknown = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  expect(
    (
      await request.post("/api/interviews", {
        data: {
          applicationId: unknown,
          stage: "interview_1",
          interviewedOn: "2026-08-18",
        },
      })
    ).status(),
  ).toBe(404);
  const response = await request.get(`/api/interviews/${unknown}`);
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({
    code: "not_found",
    requestId: expect.any(String),
  });
});
