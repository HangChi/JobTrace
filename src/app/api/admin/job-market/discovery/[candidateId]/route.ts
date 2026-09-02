import { reviewSourceCandidate } from "@/modules/job-market/application/source-discovery-service";
import { problemResponse } from "@/shared/http/problem-response";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(
      await reviewSourceCandidate((await params).candidateId, body),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
