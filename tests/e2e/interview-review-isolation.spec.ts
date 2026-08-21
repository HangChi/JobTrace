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
