import { chromium } from '/Users/songhangchi/Project/JobTrace/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const names = [
  'note1-cream-yellow',
  'note1-white-list',
  'note2-dark-code',
  'note2-mint-trace',
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1440 },
  deviceScaleFactor: 2,
});

for (const name of names) {
  await page.goto(`file://${path.join(dir, `${name}.html`)}`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(dir, `${name}-2160x2880.png`) });
  console.log(`exported ${name}-2160x2880.png`);
}

await browser.close();
const sizes = names
  .map((n) => `${fs.statSync(path.join(dir, `${n}-2160x2880.png`)).size / 1024 | 0}KB`)
  .join(', ');
console.log(`sizes: ${sizes}`);
