import { expect, test } from "@playwright/test";
import { testDatabase } from "../../setup/database";

const BLOCKER_NAME = "test_block_interview_review_insert";
const LOCK_NAME = "interview-stage-lock-order-test";

for (const operation of ["update", "delete"] as const) {
  test(`review creation and stage ${operation} use a deadlock-safe lock order`, async ({
    request,
  }) => {
    const sql = testDatabase();
    const createSql = testDatabase();
    const stageSql = testDatabase();
    const lockSql = testDatabase();
    const observerSql = testDatabase();
    const applicationResponse = await request.post("/api/applications", {
      data: {
        companyName: `Stage Concurrency ${operation}`,
        positionName: "Engineer",
        appliedDate: "2026-08-01",
        status: "submitted",
      },
    });
    const application = await applicationResponse.json();
    const staged = await (
      await request.post(`/api/applications/${application.id}/stages`, {
        data: { stage: "interview_1", occurredOn: "2026-08-17" },
      })
    ).json();
    const occurrence = staged.stageOccurrences.find(
      (item: { stage: string }) => item.stage === "interview_1",
    );
    const [applicationRow] = await sql<Array<{ ownerId: string }>>`
      select owner_id as "ownerId" from applications where id=${application.id}
    `;
    let releaseInsert = () => {};
    let lockHolder: Promise<unknown> | undefined;

    try {
      await sql.unsafe(`
        create function public.${BLOCKER_NAME}()
        returns trigger language plpgsql as $trigger$
        begin
          perform pg_advisory_xact_lock(hashtextextended('${LOCK_NAME}',0));
          return new;
        end
        $trigger$
      `);
      await sql.unsafe(`
        create trigger ${BLOCKER_NAME}
        before insert on public.interview_reviews
        for each row execute function public.${BLOCKER_NAME}()
      `);

      let confirmInsertLock!: () => void;
      const insertLockHeld = new Promise<void>((resolve) => {
        confirmInsertLock = resolve;
      });
      const releaseGate = new Promise<void>((resolve) => {
        releaseInsert = resolve;
      });
      lockHolder = lockSql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtextextended(${LOCK_NAME},0))`;
        confirmInsertLock();
        await releaseGate;
      });
      await insertLockHeld;

      const createReview = Promise.resolve(
        createSql`
          select id from public.create_interview_review_for_owner(
            ${applicationRow.ownerId},${application.id},${occurrence.id},
            null::recruitment_stage,null::date,'{}'::jsonb
          )
        `,
      );
      let blockedRequests = 0;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const [locks] = await observerSql<Array<{ count: number }>>`
          select count(*)::int as count from pg_locks where not granted
        `;
        blockedRequests = locks.count;
        if (blockedRequests >= 1) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blockedRequests).toBeGreaterThanOrEqual(1);

      const mutateStage = Promise.resolve(
        operation === "update"
          ? stageSql`
              select id from public.update_stage_occurrence_for_owner(
                ${applicationRow.ownerId},${application.id},${occurrence.id},
                'interview_2'::recruitment_stage,'2026-08-18'::date,'2026-08-20'::date
              )
            `
          : stageSql`
              select public.remove_stage_occurrence_for_owner(
                ${applicationRow.ownerId},${application.id},${occurrence.id},'2026-08-20'::date
              )
            `,
      );
      const completions = Promise.allSettled([createReview, mutateStage]);

      for (let attempt = 0; attempt < 50; attempt += 1) {
        const [locks] = await observerSql<Array<{ count: number }>>`
          select count(*)::int as count from pg_locks where not granted
        `;
        blockedRequests = locks.count;
        if (blockedRequests >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blockedRequests).toBeGreaterThanOrEqual(2);

      releaseInsert();
      await lockHolder;
      lockHolder = undefined;
      const results = await completions;
      expect(results.every((result) => result.status === "fulfilled")).toBe(
        true,
      );
      expect(
        await sql`select id from interview_reviews where application_id=${application.id}`,
      ).toHaveLength(1);
    } finally {
      releaseInsert();
      await lockHolder?.catch(() => undefined);
      await sql.unsafe(
        `drop trigger if exists ${BLOCKER_NAME} on public.interview_reviews`,
      );
      await sql.unsafe(`drop function if exists public.${BLOCKER_NAME}()`);
      await request.delete(`/api/applications/${application.id}`);
      await observerSql.end();
      await lockSql.end();
      await stageSql.end();
      await createSql.end();
      await sql.end();
    }
  });
}
