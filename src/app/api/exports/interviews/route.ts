import { z } from "zod";
import { exportInterviews } from "@/modules/data-transfer";
import { problemResponse } from "@/shared/http/problem-response";

function contentDisposition(filename: string) {
  const fallback = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request) {
  try {
    const ids = z
      .array(z.uuid("面经 ID 格式不正确"))
      .min(1, "请至少选择一篇面经")
      .max(100, "一次最多导出 100 篇面经")
      .transform((values) => [...new Set(values)])
      .parse(new URL(request.url).searchParams.getAll("id"));
    const exported = await exportInterviews(ids);
    return new Response(new Uint8Array(exported.content), {
      headers: {
        "content-type":
          exported.kind === "markdown"
            ? "text/markdown; charset=utf-8"
            : "application/zip",
        "content-disposition": contentDisposition(exported.filename),
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return problemResponse(error);
  }
}
