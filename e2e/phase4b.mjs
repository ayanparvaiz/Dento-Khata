import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

async function api(p, o = {}, t) {
  const r = await fetch(API + p, { ...o, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(o.headers || {}) } });
  return r.json();
}
const token = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).access_token;
const pid = (await api('/patients?search=Karim', {}, token)).items[0].id;

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1280, height: 950 } }).then((c) => c.newPage());
page.on('pageerror', (e) => console.log('  [page error]', e.message));

try {
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });
  await page.goto(`${BASE}/patients/${pid}?tab=${encodeURIComponent('Treatment & Billing')}`);

  const title = `Fee ${Date.now().toString().slice(-5)}`;
  await page.getByPlaceholder(/Plan title/i).fill(title);
  await page.getByRole('button', { name: /create plan/i }).click();
  await page.getByText(title).waitFor({ timeout: 10000 });

  // pick procedure + OVERRIDE fee in the add box, then Add
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Select procedure…' }) }).first().selectOption({ index: 1 });
  await page.locator('xpath=//label[normalize-space()="Fee ৳"]/following-sibling::input').first().fill('1234');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  await page.waitForTimeout(1200);

  // verify via API the staff-entered fee saved
  const plans = await api(`/patients/${pid}/treatment`, {}, token);
  const plan = plans.find((p) => p.title === title);
  const fees = (plan?.items || []).map((i) => i.fee);
  if (fees.includes(1234)) ok('staff-entered custom fee (1234) saved');
  else bad('custom fee saved', `fees=${JSON.stringify(fees)}`);
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}
const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} editable-fee checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
