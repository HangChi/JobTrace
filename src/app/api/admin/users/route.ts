import { listUsers } from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
export async function GET(r: Request) {
  try {
    const u = new URL(r.url);
    return Response.json(await listUsers(Object.fromEntries(u.searchParams)));
  } catch (e) {
    return problemResponse(e);
  }
}
