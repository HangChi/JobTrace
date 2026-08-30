import { setCampaignFavorite } from "@/modules/job-market/application/campaign-service";
import { problemResponse } from "@/shared/http/problem-response";
type Context = { params: Promise<{ campaignId: string }> };
export async function PUT(_request: Request, { params }: Context) {
  try {
    return Response.json(
      await setCampaignFavorite((await params).campaignId, true),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
export async function DELETE(_request: Request, { params }: Context) {
  try {
    return Response.json(
      await setCampaignFavorite((await params).campaignId, false),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
