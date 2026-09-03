import { listDefaultSourceCatalogPage } from "@/modules/job-market";
import { problemResponse } from "@/shared/http/problem-response";

export async function GET(request: Request) {
  try {
    return Response.json(
      await listDefaultSourceCatalogPage(new URL(request.url).searchParams),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
