import { exportApplications } from "@/modules/data-transfer";
import { problemResponse } from "@/shared/http/problem-response";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const format = z
      .enum(["csv", "xlsx"])
      .catch("xlsx")
      .parse(params.get("format"));
    const scope = z
      .enum(["all", "filtered", "selected"])
      .catch("filtered")
      .parse(params.get("scope"));
    const ids = z
      .array(z.uuid("投递记录 ID 格式不正确"))
      .max(100, "一次最多导出 100 条投递记录")
      .parse(params.getAll("id"));
    if (scope === "selected" && ids.length === 0) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["id"],
          message: "请至少选择一条投递记录",
        },
      ]);
    }
    const content = await exportApplications({
      format,
      scope,
      ids,
      q: params.get("q")?.slice(0, 200) || undefined,
      status: params.getAll("status"),
      type: params.getAll("type"),
      city: params.getAll("city"),
      appliedFrom: params.get("appliedFrom") || undefined,
      appliedTo: params.get("appliedTo") || undefined,
    });
    const date = new Date().toISOString().slice(0, 10);
    return new Response(
      format === "csv"
        ? `\uFEFF${String(content)}`
        : new Uint8Array(content as Buffer),
      {
        headers: {
          "content-type":
            format === "csv"
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="jobtrace-${scope === "selected" ? "selected-" : ""}${date}.${format}"`,
        },
      },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
