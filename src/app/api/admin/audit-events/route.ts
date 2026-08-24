import { listAdminAuditEvents } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return Response.json(
      await listAdminAuditEvents(Object.fromEntries(url.searchParams)),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
