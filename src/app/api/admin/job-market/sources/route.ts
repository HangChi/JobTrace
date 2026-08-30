import {
  listSourceHealth,
  registerSource,
} from "@/modules/job-market/application/source-admin-service";
import { problemResponse } from "@/shared/http/problem-response";
export async function GET() {
  try {
    return Response.json(await listSourceHealth());
  } catch (error) {
    return problemResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    return Response.json(await registerSource(await request.json()), {
      status: 201,
    });
  } catch (error) {
    return problemResponse(error);
  }
}
