import { z } from "zod";
import { INTERVIEW_STAGES } from "../domain/catalog";

const publicListSchema = z.object({
  q: z.string().trim().max(200).default(""),
  stage: z.array(z.enum(INTERVIEW_STAGES)).default([]),
  interviewedFrom: z.iso.date().optional(),
  interviewedTo: z.iso.date().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type PublicInterviewListQuery = z.infer<typeof publicListSchema>;

export function parsePublicInterviewListQuery(params: URLSearchParams) {
  return publicListSchema.parse({
    q: params.get("q") ?? "",
    stage: params.getAll("stage").filter((value) => value.length > 0),
    interviewedFrom: params.get("interviewedFrom") || undefined,
    interviewedTo: params.get("interviewedTo") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") ?? 20,
  });
}
