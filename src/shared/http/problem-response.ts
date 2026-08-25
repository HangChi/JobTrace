import { NextResponse } from "next/server";
import { asProblem } from "@/shared/errors/problem";
import { logServerError } from "@/shared/observability/logger";
export function problemResponse(
  error: unknown,
  requestId = crypto.randomUUID(),
) {
  const problem = asProblem(error);
  if (problem.status >= 500) {
    logServerError("http_problem", error, {
      requestId,
      code: problem.code,
      status: problem.status,
    });
  }
  return NextResponse.json(
    {
      code: problem.code,
      message: problem.message,
      requestId,
      fieldErrors: problem.fieldErrors,
      ...problem.details,
    },
    { status: problem.status, headers: { "x-request-id": requestId } },
  );
}
