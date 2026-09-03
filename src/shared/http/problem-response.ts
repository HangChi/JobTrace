import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { asProblem } from "@/shared/errors/problem";
import { logServerError } from "@/shared/observability/logger";
export async function problemResponse(error: unknown, requestId?: string) {
  const resolvedRequestId =
    requestId ?? (await headers()).get("x-request-id") ?? crypto.randomUUID();
  const problem = asProblem(error);
  if (problem.status >= 500) {
    logServerError("http_problem", error, {
      requestId: resolvedRequestId,
      code: problem.code,
      status: problem.status,
    });
  }
  return NextResponse.json(
    {
      code: problem.code,
      message: problem.message,
      requestId: resolvedRequestId,
      fieldErrors: problem.fieldErrors,
      ...problem.details,
    },
    {
      status: problem.status,
      headers: { "x-request-id": resolvedRequestId },
    },
  );
}
