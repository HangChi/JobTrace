import { getApplicationDialogData } from "@/modules/applications";
import { problemResponse } from "@/shared/http/problem-response";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const started = performance.now();
  const timings = new Map<string, number>();
  try {
    const result = await getApplicationDialogData(
      (await params).id,
      (name, durationMs) => timings.set(name, durationMs),
    );
    timings.set("total", performance.now() - started);
    return Response.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": [...timings]
          .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
          .join(", "),
      },
    });
  } catch (error) {
    return problemResponse(error);
  }
}
