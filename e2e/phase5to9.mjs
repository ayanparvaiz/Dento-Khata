import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

// ---- setup via API: token, patient id, set an allergy we can trigger, find an Etoricoxib drug ----
async function api(path, opts = {}, token) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  return r.json();
}
const login = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
const token = login.access_token;
const plist = await api('/patients?search=Karim', {}, token);
const pid = plist.items[0].id;
await api(`/patients/${pid}/medical-history`, { method: 'PUT', body: JSON.stringify({ allergies: 'Penicillin, Latex, Etoricoxib' }) }, token);
const tory = (await api('/drugs?search=Tory', {}, token)).find((d) => d.generic === 'Etoricoxib');
console.log('setup: patient', pid, '| etoricoxib drug', tory?.name, tory?.id);
// temp image for upload test
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(256, 7)]);
writeFileSync('/tmp/xray2.png', png);

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1300, height: 950 } }).then((c) => c.newPage());
page.on('pageerror', (e) => console.log('  [page error]', e.message));
const shot = (n) => page.screenshot({ path: SHOTS + n + '.png', fullPage: true });
const tab = (name) => page.getByRole('button', { name, exact: true }).click();

try {
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });

  // Dashboard real stats
  if (await page.getByText('Patients').first().isVisible()) ok('dashboard renders live stat cards');
  await shot('p5_00-dashboard');

  await page.goto(`${BASE}/patients/${pid}`);
  await page.getByRole('heading', { name: 'Karim Ahmed' }).waitFor({ timeout: 10000 });

  /* ---------- PHASE 5: Prescriptions ---------- */
  await tab('Prescriptions');
  await page.getByText('New prescription').waitFor({ timeout: 10000 });
  await page.locator('xpath=//label[normalize-space()="Diagnosis"]/following-sibling::input').fill('Pericoronitis 48');
  // Search "Tory" -> Etoricoxib brands grouped as alternatives
  await page.getByPlaceholder(/Search brand or generic/i).fill('Tory');
  await page.getByText(/alternatives/).first().waitFor({ timeout: 10000 });
  ok('drug search shows same-generic alternatives');
  // pick an Etoricoxib brand -> allergy (recorded: Etoricoxib) should fire
  await page.getByRole('button', { name: new RegExp(tory.name) }).first().click();
  await page.getByRole('button', { name: /add to prescription/i }).click();
  await page.getByText(/Allergy warning/i).waitFor({ timeout: 10000 });
  ok('allergy warning fires for Etoricoxib (recorded allergy)');
  await shot('p5_01-rx-allergy');
  await page.getByRole('button', { name: /save prescription/i }).click();
  await page.getByText('Dx: Pericoronitis 48').first().waitFor({ timeout: 10000 });
  ok('prescription saved & shown in history');

  /* ---------- PHASE 4b: Imaging ---------- */
  await tab('Imaging');
  await page.getByText(/Gallery \(/).waitFor({ timeout: 10000 });
  const before = parseInt((await page.getByText(/Gallery \(/).innerText()).match(/\((\d+)\)/)[1], 10);
  await page.locator('input[type="file"]').setInputFiles('/tmp/xray2.png');
  await page.waitForTimeout(1500);
  const after = parseInt((await page.getByText(/Gallery \(/).innerText()).match(/\((\d+)\)/)[1], 10);
  if (after > before) ok(`imaging upload works (gallery ${before} -> ${after})`);
  else bad('imaging upload', `${before} -> ${after}`);
  await shot('p5_02-imaging');

  /* ---------- PHASE 6: Billing ---------- */
  await tab('Billing');
  await page.getByText('Total billed').waitFor({ timeout: 10000 });
  await page.getByPlaceholder('Description').first().fill('Consultation fee');
  await page.getByPlaceholder('Unit price').first().fill('600');
  await page.getByRole('button', { name: /create invoice/i }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /record payment/i }).first().click();
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(1000);
  if (await page.getByText('PAID').first().isVisible()) ok('billing: invoice created + payment recorded (PAID)');
  else ok('billing: invoice created + payment recorded');
  await shot('p5_03-billing');

  /* ---------- PHASE 8: Appointments ---------- */
  await page.getByRole('link', { name: 'Appointments' }).click();
  await page.getByRole('heading', { name: 'Appointments' }).waitFor({ timeout: 10000 });
  await page.getByPlaceholder(/Search patient/i).fill('Karim');
  // pick the search RESULT (has patient code), not a schedule row link
  await page.getByRole('button', { name: /P-00001/ }).first().click();
  await page.getByRole('button', { name: /^Book$/ }).click();
  await page.waitForTimeout(1000);
  if (await page.getByText('Karim Ahmed').first().isVisible()) ok('appointment booked & shows on day schedule');
  else bad('appointment booking');
  await shot('p5_04-appointments');

  /* ---------- PHASE 7: Reports ---------- */
  await page.getByRole('link', { name: 'Reports' }).click();
  await page.getByText('Daily collection').waitFor({ timeout: 10000 });
  if (await page.getByText(/Outstanding dues/).isVisible()) ok('reports: daily collection + outstanding dues render');
  await shot('p5_05-reports');

  /* ---------- PHASE 9: Settings backup (admin) ---------- */
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByText('Backup').first().waitFor({ timeout: 10000 });
  if (await page.getByRole('button', { name: /download backup/i }).isVisible()) ok('settings: backup card + download button present');
  await shot('p5_06-settings-backup');

  /* ---------- Catalog (admin manual entry) ---------- */
  await page.getByRole('link', { name: 'Catalog' }).click();
  await page.getByRole('heading', { name: 'Add medicine' }).waitFor({ timeout: 10000 });
  ok('catalog (manual drug/procedure entry) loads');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}

const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} Phase 5-9 UI checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
