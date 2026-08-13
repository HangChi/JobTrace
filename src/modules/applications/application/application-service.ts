import { Problem } from "@/shared/errors/problem";
import {
  createApplicationSchema,
  stageInputSchema,
  updateApplicationSchema,
} from "../domain/application.schema";
import { PostgresApplicationRepository } from "../infrastructure/postgres-application-repository";
import { parseListQuery } from "./list-query";
import { z } from "zod";
const repository = () => new PostgresApplicationRepository();
export async function createApplication(input: unknown) {
  return repository().create(createApplicationSchema.parse(input));
}
export async function getApplication(id: string) {
  const value = await repository().get(id);
  if (!value) throw new Problem("not_found", "没有找到这条投递记录。", 404);
  return value;
}
export async function updateApplication(id: string, input: unknown) {
  return repository().update(id, updateApplicationSchema.parse(input));
}
export async function deleteApplication(id: string) {
  if (!(await repository().delete(id)))
    throw new Problem("not_found", "没有找到这条投递记录。", 404);
}
export async function addApplicationStage(id: string, input: unknown) {
  const stage = stageInputSchema.parse(input);
  return repository().addStage(id, stage.stage, stage.occurredOn);
}
export async function removeApplicationStage(
  id: string,
  occurrenceId: string,
  input: unknown,
) {
  const { changeDate } = z.object({ changeDate: z.iso.date() }).parse(input);
  return repository().removeStage(id, occurrenceId, changeDate);
}
export async function listApplications(params: URLSearchParams) {
  return repository().list(parseListQuery(params));
}
