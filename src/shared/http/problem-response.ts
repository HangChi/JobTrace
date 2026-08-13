import { NextResponse } from "next/server";
import { asProblem } from "@/shared/errors/problem";
export function problemResponse(
  error: unknown,
  requestId = crypto.randomUUID(),
) {
  const problem = asProblem(error);
  return NextResponse.json(
    {
      code: problem.code,
      message: problem.message,
      requestId,
      fieldErrors: problem.fieldErrors,
    },
    { status: problem.status, headers: { "x-request-id": requestId } },
  );
}
