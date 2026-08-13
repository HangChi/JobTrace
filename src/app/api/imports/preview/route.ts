import { previewImport } from "@/modules/data-transfer";
import { Problem } from "@/shared/errors/problem";
import { problemResponse } from "@/shared/http/problem-response";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Problem("validation", "请选择 CSV 或 XLSX 文件。", 400);
    }
    return Response.json(await previewImport(file), { status: 201 });
  } catch (error) {
    return problemResponse(error);
  }
}
