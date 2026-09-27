import { requireUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import { createServerDatabase } from "@/shared/database";

export async function completeProgressReminder(stageOccurrenceId: string) {
  return resolveProgressReminder(stageOccurrenceId, "completed");
}

export async function resolveProgressReminder(
  stageOccurrenceId: string,
  resolution: "completed" | "dismissed",
) {
  const actor = await requireUser();
  const sql = createServerDatabase();
  const rows = await sql<{ id: string }[]>`
    insert into public.progress_reminder_completions(
      owner_id, stage_occurrence_id, resolution
    )
    select ${actor.id}, s.id, ${resolution}
    from public.application_stage_occurrences s
    join public.applications a on a.id = s.application_id
    where s.id = ${stageOccurrenceId}
      and a.owner_id = ${actor.id}
      and a.status = 'submitted'
    on conflict (owner_id, stage_occurrence_id) do update set
      resolution=excluded.resolution, reminder_id=null, updated_at=now()
    returning id
  `;
  if (!rows.length) {
    throw new Problem("not_found", "没有找到这条待处理进展。", 404);
  }
  return { resolved: true, resolution };
}
