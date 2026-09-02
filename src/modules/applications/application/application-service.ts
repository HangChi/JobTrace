import { Problem } from "@/shared/errors/problem";
import {
  createApplicationSchema,
  stageInputSchema,
  stageUpdateSchema,
  updateApplicationSchema,
  updateApplicationStatusSchema,
} from "../domain/application.schema";
import { PostgresApplicationRepository } from "../infrastructure/postgres-application-repository";
import { parseListQuery } from "./list-query";
import { z } from "zod";
import { requireUser } from "@/modules/identity-access";
import { businessToday } from "@/shared/date/business-date";
import { PostgresInterviewRepository } from "@/modules/interviews/infrastructure/postgres-interview-repository";
import type { ApplicationDialogData } from "./contracts";
const repository = () => new PostgresApplicationRepository();
type DetailTiming = "auth" | "application" | "interviews";
type DetailTimingListener = (name: DetailTiming, durationMs: number) => void;

async function timed<T>(
  name: DetailTiming,
  listener: DetailTimingListener | undefined,
  operation: () => Promise<T>,
) {
  const started = performance.now();
  try {
    return await operation();
  } finally {
    listener?.(name, performance.now() - started);
  }
}
const bulkSelectionSchema = z.object({
  ids: z
    .array(z.uuid("投递记录 ID 格式不正确"))
    .min(1, "请至少选择一条投递记录")
    .max(100, "一次最多处理 100 条投递记录")
    .transform((ids) => [...new Set(ids)]),
});
export async function createApplication(input: unknown) {
  const actor = await requireUser();
  return repository().create(actor.id, createApplicationSchema.parse(input));
}
export async function getApplication(id: string) {
  const actor = await requireUser();
  const value = await repository().get(actor.id, id);
  if (!value) throw new Problem("not_found", "没有找到这条投递记录。", 404);
  return value;
}
export async function getApplicationDialogData(
  id: string,
  onTiming?: DetailTimingListener,
): Promise<ApplicationDialogData> {
  const actor = await timed("auth", onTiming, requireUser);
  const applicationRepository = repository();
  const interviewRepository = new PostgresInterviewRepository();
  const [application, interviews] = await Promise.all([
    timed("application", onTiming, () =>
      applicationRepository.getOverview(actor.id, id),
    ),
    timed("interviews", onTiming, () =>
      interviewRepository.listForApplication(actor.id, id),
    ),
  ]);
  if (!application)
    throw new Problem("not_found", "没有找到这条投递记录。", 404);
  return { application, interviews };
}
export async function updateApplication(id: string, input: unknown) {
  const actor = await requireUser();
  return repository().update(
    actor.id,
    id,
    updateApplicationSchema.parse(input),
  );
}
export async function updateApplicationStatus(id: string, input: unknown) {
  const actor = await requireUser();
  return repository().updateStatus(
    actor.id,
    id,
    updateApplicationStatusSchema.parse(input),
    businessToday(),
  );
}
export async function deleteApplication(id: string) {
  const actor = await requireUser();
  if (!(await repository().delete(actor.id, id)))
    throw new Problem("not_found", "没有找到这条投递记录。", 404);
}
export async function deleteApplications(input: unknown) {
  const actor = await requireUser();
  const { ids } = bulkSelectionSchema.parse(input);
  const deletedCount = await repository().deleteMany(actor.id, ids);
  return { deletedCount };
}
export async function addApplicationStage(id: string, input: unknown) {
  const stage = stageInputSchema.parse(input);
  const actor = await requireUser();
  return repository().addStage(actor.id, id, stage.stage, stage.occurredOn);
}
export async function removeApplicationStage(
  id: string,
  occurrenceId: string,
  input: unknown,
) {
  const { changeDate } = z.object({ changeDate: z.iso.date() }).parse(input);
  const actor = await requireUser();
  return repository().removeStage(actor.id, id, occurrenceId, changeDate);
}
export async function updateApplicationStage(
  id: string,
  occurrenceId: string,
  input: unknown,
) {
  const value = stageUpdateSchema.parse(input);
  const actor = await requireUser();
  return repository().updateStage(
    actor.id,
    id,
    occurrenceId,
    value.stage,
    value.occurredOn,
    value.changeDate,
  );
}
export async function listApplications(params: URLSearchParams) {
  const actor = await requireUser();
  return repository().list(actor.id, parseListQuery(params));
}
