import { requireUser } from "@/modules/identity-access";
import { Problem } from "@/shared/errors/problem";
import { validateCompletion } from "../domain/interview";
import {
  createInterviewSchema,
  updateInterviewSchema,
} from "../domain/interview.schema";
import { PostgresInterviewRepository } from "../infrastructure/postgres-interview-repository";
import { parseInterviewListQuery } from "./list-query";
import { parsePublicInterviewListQuery } from "./public-list-query";
import { z } from "zod";

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
    throw new Problem("validation", "请先填写面经内容，再完成复盘。", 400);
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

export async function listPublicInterviews(params: URLSearchParams) {
  const actor = await requireUser();
  return repository().listPublic(
    actor.id,
    parsePublicInterviewListQuery(params),
  );
}

export async function getPublicInterview(id: string) {
  const actor = await requireUser();
  const value = await repository().getPublic(actor.id, id);
  if (!value) throw new Problem("not_found", "没有找到这篇公开面经。", 404);
  return value;
}

export async function togglePublicInterviewLike(id: string) {
  const actor = await requireUser();
  const value = await repository().togglePublicLike(actor.id, id);
  if (!value) throw new Problem("not_found", "没有找到这篇公开面经。", 404);
  return value;
}

const commentSchema = z.object({ content: z.string().trim().min(1).max(1000) });

export async function addPublicInterviewComment(id: string, input: unknown) {
  const actor = await requireUser();
  const { content } = commentSchema.parse(input);
  const value = await repository().addPublicComment(actor.id, id, content);
  if (!value) throw new Problem("not_found", "没有找到这篇公开面经。", 404);
  return value;
}

export async function listPublicInterviewComments(id: string) {
  const actor = await requireUser();
  const value = await repository().listPublicComments(actor.id, id);
  if (!value) throw new Problem("not_found", "没有找到这篇公开面经。", 404);
  return value;
}
