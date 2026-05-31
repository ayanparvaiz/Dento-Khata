import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png', fullPage: true });

try {
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });

  // open chart via Dental Chart picker (deep-link to chart tab)
  await page.getByRole('link', { name: 'Dental Chart' }).click();
  await page.getByPlaceholder(/search patient/i).fill('Karim');
  await page.getByRole('button', { name: /Karim/ }).first().click();
  await page.locator('[data-tooth="16"]').waitFor({ timeout: 10000 });
  ok('odontogram opens via patient picker (deep-link)');

  if (await page.locator('[data-tooth="11"]').isVisible()) ok('adult 32-tooth grid rendered');
  else bad('adult grid');

  // Notation FDI -> Universal: tooth 11 label becomes "8"
  await page.locator('xpath=//label[normalize-space()="Notation"]/following-sibling::select').selectOption('UNIVERSAL');
  const label = (await page.locator('[data-tooth="11"] span').last().innerText()).trim();
  if (label === '8') ok('Universal notation maps FDI 11 -> 8');
  else bad('Universal notation', `got "${label}"`);
  await shot('p3-01-odontogram');

  // Child dentition shows primary teeth (FDI 55)
  await page.getByRole('button', { name: 'Child', exact: true }).click();
  await page.locator('[data-tooth="55"]').waitFor({ timeout: 10000 });
  ok('child dentition shows primary teeth (55)');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}
const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} Phase 3 UI checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
