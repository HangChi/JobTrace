import { createServerDatabase } from "@/shared/database";
import type {
  AdminJobProgress,
  AdminJobSnapshot,
  AdminJobStore,
} from "../application/admin-jobs";

type AdminJobRow = {
  id: string;
  kind: AdminJobSnapshot["kind"];
  status: AdminJobSnapshot["status"];
  startedAt: Date;
  finishedAt: Date | null;
  progress: AdminJobProgress;
  result: unknown;
  error: string | null;
};

function snapshot(row: AdminJobRow): AdminJobSnapshot {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export class PostgresAdminJobStore implements AdminJobStore {
  private sql = createServerDatabase();

  async claim(
    job: AdminJobSnapshot,
    leaseExpiresAt: Date,
    now: Date,
  ): Promise<boolean> {
    try {
      await this.sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtextextended(
          'job-market-admin-job:' || ${job.kind},0
        ))`;
        await tx`update public.job_market_admin_jobs
          set status='failed',finished_at=${now},lease_expires_at=null,
              error='任务执行进程已中断，请重新运行。'
          where kind=${job.kind} and status='running' and lease_expires_at<=${now}`;
        await tx`insert into public.job_market_admin_jobs(
          id,kind,status,started_at,lease_expires_at,progress,result,error
        ) values(
          ${job.id},${job.kind},'running',${job.startedAt},${leaseExpiresAt},
          ${tx.json(job.progress)},null,null
        )`;
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return false;
      throw error;
    }
  }

  async report(
    id: string,
    progress: Partial<AdminJobProgress>,
    leaseExpiresAt: Date,
  ): Promise<void> {
    await this.sql`update public.job_market_admin_jobs
      set progress=progress || ${this.sql.json(progress)}::jsonb,
          lease_expires_at=${leaseExpiresAt}
      where id=${id} and status='running'`;
  }

  async finish(
    id: string,
    outcome:
      | { status: "succeeded"; result: unknown }
      | { status: "failed"; error: string },
    now: Date,
  ): Promise<void> {
    if (outcome.status === "succeeded") {
      await this.sql`update public.job_market_admin_jobs
        set status='succeeded',result=${this.sql.json(
          (outcome.result ?? null) as never,
        )},
            finished_at=${now},lease_expires_at=null
        where id=${id} and status='running'`;
      return;
    }
    await this.sql`update public.job_market_admin_jobs
      set status='failed',error=${outcome.error},finished_at=${now},
          lease_expires_at=null
      where id=${id} and status='running'`;
  }

  async get(id: string, now: Date): Promise<AdminJobSnapshot | null> {
    await this.sql`update public.job_market_admin_jobs
      set status='failed',finished_at=${now},lease_expires_at=null,
          error='任务执行进程已中断，请重新运行。'
      where id=${id} and status='running' and lease_expires_at<=${now}`;
    const [row] = await this.sql<AdminJobRow[]>`
      select id,kind,status,started_at,finished_at,progress,result,error
      from public.job_market_admin_jobs where id=${id}`;
    return row ? snapshot(row) : null;
  }

  async prune(finishedBefore: Date, maxFinished: number): Promise<void> {
    await this.sql`delete from public.job_market_admin_jobs
      where status<>'running' and finished_at<${finishedBefore}`;
    await this.sql`delete from public.job_market_admin_jobs where id in(
      select id from public.job_market_admin_jobs
      where status<>'running'
      order by started_at desc
      offset ${maxFinished}
    )`;
  }
}
