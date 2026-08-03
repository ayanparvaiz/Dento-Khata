import { chromium } from 'playwright';
import fs from 'fs';

const outDir = '/Users/jubair/Documents/devcenter-site/public/projects/images/chinese-wellness';

const browser = await chromium.launch();

// 1) Portrait direct download at high quality
const ctx = await browser.newContext();
const p1 = await ctx.newPage();
const res = await p1.goto('https://chinesewellnesscenter.com/_next/image?url=%2Fbrand%2Fdr_forhad_shamim.jpg&w=1200&q=90');
fs.writeFileSync(`${outDir}/dr-forhad.jpg`, await res.body());

// Also center-banner + treatment room + acupuncture for fragments
const shots = [
  ['home', 'about.jpg'],
  ['services', 'acupuncture.jpg'],
  ['services', 'herbs.jpg'],
];
for (const [folder, file] of shots) {
  const r = await p1.goto(`https://chinesewellnesscenter.com/_next/image?url=%2Fimages%2F${folder}%2F${file}&w=1200&q=90`);
  const buf = await r.body();
  fs.writeFileSync(`${outDir}/${file}`, buf);
}
await p1.close();

// 2) Section screenshots
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('https://chinesewellnesscenter.com', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2000);

await page.screenshot({ path: `${outDir}/hero.png`, clip: { x: 0, y: 0, width: 1440, height: 900 }});

// Scroll to services section
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.28));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/services-section.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

// Scroll to doctor section
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/doctor-section.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.72));
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/opening.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

console.log('done');
await browser.close();
