import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const FUTURE = '2026-07-15';
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

// cleanup: remove any existing appts on FUTURE date so the run is deterministic
async function api(p, o = {}, t) {
  const r = await fetch(API + p, { ...o, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(o.headers || {}) } });
  return r.status === 204 ? null : r.json();
}
const token = (await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).access_token;
const existing = await api(`/appointments?date=${FUTURE}`, {}, token);
for (const a of existing) await api(`/appointments/${a.id}`, { method: 'DELETE' }, token);
console.log(`setup: cleared ${existing.length} appts on ${FUTURE}`);

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1300, height: 950 } }).then((c) => c.newPage());
page.on('pageerror', (e) => console.log('  [page error]', e.message));
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png', fullPage: true });

try {
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });

  await page.getByRole('link', { name: 'Appointments' }).click();
  await page.getByRole('heading', { name: 'Appointments' }).waitFor({ timeout: 10000 });

  // set both the schedule date (toolbar) and booking date to a clean future day
  await page.locator('input[type="date"]').first().fill(FUTURE); // toolbar anchor
  await page.locator('xpath=//label[normalize-space()="Date"]/following-sibling::input').fill(FUTURE);

  // pick patient
  await page.getByPlaceholder(/Search patient/i).fill('Karim');
  await page.getByRole('button', { name: /P-00001/ }).first().click();

  // availability slots render; click first free slot
  const freeSlot = page.locator('button:not([disabled])', { hasText: /^\d{1,2}:\d{2}\s?(AM|PM)\s?[–-]/ }).first();
  await freeSlot.waitFor({ timeout: 10000 });
  const slotTime = (await freeSlot.innerText()).trim();
  await freeSlot.click();
  ok(`availability slot grid shows free slots (picked ${slotTime})`);

  // Book
  await page.getByRole('button', { name: /^Book/ }).click();
  await page.getByText('01711111111').first().waitFor({ timeout: 10000 });
  ok('booked future appointment; phone shows as subtitle');
  await shot('p8-01-booked');

  // OVERLAP: re-pick patient, manually force the already-booked time -> backend 409
  await page.getByPlaceholder(/Search patient/i).fill('Karim');
  await page.getByRole('button', { name: /P-00001/ }).first().click();
  await page.locator('xpath=//label[normalize-space()="Start"]/following-sibling::input').fill('10:00');
  await page.getByRole('button', { name: /^Book/ }).click();
  await page.getByText(/already booked|busy/i).waitFor({ timeout: 10000 });
  ok('overlap prevention blocks double-booking (conflict message)');
  await shot('p8-02-overlap');

  // Week view
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  await page.getByText(/Week of/).waitFor({ timeout: 10000 });
  ok('week view renders');
  await shot('p8-03-week');

  // Patient detail Appointments tab shows the upcoming appt
  await page.goto(`${BASE}/patients/`);
  await page.getByPlaceholder(/Search by name/i).fill('Karim');
  await page.getByText('Karim Ahmed').first().click();
  await page.getByRole('button', { name: 'Appointments', exact: true }).click();
  await page.getByText(/Upcoming \(/).waitFor({ timeout: 10000 });
  ok('patient detail shows their appointments tab');
  await shot('p8-04-patient-appts');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}
const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} appointment-upgrade checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
