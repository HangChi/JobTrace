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
          status: "active",
        },
      });
      ids.push((await response.json()).id);
    }
    const first = await (
      await request.get(
        "/api/applications?q=Target&status=active&city=上海&sort=appliedDate&direction=asc&limit=2",
      )
    ).json();
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await (
      await request.get(
        `/api/applications?q=Target&status=active&city=上海&sort=appliedDate&direction=asc&limit=2&cursor=${encodeURIComponent(first.nextCursor)}`,
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
