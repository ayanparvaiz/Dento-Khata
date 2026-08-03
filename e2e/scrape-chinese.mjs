import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.goto('https://chinesewellnesscenter.com', { waitUntil: 'networkidle', timeout: 45000 }).catch(e => console.log('nav err', e.message));

await page.waitForTimeout(2500);

const outDir = '/Users/jubair/Documents/devcenter-site/public/projects/images/chinese-wellness';
await page.screenshot({ path: `${outDir}/home-full.png`, fullPage: true });
await page.screenshot({ path: `${outDir}/home-viewport.png` });

const title = await page.title();
console.log('TITLE:', title);

const info = await page.evaluate(() => ({
  desc: document.querySelector('meta[name="description"]')?.content || '',
  h1: [...document.querySelectorAll('h1')].map(h=>h.innerText).slice(0,3),
  h2: [...document.querySelectorAll('h2')].map(h=>h.innerText).slice(0,10),
  h3: [...document.querySelectorAll('h3')].map(h=>h.innerText).slice(0,15),
  images: [...document.querySelectorAll('img')].map(i => ({src: i.src, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight})).filter(x=>x.src && !x.src.startsWith('data:') && (x.w > 150 || x.alt.length > 0))
}));
console.log(JSON.stringify(info, null, 2));

await browser.close();
