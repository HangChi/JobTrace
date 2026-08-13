import { listUsers } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
export async function GET(r: Request) {
  try {
    const u = new URL(r.url);
    return Response.json(
      await listUsers(
        Number(u.searchParams.get("page") ?? 1),
        Number(u.searchParams.get("limit") ?? 50),
      ),
    );
  } catch (e) {
    return problemResponse(e);
  }
}
