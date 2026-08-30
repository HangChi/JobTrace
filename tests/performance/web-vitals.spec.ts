import { expect, test } from "@playwright/test";

test("首页布局稳定且首屏预算配置存在", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    h1Count: document.querySelectorAll("h1").length,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.h1Count).toBe(1);
});

test("招聘广场满足 LCP、INP 和 CLS 预算", async ({ page }) => {
  await page.addInitScript(() => {
    const metrics = { lcp: 0, inp: 0, cls: 0 };
    (
      globalThis as typeof globalThis & { __marketVitals: typeof metrics }
    ).__marketVitals = metrics;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) metrics.cls += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        metrics.inp = Math.max(metrics.inp, entry.duration);
    }).observe({ type: "event", buffered: true });
  });
  await page.goto("/");
  await page.getByLabel("关键词").fill("performance interaction");
  await page.getByRole("button", { name: "筛选" }).click();
  await page.waitForLoadState("networkidle");
  const metrics = await page.evaluate(
    () =>
      (
        globalThis as typeof globalThis & {
          __marketVitals: { lcp: number; inp: number; cls: number };
        }
      ).__marketVitals,
  );
  expect(metrics.lcp).toBeLessThanOrEqual(2500);
  expect(metrics.inp).toBeLessThanOrEqual(200);
  expect(metrics.cls).toBeLessThanOrEqual(0.1);
});
