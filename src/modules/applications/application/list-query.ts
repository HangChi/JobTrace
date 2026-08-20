import { z } from "zod";
import {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  RECRUITMENT_STAGES,
} from "../domain/catalog";

export type ListQuery = ReturnType<typeof parseListQuery>;
const sortValues = [
  "company",
  "position",
  "appliedDate",
  "latestDate",
] as const;
export function parseListQuery(params: URLSearchParams) {
  const q = (params.get("q") ?? "").trim().slice(0, 200);
  const sort = z.enum(sortValues).catch("latestDate").parse(params.get("sort"));
  const defaultDirection =
    sort === "company" || sort === "position" ? "asc" : "desc";
  return {
    q: q || undefined,
    status: params
      .getAll("status")
      .filter((v): v is (typeof APPLICATION_STATUSES)[number] =>
        APPLICATION_STATUSES.includes(v as never),
      ),
    type: params
      .getAll("type")
      .filter((v): v is (typeof APPLICATION_TYPES)[number] =>
        APPLICATION_TYPES.includes(v as never),
      ),
    stage: params
      .getAll("stage")
      .filter((v): v is (typeof RECRUITMENT_STAGES)[number] =>
        RECRUITMENT_STAGES.includes(v as never),
      ),
    city: params.getAll("city").map((v) => v.slice(0, 100)),
    appliedFrom: z.iso.date().safeParse(params.get("appliedFrom")).data,
    appliedTo: z.iso.date().safeParse(params.get("appliedTo")).data,
    sort,
    direction: z
      .enum(["asc", "desc"])
      .catch(defaultDirection)
      .parse(params.get("direction")),
    cursor: params.get("cursor") || undefined,
    page: Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1),
    limit: Math.min(
      100,
      Math.max(1, Number.parseInt(params.get("limit") ?? "50", 10) || 50),
    ),
  };
}
