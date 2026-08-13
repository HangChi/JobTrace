const privateKeys = new Set([
  "notes",
  "jobUrl",
  "file",
  "password",
  "key",
  "token",
]);
export function sanitizeLogContext(context: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(context).filter(
      ([key]) => !privateKeys.has(key) && !/secret|password|token/i.test(key),
    ),
  );
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
