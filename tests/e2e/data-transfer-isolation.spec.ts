import { expect, test } from "@playwright/test";
import {
  cleanupTestUsers,
  createTestUser,
  testDatabase,
  testId,
} from "../setup/database";

test("foreign import batch UUID is hidden", async ({ request }) => {
  const response = await request.post(
    "/api/imports/00000000-0000-0000-0000-000000000000/confirm",
    { data: { decisions: [] } },
  );
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ code: "not_found" });
});

test("所选导出和批量删除不会越过 owner 边界", async ({ request }) => {
  const sql = testDatabase();
  const foreignOwner = testId("bulk-foreign");
  await createTestUser(sql, foreignOwner);
  const ownResponse = await request.post("/api/applications", {
    data: {
      companyName: "Owner Selected Export",
      positionName: "Engineer",
      appliedDate: "2026-08-13",
      status: "submitted",
    },
  });
  expect(ownResponse.status()).toBe(201);
  const own = await ownResponse.json();
  const [foreign] = await sql<{ id: string }[]>`
    select id from public.create_application_for_owner(
      ${foreignOwner},
      ${sql.json({ companyName: "Foreign Selected Export", positionName: "Engineer", appliedDate: "2026-08-13", status: "submitted" })}::jsonb
    )
  `;
  try {
    const exported = await request.get(
      `/api/exports/applications?scope=selected&format=csv&id=${own.id}&id=${foreign.id}`,
    );
    expect(exported.status()).toBe(200);
    const csv = await exported.text();
    expect(csv).toContain("Owner Selected Export");
    expect(csv).not.toContain("Foreign Selected Export");

    const removed = await request.delete("/api/applications", {
      data: { ids: [own.id, foreign.id] },
    });
    expect(removed.status()).toBe(200);
    expect(await removed.json()).toEqual({ deletedCount: 1 });
    expect(
      await sql`select id from applications where id=${foreign.id} and owner_id=${foreignOwner}`,
    ).toHaveLength(1);
  } finally {
    await request.delete(`/api/applications/${own.id}`);
    await cleanupTestUsers(sql, [foreignOwner]);
  }
});
