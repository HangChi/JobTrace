import {
  listAccountSessions,
  revokeAccountSession,
} from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";

export async function GET() {
  try {
    return Response.json(await listAccountSessions());
  } catch (error) {
    return problemResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown };
    return Response.json(await revokeAccountSession(body.id));
  } catch (error) {
    return problemResponse(error);
  }
}
