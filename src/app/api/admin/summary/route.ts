import { getAdminSummary } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
export async function GET() {
  try {
    return Response.json(await getAdminSummary());
  } catch (e) {
    return problemResponse(e);
  }
}
