import { revalidatePath } from "next/cache";
import {
  createApplication,
  deleteApplications,
  listApplications,
} from "@/modules/applications";
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
export async function DELETE(request: Request) {
  try {
    const result = await deleteApplications(await request.json());
    revalidatePath("/applications");
    return Response.json(result);
  } catch (error) {
    return problemResponse(error);
  }
}
