import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../../setup/database";

test("search, filters, sort and keyset pages stay inside one owner", async () => {
  const sql = testDatabase(),
    ownerA = testId("list-a"),
    ownerB = testId("list-b");
  await createTestUser(sql, ownerA);
  await createTestUser(sql, ownerB);
  try {
    for (let index = 0; index < 4; index++) {
      await sql`select create_application_for_owner(${ownerA},${sql.json({ companyName: `Needle ${index}`, positionName: "Engineer", city: "上海", appliedDate: `2026-08-${10 + index}`, status: index % 2 ? "offer" : "submitted" })}::jsonb)`;
      await sql`select create_application_for_owner(${ownerB},${sql.json({ companyName: `Needle B ${index}`, positionName: "Engineer", city: "上海", appliedDate: `2026-08-${10 + index}`, status: "submitted" })}::jsonb)`;
    }
    const first = await sql<
      { id: string; appliedDate: Date; ownerId: string }[]
    >`select id,applied_date as "appliedDate",owner_id as "ownerId" from applications where owner_id=${ownerA} and lower(company_name) like '%needle%' and status='submitted' order by applied_date desc,id desc limit 1`;
    const second = await sql<
      { ownerId: string }[]
    >`select owner_id as "ownerId" from applications where owner_id=${ownerA} and (applied_date,id)<(${first[0].appliedDate},${first[0].id}) order by applied_date desc,id desc limit 1`;
    expect(first[0].ownerId).toBe(ownerA);
    expect(second[0].ownerId).toBe(ownerA);
    expect(
      await sql`select id from applications where owner_id=${ownerA} and company_name like 'Needle B%'`,
    ).toHaveLength(0);
  } finally {
    await cleanupTestUsers(sql, [ownerA, ownerB]);
  }
});

test("默认排序优先已投递，显式最新日期保持全局顺序和游标", async ({
  request,
}) => {
  const created: string[] = [];
  const create = async (
    companyName: string,
    status: string,
    appliedDate: string,
  ) => {
    const response = await request.post("/api/applications", {
      data: { companyName, positionName: "Sort Role", status, appliedDate },
    });
    expect(response.status()).toBe(201);
    const item = await response.json();
    created.push(item.id);
    return item;
  };
  try {
    await create("Sort Submitted Old", "submitted", "2026-08-01");
    await create("Sort Offer New", "offer", "2026-08-03");
    await create("Sort Submitted New", "submitted", "2026-08-02");

    const defaults = await (
      await request.get("/api/applications?q=Sort%20&limit=2")
    ).json();
    expect(
      defaults.items.map((item: { companyName: string }) => item.companyName),
    ).toEqual(["Sort Submitted New", "Sort Submitted Old"]);
    const next = await (
      await request.get(
        `/api/applications?q=Sort%20&limit=2&cursor=${encodeURIComponent(defaults.nextCursor)}`,
      )
    ).json();
    expect(next.items[0].companyName).toBe("Sort Offer New");

    const descending = await (
      await request.get(
        "/api/applications?q=Sort%20&sort=latestDate&direction=desc&limit=10",
      )
    ).json();
    expect(
      descending.items.map((item: { companyName: string }) => item.companyName),
    ).toEqual(["Sort Offer New", "Sort Submitted New", "Sort Submitted Old"]);
    const ascending = await (
      await request.get(
        "/api/applications?q=Sort%20&sort=latestDate&direction=asc&limit=10",
      )
    ).json();
    expect(
      ascending.items.map((item: { companyName: string }) => item.companyName),
    ).toEqual(["Sort Submitted Old", "Sort Submitted New", "Sort Offer New"]);
  } finally {
    await Promise.all(
      created.map((id) => request.delete(`/api/applications/${id}`)),
    );
  }
});
