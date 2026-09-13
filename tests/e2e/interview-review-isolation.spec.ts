import { expect, test } from "@playwright/test";

test("跨用户访问被拒绝，阶段解除保留面经，投递删除级联", async ({
  browser,
  playwright,
  baseURL,
}) => {
  const createUser = async (prefix: string) => {
    const username = `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const password = "SecurePass123!";
    const api = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        origin: baseURL!,
        "x-forwarded-for":
          prefix === "review_a" ? "203.0.113.21" : "203.0.113.22",
      },
    });
    expect(
      (
        await api.post("/api/auth/register", { data: { username, password } })
      ).status(),
    ).toBe(202);
    expect(
      (
        await api.post("/api/auth/login", { data: { username, password } })
      ).status(),
    ).toBe(200);
    return api;
  };

  const apiA = await createUser("review_a");
  const apiB = await createUser("review_b");
  const application = await (
    await apiB.post("/api/applications", {
      data: {
        companyName: "仅 B 可见",
        positionName: "隐私工程师",
        appliedDate: "2026-08-01",
        status: "submitted",
      },
    })
  ).json();
  const review = await (
    await apiB.post("/api/interviews", {
      data: {
        applicationId: application.id,
        stage: "interview_1",
        interviewedOn: "2026-08-18",
      },
    })
  ).json();
  try {
    expect((await apiA.get(`/api/interviews/${review.id}`)).status()).toBe(404);
    expect(
      (await apiA.get(`/api/exports/interviews?id=${review.id}`)).status(),
    ).toBe(404);
    expect(
      (
        await apiA.patch(`/api/interviews/${review.id}`, {
          data: {
            version: 1,
            status: "draft",
            roundResult: "pending",
            questions: [],
            actionItems: [],
          },
        })
      ).status(),
    ).toBe(404);
    expect((await apiA.delete(`/api/interviews/${review.id}`)).status()).toBe(
      404,
    );
    const listA = await (await apiA.get("/api/interviews")).json();
    expect(listA.items).toEqual([]);

    expect(
      (await apiA.get(`/api/interviews/public/${review.id}`)).status(),
    ).toBe(404);
    const published = await apiB.patch(`/api/interviews/${review.id}`, {
      data: {
        version: review.version,
        status: "completed",
        visibility: "public",
        authorMode: "anonymous",
        roundResult: "pending",
        questions: [{ category: "other", question: "公开但匿名的面经" }],
        actionItems: [{ content: "私人行动项", completed: false }],
      },
    });
    expect(published.status()).toBe(200);
    const publicDetail = await (
      await apiA.get(`/api/interviews/public/${review.id}`)
    ).json();
    expect(publicDetail).toMatchObject({
      id: review.id,
      author: null,
      questions: [{ question: "公开但匿名的面经" }],
    });
    expect(publicDetail).not.toHaveProperty("applicationId");
    expect(publicDetail).not.toHaveProperty("actionItems");
    expect((await apiA.get(`/api/interviews/${review.id}`)).status()).toBe(404);

    const contextA = await browser.newContext({
      storageState: await apiA.storageState(),
    });
    const pageA = await contextA.newPage();
    await pageA.goto("/interviews");
    await pageA.getByLabel("搜索").fill("公开但匿名");
    await pageA.getByRole("button", { name: "筛选" }).click();
    await expect(pageA).toHaveURL(/q=/);
    await pageA.getByRole("link", { name: "仅 B 可见 · 隐私工程师" }).click();
    await expect(pageA).toHaveURL(`/interviews/shared/${review.id}`);
    await expect(pageA.getByText("匿名用户")).toBeVisible();
    await expect(pageA.getByText("公开但匿名的面经")).toBeVisible();
    await expect(pageA.getByText("私人行动项")).toHaveCount(0);
    await contextA.close();

    expect(
      (
        await apiB.delete(
          `/api/applications/${application.id}/stages/${review.stageOccurrenceId}`,
          { data: { changeDate: "2026-08-20" } },
        )
      ).status(),
    ).toBe(200);
    const contextB = await browser.newContext({
      storageState: await apiB.storageState(),
    });
    const pageB = await contextB.newPage();
    await pageB.goto(`/interviews/${review.id}`);
    await expect(pageB.getByText("阶段已解除关联")).toBeVisible();
    await contextB.close();

    expect(
      (await apiB.delete(`/api/applications/${application.id}`)).status(),
    ).toBe(204);
    expect((await apiB.get(`/api/interviews/${review.id}`)).status()).toBe(404);
  } finally {
    await apiB.delete(`/api/applications/${application.id}`);
    await apiA.dispose();
    await apiB.dispose();
  }
});
