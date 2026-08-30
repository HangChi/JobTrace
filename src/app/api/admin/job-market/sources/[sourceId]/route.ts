import { updateSource } from "@/modules/job-market/application/source-admin-service";
import { problemResponse } from "@/shared/http/problem-response";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    return Response.json(
      await updateSource((await params).sourceId, await request.json()),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
