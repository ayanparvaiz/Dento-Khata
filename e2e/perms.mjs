import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:5173';
const API = 'http://localhost:3000/api';
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

async function req(p, o = {}, t) {
  const r = await fetch(API + p, { ...o, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(o.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// ---- setup: admin creates an assistant granted ONLY patients.manage ----
const admin = (await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin123' }) })).body.access_token;
const uname = `asst_${Date.now().toString().slice(-6)}`;
await req('/users', { method: 'POST', body: JSON.stringify({ username: uname, password: 'asst123', fullName: 'Limited Assistant', role: 'ASSISTANT', permissions: ['patients.manage'] }) }, admin);
const asst = (await req('/auth/login', { method: 'POST', body: JSON.stringify({ username: uname, password: 'asst123' }) })).body.access_token;
const pid = (await req('/patients?search=Karim', {}, admin)).body.items[0].id;
const plan = (await req(`/patients/${pid}/treatment`, {}, admin)).body[0];

try {
  /* ---- Backend enforcement ---- */
  // granted: can create a patient
  const c = await req('/patients', { method: 'POST', body: JSON.stringify({ fullName: 'Perm Test Patient' }) }, asst);
  if (c.status === 201 || c.status === 200) ok('assistant WITH patients.manage can create patient'); else bad('create patient allowed', c.status);

  // NOT granted: treatment create -> 403
  const t = await req(`/patients/${pid}/treatment`, { method: 'POST', body: JSON.stringify({ title: 'x' }) }, asst);
  if (t.status === 403) ok('assistant WITHOUT treatment.manage blocked (403)'); else bad('treatment blocked', t.status);

  // NOT granted: billing payment -> 403
  const b = await req(`/patients/${pid}/payments`, { method: 'POST', body: JSON.stringify({ amount: 10, method: 'CASH' }) }, asst);
  if (b.status === 403) ok('assistant WITHOUT billing.manage blocked (403)'); else bad('billing blocked', b.status);

  // view is open: drugs list works
  const d = await req('/drugs?search=napa', {}, asst);
  if (Array.isArray(d.body)) ok('assistant can still VIEW (drugs list)'); else bad('view drugs', d.status);

  /* ---- Frontend gating ---- */
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1280, height: 850 } }).then((c) => c.newPage());
  await page.goto(BASE + '/login');
  await page.locator('input').first().fill(uname);
  await page.locator('input[type="password"]').fill('asst123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });

  const navVisible = (label) => page.getByRole('link', { name: label }).isVisible().catch(() => false);
  if (await navVisible('Patients') && !(await navVisible(/Users & Roles/)) && !(await navVisible('Reports')) && !(await navVisible('Dental Chart')))
    ok('assistant nav hides ungranted sections (Reports/Charting/Users)');
  else bad('assistant nav gating');

  await page.getByRole('link', { name: 'Patients' }).click();
  await page.getByPlaceholder(/Search by name/i).fill('Karim');
  await page.getByText('Karim Ahmed').first().click();
  await page.getByRole('heading', { name: 'Karim Ahmed' }).waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Overview', exact: true }).waitFor({ timeout: 10000 });
  const tabs = await page.locator('div.rounded-xl button').allInnerTexts();
  // only Overview should show (no manage caps for other tabs)
  if (tabs.includes('Overview') && !tabs.includes('Treatment & Billing') && !tabs.includes('Prescriptions') && !tabs.includes('Dental Chart'))
    ok(`assistant patient tabs gated (sees: ${tabs.join(', ')})`);
  else bad('assistant tab gating', tabs.join(', '));
  await page.screenshot({ path: new URL('./shots/perms-assistant.png', import.meta.url).pathname });
  await browser.close();
} catch (e) {
  bad('exception', e.message);
}
void plan;
const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} permission checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
