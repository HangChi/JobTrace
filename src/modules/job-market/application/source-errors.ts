export const SOURCE_ERROR_CODES = [
  "source_timeout",
  "source_rate_limited",
  "source_unauthorized",
  "source_forbidden",
  "source_not_found",
  "source_unavailable",
  "unsafe_source_url",
  "response_too_large",
  "unsupported_content_type",
  "invalid_source_payload",
  "pagination_limit",
  "aborted",
] as const;
export type SourceErrorCode = (typeof SOURCE_ERROR_CODES)[number];

export class SourceError extends Error {
  constructor(
    public readonly code: SourceErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message.slice(0, 500));
  }
}

export function safeSourceError(error: unknown) {
  if (error instanceof SourceError)
    return { code: error.code, summary: error.message.slice(0, 500) };
  if (error instanceof DOMException && error.name === "AbortError")
    return { code: "aborted" as const, summary: "Source request aborted" };
  return {
    code: "source_unavailable" as const,
    summary: "Source request failed",
  };
}
