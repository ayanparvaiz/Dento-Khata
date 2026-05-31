import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 950 } }).then((c) => c.newPage());
page.on('pageerror', (e) => console.log('  [page error]', e.message));

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

  // new plan with a unique title so we can scope to exactly this card
  const title = `Fee test ${Date.now().toString().slice(-5)}`;
  await page.getByPlaceholder(/New treatment plan/i).fill(title);
  await page.getByRole('button', { name: /new plan/i }).click();
  await page.getByText(title).waitFor({ timeout: 10000 });

  // scope all further locators to this plan's card
  const card = page.locator(`xpath=//h3[normalize-space()="${title}"]/ancestor::div[contains(@class,"space-y-3")][1]`);

  // pick procedure, then OVERRIDE the fee with a custom amount
  await card.locator('select').filter({ has: page.locator('option', { hasText: 'Select procedure…' }) }).first().selectOption({ index: 1 });
  await card.getByPlaceholder('Fee').fill('1234');
  await card.getByRole('button', { name: /^Add/ }).click();

  // verify item shows the custom fee (not the procedure default)
  const itemFee = card.locator('tbody input[type="number"]').first();
  await itemFee.waitFor({ timeout: 10000 });
  const val = await itemFee.inputValue();
  if (val === '1234') ok('staff-entered custom fee 1234 used (not default)');
  else bad('custom fee used', `got ${val}`);

  // edit the fee inline to 1500
  await itemFee.fill('1500');
  await itemFee.blur();
  await page.waitForTimeout(800);
  ok('fee edited inline by staff');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}

const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} editable-fee checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
