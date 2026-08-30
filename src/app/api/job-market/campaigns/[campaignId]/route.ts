import { getCampaign } from "@/modules/job-market/application/campaign-service";
import { problemResponse } from "@/shared/http/problem-response";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    return Response.json(await getCampaign((await params).campaignId));
  } catch (error) {
    return problemResponse(error);
  }
}
