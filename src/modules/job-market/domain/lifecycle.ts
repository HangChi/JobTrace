import type { PostStatus } from "./entities";

export function nextPostLifecycle(input: {
  current: PostStatus;
  observed: boolean;
  explicitClosed?: boolean;
  validThrough?: Date | null;
  runComplete: boolean;
  now: Date;
  lastMissingSuccessAt?: Date | null;
}) {
  if (input.observed) {
    return {
      status: "open" as const,
      event: input.current === "open" ? null : ("reopened" as const),
    };
  }
  if (
    input.explicitClosed ||
    (input.validThrough && input.validThrough.getTime() < input.now.getTime())
  ) {
    return {
      status: "closed" as const,
      event: input.current === "closed" ? null : ("closed" as const),
    };
  }
  if (!input.runComplete) return { status: input.current, event: null };
  const confirmedAgain =
    input.lastMissingSuccessAt &&
    input.now.getTime() - input.lastMissingSuccessAt.getTime() >=
      6 * 60 * 60 * 1000;
  if (input.current === "stale" && confirmedAgain)
    return { status: "closed" as const, event: "closed" as const };
  if (input.current === "open")
    return { status: "stale" as const, event: "stale" as const };
  return { status: input.current, event: null };
}

export function campaignStatus(statuses: PostStatus[]): PostStatus {
  if (statuses.includes("open")) return "open";
  if (statuses.includes("stale")) return "stale";
  return "closed";
}
