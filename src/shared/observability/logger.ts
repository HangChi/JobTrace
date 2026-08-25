const privateKeys = new Set([
  "notes",
  "jobUrl",
  "file",
  "password",
  "key",
  "token",
  "cookie",
  "authorization",
  "session",
]);

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value))
    return value.map((item) => sanitizeValue(item, seen));
  if (value instanceof Date) return value.toISOString();
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      privateKeys.has(key) ||
      /secret|password|token|cookie|authorization|session/i.test(key)
        ? []
        : [[key, sanitizeValue(child, seen)]],
    ),
  );
}

export function sanitizeLogContext(context: Record<string, unknown>) {
  return sanitizeValue(context, new WeakSet()) as Record<string, unknown>;
}
export function logServerEvent(
  operation: string,
  context: Record<string, unknown> = {},
) {
  console.info(
    JSON.stringify({
      level: "info",
      operation,
      ...sanitizeLogContext(context),
      at: new Date().toISOString(),
    }),
  );
}

export function logServerError(
  operation: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const errorType =
    error instanceof Error ? error.constructor.name : typeof error;
  console.error(
    JSON.stringify({
      level: "error",
      operation,
      errorType,
      ...sanitizeLogContext(context),
      at: new Date().toISOString(),
    }),
  );
}
