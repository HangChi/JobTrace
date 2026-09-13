import { listPublicInterviews } from "@/modules/interviews";
import { problemResponse } from "@/shared/http/problem-response";

export async function GET(request: Request) {
  try {
    return Response.json(
      await listPublicInterviews(new URL(request.url).searchParams),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
