import { chromium } from '/Users/songhangchi/Project/JobTrace/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };

// ---- 1. DOM 断言：文本内容 + 元素不溢出画布 + 关键行不换行 ----
const checks = [
  ['note1-cream-yellow', '.num', '100+', '.l2'],
  ['note1-white-list', '.l1', '秋招投到 100+ 家才发现', '.l1'],
  ['note2-dark-code', '.term .line:nth-child(2) b', '100+', '.term .line:nth-child(2)'],
];
for (const [name, sel, expectText, boxSel] of checks) {
  await page.goto(`file://${path.join(dir, `${name}.html`)}`);
  const el = page.locator(sel).first();
  const text = await el.textContent();
  if (text.trim() !== expectText) fail(`${name}: <${sel}> 文本 "${text.trim()}" ≠ "${expectText}"`);
  const box = await page.locator(boxSel).first().boundingBox();
  if (!box) { fail(`${name}: ${boxSel} 不存在`); continue; }
  if (box.x < 0 || box.y < 0 || box.x + box.width > 1080 || box.y + box.height > 1440)
    fail(`${name}: ${boxSel} 溢出画布 x=${box.x.toFixed(0)} w=${box.width.toFixed(0)}`);
  console.log(`${name}: "${text.trim()}" box=${box.width.toFixed(0)}x${box.height.toFixed(0)} @(${box.x.toFixed(0)},${box.y.toFixed(0)})`);
}

// 单行验证：行高应约等于字号（换行会使高度翻倍）
await page.goto(`file://${path.join(dir, 'note1-cream-yellow.html')}`);
const l3h = (await page.locator('.l3').first().boundingBox()).height;
if (l3h > 200) fail(`cream-yellow: .l3 疑似换行 h=${l3h}`);
await page.goto(`file://${path.join(dir, 'note1-white-list.html')}`);
const wlh = (await page.locator('.l1').first().boundingBox()).height;
if (wlh > 110) fail(`white-list: .l1 疑似换行 h=${wlh}`);

// ---- 2. PNG 像素验证：只采样大数字本体区（DOM .l2 box y 539-813 → 设备 1078-1626）----
// 新版 "100+"@260px：宽 ~628 高 ~186；旧版 "87"@400px：宽 ~480 高 ~286
const png = fs.readFileSync(path.join(dir, 'note1-cream-yellow-2160x2880.png'));
await page.goto('about:blank');
const span = await page.evaluate(async (bytes) => {
  const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const ctx = c.getContext('2d');
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = 1100; y < 1600; y += 2) {
    for (let x = 0; x < c.width; x += 2) {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      if (r > 200 && g < 90 && b < 110) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : {
    minX: minX / 2, maxX: maxX / 2, minY: minY / 2, maxY: maxY / 2,
    w: (maxX - minX) / 2, h: (maxY - minY) / 2,
  };
}, [...png]);
if (!span) fail('PNG 数字区未找到红色像素');
else {
  console.log(`PNG 红色数字本体: 宽 ${span.w.toFixed(0)}px 高 ${span.h.toFixed(0)}px`);
  if (span.w > 560 && span.h < 240) console.log('PASS: 符合 "100+"@260px 版（旧 "87"@400px 为宽~480 高~286）');
  else if (span.w < 520 && span.h > 250) fail('PNG 符合旧 "87" 版，导出的不是新图');
  else fail(`PNG 数字尺寸异常: 宽${span.w} 高${span.h}`);
}

// ---- 3. 铁证：本地重截图与磁盘 PNG 逐像素采样比对 ----
const page2 = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 2 });
await page2.goto(`file://${path.join(dir, 'note1-cream-yellow.html')}`);
const fresh = await page2.screenshot();
const same = await page.evaluate(async ([a, b]) => {
  const load = async (bytes) => {
    const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return c;
  };
  const [ca, cb] = await Promise.all([load(a), load(b)]);
  if (ca.width !== cb.width || ca.height !== cb.height) return { err: `尺寸不同 ${ca.width}x${ca.height} vs ${cb.width}x${cb.height}` };
  const da = ca.getContext('2d').getImageData(0, 0, ca.width, ca.height).data;
  const db = cb.getContext('2d').getImageData(0, 0, cb.width, cb.height).data;
  let diff = 0, n = 0;
  for (let i = 0; i < da.length; i += 4 * 37) { n++; if (Math.abs(da[i] - db[i]) > 16) diff++; }
  return { diffRate: diff / n };
}, [[...fresh], [...png]]);
if (same.err) fail(`重截图与导出 PNG ${same.err}`);
else if (same.diffRate < 0.01) console.log(`PASS: 重截图与导出 PNG 像素一致（差异率 ${(same.diffRate * 100).toFixed(2)}%）`);
else fail(`重截图与导出 PNG 差异率 ${(same.diffRate * 100).toFixed(2)}% 过高`);

await browser.close();
console.log(process.exitCode ? 'VERIFY FAILED' : 'ALL PASS');
