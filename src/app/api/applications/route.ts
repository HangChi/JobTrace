import { createApplication, listApplications } from "@/modules/applications";
import { problemResponse } from "@/shared/http/problem-response";
export async function GET(request: Request) {
  try {
    return Response.json(
      await listApplications(new URL(request.url).searchParams),
    );
  } catch (error) {
    return problemResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    return Response.json(await createApplication(await request.json()), {
      status: 201,
    });
  } catch (error) {
    return problemResponse(error);
  }
}
