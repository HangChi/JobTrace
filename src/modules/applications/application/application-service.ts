import { Problem } from "@/shared/errors/problem";
import {
  createApplicationSchema,
  stageInputSchema,
  updateApplicationSchema,
} from "../domain/application.schema";
import { PostgresApplicationRepository } from "../infrastructure/postgres-application-repository";
import { parseListQuery } from "./list-query";
import { z } from "zod";
import { requireUser } from "@/modules/identity-access";
const repository = () => new PostgresApplicationRepository();
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
export async function updateApplication(id: string, input: unknown) {
  const actor = await requireUser();
  return repository().update(
    actor.id,
    id,
    updateApplicationSchema.parse(input),
  );
}
export async function deleteApplication(id: string) {
  const actor = await requireUser();
  if (!(await repository().delete(actor.id, id)))
    throw new Problem("not_found", "没有找到这条投递记录。", 404);
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
export async function listApplications(params: URLSearchParams) {
  const actor = await requireUser();
  return repository().list(actor.id, parseListQuery(params));
}
