import { expect, test } from "@playwright/test";

test("部分匹配、组合筛选和游标跨页稳定", async ({ request }) => {
  const ids: string[] = [];
  try {
    for (let index = 0; index < 5; index += 1) {
      const response = await request.post("/api/applications", {
        data: {
          companyName: `Cursor Target ${index}`,
          positionName: "Engineer",
          city: index % 2 ? "北京" : "上海",
          appliedDate: `2026-08-${String(index + 1).padStart(2, "0")}`,
          status: "submitted",
        },
      });
      ids.push((await response.json()).id);
    }
    const first = await (
      await request.get(
        "/api/applications?q=Target&status=submitted&city=上海&sort=appliedDate&direction=asc&limit=2",
      )
    ).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await (
      await request.get(
        `/api/applications?q=Target&status=submitted&city=上海&sort=appliedDate&direction=asc&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`,
      )
    ).json();
    const combined = [...first.items, ...second.items].map(
      (item: { id: string }) => item.id,
    );
    expect(new Set(combined).size).toBe(combined.length);
    expect(combined).toEqual(
      expect.arrayContaining(ids.filter((_, index) => index % 2 === 0)),
    );
  } finally {
    for (const id of ids) await request.delete(`/api/applications/${id}`);
  }
});

test("默认按最近进展排序，名称排序默认 A 到 Z", async ({ request }) => {
  const ids: string[] = [];
  const create = async (
    status: "submitted" | "offer" | "refused",
    appliedDate: string,
    companyName: string,
  ) => {
    const response = await request.post("/api/applications", {
      data: {
        companyName,
        positionName: "Status Priority Engineer",
        appliedDate,
        status,
      },
    });
    expect(response.ok()).toBe(true);
    const application = await response.json();
    ids.push(application.id);
    return application;
  };

  try {
    const offerEarly = await create(
      "offer",
      "2026-08-01",
      "Status Priority Offer Early",
    );
    const offerLate = await create(
      "offer",
      "2026-08-10",
      "Status Priority Offer Late",
    );
    const submittedWithRecentStage = await create(
      "submitted",
      "2026-08-02",
      "Status Priority Submitted Recent Stage",
    );
    const submittedWithoutStage = await create(
      "submitted",
      "2026-08-17",
      "Status Priority Submitted No Stage",
    );
    const refusedEarly = await create(
      "refused",
      "2026-08-03",
      "Status Priority Refused Early",
    );
    const refusedLate = await create(
      "refused",
      "2026-08-11",
      "Status Priority Refused Late",
    );

    const stageResponse = await request.post(
      `/api/applications/${submittedWithRecentStage.id}/stages`,
      { data: { stage: "screening", occurredOn: "2026-08-18" } },
    );
    expect(stageResponse.ok()).toBe(true);

    const firstResponse = await request.get(
      "/api/applications?q=Status%20Priority&limit=2",
    );
    expect(firstResponse.ok()).toBe(true);
    const first = await firstResponse.json();
    expect(first.items.map((item: { id: string }) => item.id)).toEqual([
      submittedWithRecentStage.id,
      submittedWithoutStage.id,
    ]);
    expect(first.nextCursor).toEqual(expect.any(String));

    const secondResponse = await request.get(
      `/api/applications?q=Status%20Priority&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`,
    );
    expect(secondResponse.ok()).toBe(true);
    const second = await secondResponse.json();
    expect(second.items.map((item: { id: string }) => item.id)).toEqual([
      refusedLate.id,
      offerLate.id,
    ]);
    expect(second.nextCursor).toEqual(expect.any(String));

    const thirdResponse = await request.get(
      `/api/applications?q=Status%20Priority&limit=2&cursor=${encodeURIComponent(second.nextCursor)}`,
    );
    expect(thirdResponse.ok()).toBe(true);
    const third = await thirdResponse.json();
    expect(third.items.map((item: { id: string }) => item.id)).toEqual([
      refusedEarly.id,
      offerEarly.id,
    ]);
    expect(third.nextCursor).toBeNull();

    const customSortResponse = await request.get(
      "/api/applications?q=Status%20Priority&sort=appliedDate&direction=desc&limit=20",
    );
    expect(customSortResponse.ok()).toBe(true);
    const customSort = await customSortResponse.json();
    expect(customSort.items.map((item: { id: string }) => item.id)).toEqual([
      submittedWithoutStage.id,
      refusedLate.id,
      offerLate.id,
      refusedEarly.id,
      submittedWithRecentStage.id,
      offerEarly.id,
    ]);

    const companySortResponse = await request.get(
      "/api/applications?q=Status%20Priority&sort=company&limit=20",
    );
    expect(companySortResponse.ok()).toBe(true);
    const companySort = await companySortResponse.json();
    expect(
      companySort.items.map(
        (item: { companyName: string }) => item.companyName,
      ),
    ).toEqual([
      "Status Priority Offer Early",
      "Status Priority Offer Late",
      "Status Priority Refused Early",
      "Status Priority Refused Late",
      "Status Priority Submitted No Stage",
      "Status Priority Submitted Recent Stage",
    ]);
  } finally {
    for (const id of ids) await request.delete(`/api/applications/${id}`);
  }
});
