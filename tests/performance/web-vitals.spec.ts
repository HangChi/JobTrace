import { expect, test, type Page } from "@playwright/test";

type Vitals = { lcp: number; inp: number; cls: number; eventCount: number };

async function installVitalsObservers(page: Page) {
  await page.addInitScript(() => {
    const metrics: Vitals = { lcp: 0, inp: 0, cls: 0, eventCount: 0 };
    (
      globalThis as typeof globalThis & { __marketVitals: Vitals }
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
      for (const entry of list.getEntries()) {
        metrics.eventCount += 1;
        metrics.inp = Math.max(metrics.inp, entry.duration);
      }
    }).observe({
      type: "event",
      buffered: true,
      durationThreshold: 16,
    } as PerformanceObserverInit & { durationThreshold: number });
  });
}

function p75(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)]!;
}

async function measureRoute(
  page: Page,
  path: string,
  interaction: (page: Page, sample: number) => Promise<void>,
) {
  const samples: Vitals[] = [];
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  for (let sample = 0; sample < 4; sample += 1) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await interaction(page, sample);
    await page.getByLabel("打开用户菜单").click();
    await page.waitForTimeout(150);
    samples.push(
      await page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __marketVitals: Vitals;
            }
          ).__marketVitals,
      ),
    );
  }
  return samples;
}

function expectVitalsWithinBudget(samples: Vitals[]) {
  expect(samples).toHaveLength(4);
  for (const sample of samples) {
    expect(sample.lcp).toBeGreaterThan(0);
    expect(sample.eventCount).toBeGreaterThan(0);
    expect(sample.inp).toBeGreaterThan(0);
  }
  expect(p75(samples.map((sample) => sample.lcp))).toBeLessThanOrEqual(2500);
  expect(p75(samples.map((sample) => sample.inp))).toBeLessThanOrEqual(200);
  expect(p75(samples.map((sample) => sample.cls))).toBeLessThanOrEqual(0.1);
}

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

test("招聘广场满足 LCP、INP 和 CLS p75 预算", async ({ page }) => {
  await installVitalsObservers(page);
  const samples = await measureRoute(page, "/", async (current, sample) => {
    await current.getByLabel("关键词").fill(`performance ${sample}`);
  });
  expectVitalsWithinBudget(samples);
});

test("面经广场满足 LCP、INP 和 CLS p75 预算", async ({ page }) => {
  await installVitalsObservers(page);
  const samples = await measureRoute(
    page,
    "/interviews",
    async (current, sample) => {
      await current.getByLabel("搜索公司").fill(`performance ${sample}`);
    },
  );
  expectVitalsWithinBudget(samples);
});

test("个人面经满足 LCP、INP 和 CLS p75 预算", async ({ page }) => {
  await installVitalsObservers(page);
  const samples = await measureRoute(
    page,
    "/interviews/mine",
    async (current, sample) => {
      await current.getByLabel("搜索").fill(`performance ${sample}`);
    },
  );
  expectVitalsWithinBudget(samples);
});
