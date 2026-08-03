import { chromium } from 'playwright';

const outDir = '/Users/jubair/Documents/devcenter-site/public/projects/images/code-horizon';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto('https://codehorizon-ca68c.firebaseapp.com/#/landingPage', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(5000);

// Click "Reporting Dashboard" suggestion to fill prompt
await page.getByText('Reporting Dashboard', { exact: true }).click().catch(e => console.log('rep click:', e.message));
await page.waitForTimeout(2000);
await page.screenshot({ path: `${outDir}/prompt-filled.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

// Refresh and try Product dropdown
await page.goto('https://codehorizon-ca68c.firebaseapp.com/#/landingPage', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(4000);
await page.getByText('Product', { exact: true }).hover().catch(() => {});
await page.getByText('Product', { exact: true }).click().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/product-menu.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

console.log('done');
await browser.close();
