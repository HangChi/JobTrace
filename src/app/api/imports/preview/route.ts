import { previewImport } from "@/modules/data-transfer";
import { Problem } from "@/shared/errors/problem";
import { problemResponse } from "@/shared/http/problem-response";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Problem("validation", "请选择 CSV 或 XLSX 文件。", 400);
    }
    const rawMapping = form.get("mapping");
    let mapping: Record<string, string> | undefined;
    if (typeof rawMapping === "string" && rawMapping) {
      try {
        mapping = z
          .record(z.string(), z.string())
          .parse(JSON.parse(rawMapping));
      } catch {
        throw new Problem("validation", "列映射必须是有效的 JSON 对象。", 400);
      }
    }
    const rawReplaceBatchId = form.get("replaceBatchId");
    const replaceBatchId =
      typeof rawReplaceBatchId === "string" && rawReplaceBatchId
        ? z.uuid().parse(rawReplaceBatchId)
        : undefined;
    return Response.json(await previewImport(file, mapping, replaceBatchId), {
      status: 201,
    });
  } catch (error) {
    return problemResponse(error);
  }
}
