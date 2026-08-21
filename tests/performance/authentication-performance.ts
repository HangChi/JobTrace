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
