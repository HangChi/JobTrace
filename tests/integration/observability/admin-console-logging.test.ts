import { expect, test } from "@playwright/test";
import { logServerEvent } from "@/shared/observability/logger";

test("admin operation logs retain safe identifiers and omit private input", () => {
  const original = console.info;
  let output = "";
  console.info = (value) => {
    output = String(value);
  };
  try {
    logServerEvent("admin.access_change", {
      requestId: "request-1",
      actorId: "actor-1",
      targetId: "target-1",
      action: "disable_user",
      outcome: "succeeded",
      code: null,
      durationMs: 18,
    });
  } finally {
    console.info = original;
  }
  expect(JSON.parse(output)).toMatchObject({
    operation: "admin.access_change",
    requestId: "request-1",
    actorId: "actor-1",
    targetId: "target-1",
    action: "disable_user",
    outcome: "succeeded",
    durationMs: 18,
  });
  expect(output).not.toMatch(
    /reason|email|cookie|session|ipAddress|userAgent|search|notes|interviewer/i,
  );
});
