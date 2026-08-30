import { expect, test } from "@playwright/test";

function p95(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length * 0.95)];
}

test("username login and role routing p95 stay below one second", async ({
  playwright,
  baseURL,
}) => {
  const username = `perf_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const password = "Performance123!";
  const setup = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL! },
  });
  expect(
    (
      await setup.post("/api/auth/register", { data: { username, password } })
    ).status(),
  ).toBe(202);
  const timings: number[] = [];
  for (let index = 0; index < 9; index++) {
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { origin: baseURL! },
    });
    const started = performance.now();
    const response = await context.post("/api/auth/login", {
      data: { username, password },
    });
    timings.push(performance.now() - started);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ redirectTarget: "/" });
    await context.dispose();
  }
  expect(p95(timings)).toBeLessThanOrEqual(1000);
  await setup.dispose();
});

test("authenticated application detail p95 stays below one second", async ({
  playwright,
  baseURL,
}) => {
  const username = `detail_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const password = "Performance123!";
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL!,
      "x-forwarded-for": "198.51.100.217",
    },
  });
  expect(
    (
      await context.post("/api/auth/register", { data: { username, password } })
    ).status(),
  ).toBe(202);
  expect(
    (
      await context.post("/api/auth/login", {
        data: { username, password },
      })
    ).status(),
  ).toBe(200);
  const created = await context.post("/api/applications", {
    data: {
      companyName: "Detail Performance",
      positionName: "Engineer",
      appliedDate: "2026-08-13",
      status: "submitted",
    },
  });
  expect(created.status()).toBe(201);
  const application = await created.json();
  try {
    const timings: number[] = [];
    for (let index = 0; index < 9; index++) {
      const started = performance.now();
      const response = await context.get(
        `/api/applications/${application.id}/detail`,
      );
      timings.push(performance.now() - started);
      expect(response.status()).toBe(200);
      expect(response.headers()["server-timing"]).toContain("total;dur=");
      expect(await response.json()).toMatchObject({
        application: { id: application.id },
        interviews: [],
      });
    }
    expect(p95(timings)).toBeLessThanOrEqual(1000);
  } finally {
    await context.delete(`/api/applications/${application.id}`);
    await context.dispose();
  }
});
