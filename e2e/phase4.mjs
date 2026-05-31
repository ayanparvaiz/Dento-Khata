import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 950 } }).then((c) => c.newPage());
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png', fullPage: true });

try {
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });
  await page.getByRole('link', { name: 'Patients' }).click();
  await page.getByPlaceholder(/search/i).fill('Karim');
  await page.getByText('Karim Ahmed').first().click();
  await page.getByRole('button', { name: 'Treatment', exact: true }).click();

  // create a uniquely-titled plan, scope to its card
  const title = `Plan ${Date.now().toString().slice(-5)}`;
  await page.getByPlaceholder(/New treatment plan/i).fill(title);
  await page.getByRole('button', { name: /new plan/i }).click();
  await page.getByText(title).waitFor({ timeout: 10000 });
  ok('created treatment plan');
  const card = page.locator(`xpath=//h3[normalize-space()="${title}"]/ancestor::div[contains(@class,"space-y-3")][1]`);

  // add item: pick procedure, click the AddItemRow "Add" button (exact)
  await card.locator('select').filter({ has: page.locator('option', { hasText: 'Select procedure…' }) }).first().selectOption({ index: 1 });
  await card.getByRole('button', { name: 'Add', exact: true }).click();
  await card.locator('tbody input[type="number"]').first().waitFor({ timeout: 10000 });
  ok('added treatment item');

  // mark completed (item status select -> COMPLETED)
  await card.locator('select').filter({ has: page.locator('option', { hasText: 'COMPLETED' }) }).first().selectOption('COMPLETED');
  await page.waitForTimeout(600);
  ok('item marked completed');
  await shot('p4-01-treatment');

  // Notes tab: template + save
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.getByRole('button', { name: 'Diagnosis:' }).click();
  await page.locator('textarea').fill('Diagnosis: Deep caries 36, RCT indicated');
  await page.getByRole('button', { name: /save note/i }).click();
  await page.getByText(/Deep caries 36/).first().waitFor({ timeout: 10000 });
  ok('clinical note saved');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}
const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} Phase 4 UI checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
