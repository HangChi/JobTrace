import { requireUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import { validateCompletion } from "../domain/interview";
import {
  createInterviewSchema,
  updateInterviewSchema,
} from "../domain/interview.schema";
import { PostgresInterviewRepository } from "../infrastructure/postgres-interview-repository";
import { parseInterviewListQuery } from "./list-query";

const repository = () => new PostgresInterviewRepository();

export async function createInterview(input: unknown) {
  const actor = await requireUser();
  return repository().create(actor.id, createInterviewSchema.parse(input));
}
export async function getInterview(id: string) {
  const actor = await requireUser();
  const value = await repository().get(actor.id, id);
  if (!value) throw new Problem("not_found", "没有找到这篇面经。", 404);
  return value;
}
export async function updateInterview(id: string, input: unknown) {
  const actor = await requireUser();
  const value = updateInterviewSchema.parse(input);
  if (!validateCompletion(value)) {
    throw new Problem(
      "validation",
      "至少记录一个问题，并补充改进内容或行动项。",
      400,
    );
  }
  return repository().update(actor.id, id, value);
}
export async function deleteInterview(id: string) {
  const actor = await requireUser();
  if (!(await repository().delete(actor.id, id)))
    throw new Problem("not_found", "没有找到这篇面经。", 404);
}
export async function listInterviews(params: URLSearchParams) {
  const actor = await requireUser();
  return repository().list(actor.id, parseInterviewListQuery(params));
}
export async function listApplicationInterviews(applicationId: string) {
  const actor = await requireUser();
  return repository().listForApplication(actor.id, applicationId);
}
