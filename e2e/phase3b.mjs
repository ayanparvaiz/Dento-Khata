import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 950 } }).then((c) => c.newPage());
page.on('pageerror', (e) => console.log('  [page error]', e.message));
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png', fullPage: true });

try {
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });

  await page.getByRole('link', { name: 'Dental Chart' }).click();
  await page.getByPlaceholder(/search patient/i).fill('Karim');
  await page.getByRole('button', { name: /Karim/ }).first().click();

  // 1. Anatomical teeth render (SVG polygons)
  await page.locator('[data-tooth="22"] polygon').first().waitFor({ timeout: 10000 });
  ok('anatomical odontogram renders (SVG teeth)');

  // 2. Brush = CARIES, click a surface of tooth 22 -> finding added with a surface
  await page.locator('xpath=//label[normalize-space()="Marking"]/following-sibling::select').selectOption('CARIES');
  await page.locator('[data-tooth="22"] polygon').nth(0).click(); // top zone = Buccal
  await page.getByText(/Tooth .*\(FDI 22\)/).waitFor({ timeout: 10000 });
  await page.locator('div.rounded-md.border', { hasText: 'CARIES' }).first().waitFor({ timeout: 10000 });
  await shot('p3b-01-surface-marked');
  ok('clicking a tooth surface marks it (anatomical surface click)');

  // 3. Periodontal chart: enter pocket depths and save
  await page.getByRole('button', { name: /periodontal chart/i }).click();
  await page.getByRole('button', { name: /save upper arch/i }).waitFor({ timeout: 10000 });
  const cells = page.locator('input[inputmode="numeric"]');
  await cells.nth(0).fill('5');
  await cells.nth(1).fill('6');
  await cells.nth(2).fill('4');
  await shot('p3b-02-perio-entry');
  await page.getByRole('button', { name: /save upper arch/i }).click();
  await page.waitForTimeout(1200);
  ok('perio chart: entered 6-point depths and saved');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}

const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} visual-upgrade UI checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
