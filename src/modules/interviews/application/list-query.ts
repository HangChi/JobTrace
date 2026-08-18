import { z } from "zod";
import {
  INTERVIEW_STAGES,
  REVIEW_STATUSES,
  ROUND_RESULTS,
} from "../domain/catalog";

const schema = z.object({
  applicationId: z.uuid().optional(),
  q: z.string().trim().max(200).default(""),
  status: z.array(z.enum(REVIEW_STATUSES)).default([]),
  stage: z.array(z.enum(INTERVIEW_STAGES)).default([]),
  result: z.array(z.enum(ROUND_RESULTS)).default([]),
  interviewedFrom: z.iso.date().optional(),
  interviewedTo: z.iso.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type InterviewListQuery = z.infer<typeof schema>;

export function parseInterviewListQuery(
  params: URLSearchParams,
): InterviewListQuery {
  return schema.parse({
    q: params.get("q") ?? "",
    applicationId: params.get("applicationId") || undefined,
    status: params.getAll("status"),
    stage: params.getAll("stage"),
    result: params.getAll("result"),
    interviewedFrom: params.get("interviewedFrom") || undefined,
    interviewedTo: params.get("interviewedTo") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") ?? 50,
  });
}
