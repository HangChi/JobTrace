import { expect, test } from "@playwright/test";
import { testDatabase } from "../../setup/database";

async function attemptCode(email: string, submittedHash: string) {
  const sql = testDatabase();
  try {
    return await sql<Array<{ code_id: string; matched: boolean }>>`
      select code_id,matched
      from public.verify_email_code_attempt(
        ${email},'registration',null,${submittedHash}
      )
    `;
  } finally {
    await sql.end();
  }
}

test("concurrent invalid attempts cannot exceed the five-attempt limit", async () => {
  const sql = testDatabase();
  const email = `attempt-limit-${crypto.randomUUID()}@example.test`;
  try {
    const [verification] = await sql<Array<{ id: string }>>`
      insert into public.email_verification_codes(
        email,purpose,code_hash,expires_at
      ) values(${email},'registration',${"a".repeat(64)},now()+interval '10 minutes')
      returning id
    `;

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        attemptCode(email, index.toString(16).padStart(64, "0")),
      ),
    );

    expect(results.filter((rows) => rows[0]?.matched === false)).toHaveLength(
      5,
    );
    expect(results.filter((rows) => rows.length === 0)).toHaveLength(7);
    await expect
      .poll(async () => {
        const [row] = await sql<Array<{ attempt_count: number }>>`
          select attempt_count from public.email_verification_codes
          where id=${verification.id}
        `;
        return row.attempt_count;
      })
      .toBe(5);
  } finally {
    await sql`delete from public.email_verification_codes where email=${email}`;
    await sql.end();
  }
});

test("a valid code can be consumed by only one concurrent request", async () => {
  const sql = testDatabase();
  const email = `single-use-${crypto.randomUUID()}@example.test`;
  const correctHash = "b".repeat(64);
  try {
    const [verification] = await sql<Array<{ id: string }>>`
      insert into public.email_verification_codes(
        email,purpose,code_hash,expires_at
      ) values(${email},'registration',${correctHash},now()+interval '10 minutes')
      returning id
    `;

    const results = await Promise.all(
      Array.from({ length: 8 }, () => attemptCode(email, correctHash)),
    );

    expect(results.filter((rows) => rows[0]?.matched === true)).toHaveLength(1);
    expect(results.filter((rows) => rows.length === 0)).toHaveLength(7);
    const [row] = await sql<
      Array<{ consumed: boolean; attempt_count: number }>
    >`
      select consumed_at is not null as consumed,attempt_count
      from public.email_verification_codes where id=${verification.id}
    `;
    expect(row).toEqual({ consumed: true, attempt_count: 0 });
  } finally {
    await sql`delete from public.email_verification_codes where email=${email}`;
    await sql.end();
  }
});
