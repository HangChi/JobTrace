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
      .enum(["all", "filtered"])
      .catch("filtered")
      .parse(params.get("scope"));
    const content = await exportApplications({
      format,
      scope,
      q: params.get("q")?.slice(0, 200) || undefined,
      status: params.getAll("status"),
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
          "content-disposition": `attachment; filename="jobtrace-${date}.${format}"`,
        },
      },
    );
  } catch (error) {
    return problemResponse(error);
  }
}
