import { chromium } from 'playwright';

const outDir = '/Users/jubair/Documents/devcenter-site/public/projects/images/code-horizon';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

// Flutter Web is slow to hydrate; try networkidle + extra wait
await page.goto('https://codehorizon-ca68c.firebaseapp.com/#/landingPage', { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('nav:', e.message));
await page.waitForTimeout(6000);
// Try to give the flutter canvas time
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);

await page.screenshot({ path: `${outDir}/hero.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

// scroll and capture more sections
await page.evaluate(() => window.scrollTo(0, 900));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/section-1.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

await page.evaluate(() => window.scrollTo(0, 1800));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/section-2.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

await page.evaluate(() => window.scrollTo(0, 2700));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/section-3.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

await page.evaluate(() => window.scrollTo(0, 3600));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/section-4.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

// full page
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/full.png`, fullPage: true });

console.log('done');
await browser.close();
