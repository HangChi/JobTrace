import { confirmImport } from "@/modules/data-transfer";
import { Problem } from "@/shared/errors/problem";
import { problemResponse } from "@/shared/http/problem-response";
import { z } from "zod";

const inputSchema = z.object({
  decisions: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        action: z.enum(["import", "skip"]),
      }),
    )
    .max(10000),
});
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const id = (await params).id;
    if (!z.uuid().safeParse(id).success)
      throw new Problem("validation", "导入批次 ID 无效。", 400);
    const body = inputSchema.parse(await request.json());
    return Response.json(await confirmImport(id, body.decisions));
  } catch (error) {
    return problemResponse(error);
  }
}
