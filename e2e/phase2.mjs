import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const name = `Rahim Uddin ${Date.now().toString().slice(-5)}`;
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
page.on('pageerror', (e) => console.log('  [page error]', e.message));
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png', fullPage: true });

try {
  // login
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });

  // 1. Patients list loads
  await page.getByRole('link', { name: 'Patients' }).click();
  await page.getByRole('heading', { name: 'Patients' }).waitFor({ timeout: 10000 });
  await shot('p2-01-list');
  ok('patients list loads');

  // 2. New patient form
  await page.getByRole('button', { name: /new patient/i }).click();
  await page.getByRole('heading', { name: /new patient/i }).waitFor({ timeout: 10000 });
  // Select fields by label adjacency (label + input are siblings in the same div).
  const byLabel = (label, tag = 'input') =>
    page.locator(`xpath=//label[normalize-space()="${label}"]/following-sibling::${tag}`);
  await byLabel('Full name *').fill(name);
  await byLabel('Gender', 'select').selectOption('MALE');
  await byLabel('Blood group', 'select').selectOption('B+');
  await byLabel('Date of birth').fill('1988-03-20');
  await byLabel('Phone').fill('01799999999');
  await shot('p2-02-form-filled');
  await page.getByRole('button', { name: /register patient/i }).click();

  // 3. Lands on detail page with the new name
  await page.getByRole('heading', { name }).waitFor({ timeout: 10000 });
  await shot('p2-03-detail');
  ok('registered patient -> detail page (auto code)');

  // 4. Medical History tab -> add allergy + premed
  await page.getByRole('button', { name: 'Medical History' }).click();
  await page.getByPlaceholder(/Penicillin/i).fill('Penicillin');
  await page.locator('label', { hasText: 'Premedication required' }).locator('input').check();
  await page.getByRole('button', { name: /save history/i }).click();
  await page.getByText(/saved/i).waitFor({ timeout: 10000 });
  ok('saved medical history');

  // 5. Medical alert banner appears (allergy + premed)
  await page.getByText('Medical alerts:').waitFor({ timeout: 10000 });
  await page.getByText('Allergy: Penicillin').waitFor({ timeout: 10000 });
  await page.getByText('Premedication required').first().waitFor({ timeout: 10000 });
  await shot('p2-04-medical-alert');
  ok('medical alert banner shows allergy + premed');

  // 6. Search finds the patient
  await page.getByRole('link', { name: 'Patients' }).click();
  await page.getByPlaceholder(/search/i).fill(name.split(' ')[0]);
  await page.getByText(name).waitFor({ timeout: 10000 });
  await shot('p2-05-search');
  ok('search finds patient');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}

const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} Phase 2 UI checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
