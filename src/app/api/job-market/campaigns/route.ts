import { listCampaigns } from "@/modules/job-market/application/campaign-service";
import { problemResponse } from "@/shared/http/problem-response";
export async function GET(request: Request) {
  try {
    return Response.json(
      await listCampaigns(new URL(request.url).searchParams),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
