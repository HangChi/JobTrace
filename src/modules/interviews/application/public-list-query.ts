import { z } from "zod";

const publicListSchema = z.object({
  q: z.string().trim().max(200).default(""),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type PublicInterviewListQuery = z.infer<typeof publicListSchema>;

export function parsePublicInterviewListQuery(params: URLSearchParams) {
  return publicListSchema.parse({
    q: params.get("q") ?? "",
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") ?? 20,
  });
}
