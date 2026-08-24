import {
  changeManagedUserAccess,
  getManagedUserDetail,
} from "@/modules/identity-access";
import { problemResponse } from "@/shared/http/problem-response";
import { assertSameOrigin } from "@/shared/http/request-security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const url = new URL(request.url);
    return Response.json(
      await getManagedUserDetail(
        (await params).id,
        Object.fromEntries(url.searchParams),
      ),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
export async function PATCH(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(r);
    return Response.json(
      await changeManagedUserAccess((await params).id, await r.json()),
    );
  } catch (e) {
    return problemResponse(e);
  }
}
