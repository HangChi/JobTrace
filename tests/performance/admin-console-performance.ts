import postgres from "postgres";

const { seedAdminConsolePerformance } = await import(
  "./admin-console-seed" + ".ts"
);

function p95(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
}

async function measure(
  name: string,
  maximumMs: number,
  operation: () => Promise<unknown>,
) {
  const timings: number[] = [];
  for (let run = 0; run < 9; run++) {
    const started = performance.now();
    await operation();
    timings.push(performance.now() - started);
  }
  const percentile = p95(timings);
  console.log(`${name}: p95=${percentile.toFixed(2)}ms`);
  if (percentile > maximumMs)
    throw new Error(`${name} exceeds ${maximumMs}ms performance gate`);
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const rollback = new Error("ROLLBACK_ADMIN_CONSOLE_PERFORMANCE");
try {
  await sql.begin(async (tx) => {
    await seedAdminConsolePerformance(tx);
    await measure(
      "admin-summary",
      2000,
      () =>
        tx`select count(*)::int users,count(*) filter(where disabled=false)::int active_users,
        count(*) filter(where role='admin' and disabled=false)::int administrators from users`,
    );
    await measure(
      "admin-user-filter",
      2000,
      () =>
        tx`select id from users where role='user' and disabled=false
        and lower(coalesce(username,'') || ' ' || email) like '%admin_perf_42%'
        order by created_at desc,id desc limit 50`,
    );
    await measure(
      "admin-user-detail",
      2000,
      () =>
        tx`select u.id,(select count(*)::int from applications a where a.owner_id=u.id)
        from users u where u.id='admin-perf-user-00042'`,
    );
    await measure(
      "admin-audit-filter",
      2000,
      () =>
        tx`select id from admin_audit_events where event_type='disable_user' and outcome='conflict'
        order by created_at desc,id desc limit 50`,
    );
    let index = 0;
    await measure("admin-access-change", 1000, () => {
      index += 1;
      return tx`select change_user_access_as(
        'admin-perf-user-00101',${`admin-perf-user-${String(9000 + index).padStart(5, "0")}`},
        ${crypto.randomUUID()}::uuid,1,'disable_user',
        'Performance gate disables an isolated fixture account.',false
      )`;
    });
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await sql.end();
}
