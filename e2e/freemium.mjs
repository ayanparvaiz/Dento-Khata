import { chromium } from 'playwright';
const B = 'https://dento.devcenter.dev/api';
const SUPER = { username: 'superadmin', password: '9158db828e308b14247c992a' };
let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };
const j = async (path, opts = {}) => {
  const { headers, ...rest } = opts;
  const r = await fetch(B + path, { ...rest, headers: { 'Content-Type': 'application/json', ...(headers || {}) } });
  const t = await r.text(); let b = {}; try { b = t ? JSON.parse(t) : {}; } catch { b = { raw: t }; }
  return { status: r.status, body: b };
};
const phone = () => '019' + Math.floor(10000000 + Math.random() * 89999999);

const run = async () => {
  const clinicPhone = phone();
  console.log('\n══════ PART A — FREE tier enforcement ══════');
  // 1. signup → straight FREE
  const su = await j('/auth/signup', { method: 'POST', body: JSON.stringify({ clinicName: 'Freemium Test', ownerName: 'Dr Free', phone: clinicPhone, password: 'test1234' }) });
  ok(su.status === 201 && su.body.access_token, 'signup ok, got token');
  const H = { Authorization: 'Bearer ' + su.body.access_token };

  // 2. subscription = FREE, active, not paid
  const sub = await j('/subscription', { headers: H });
  ok(sub.body.active === true && sub.body.isPaid === false && sub.body.status === 'FREE', `sub: active=${sub.body.active} isPaid=${sub.body.isPaid} status=${sub.body.status} (expect active/FREE/not-paid)`);

  // 3. patient cap: create 100 OK, 101st blocked. Sequential (real-world usage — the
  // human-readable P-##### code is assigned per create; parallel bursts would race on it).
  let created = 0;
  for (let i = 0; i < 100; i++) {
    const r = await j('/patients', { method: 'POST', headers: H, body: JSON.stringify({ fullName: `Patient ${i}`, phone: phone() }) });
    if (r.status === 201) created++;
  }
  ok(created === 100, `created ${created}/100 patients on FREE`);
  const p101 = await j('/patients', { method: 'POST', headers: H, body: JSON.stringify({ fullName: 'Over Limit', phone: phone() }) });
  ok(p101.status === 403 && p101.body.code === 'FREE_LIMIT_PATIENTS', `101st patient blocked (${p101.status} ${p101.body.code})`);

  // 4. user cap: 2nd user blocked
  const u2 = await j('/users', { method: 'POST', headers: H, body: JSON.stringify({ fullName: 'Assistant', phone: phone(), password: 'test1234', role: 'ASSISTANT', permissions: [] }) });
  ok(u2.status === 403 && u2.body.code === 'FREE_LIMIT_USERS', `2nd user blocked (${u2.status} ${u2.body.code})`);

  // 5. reports paid-only
  const rep = await j('/reports/revenue?days=30', { headers: H });
  ok(rep.status === 403 && rep.body.code === 'PAID_ONLY', `reports blocked on FREE (${rep.status} ${rep.body.code})`);

  // 6. backup export paid-only
  const bk = await fetch(B + '/backup/export', { headers: H });
  ok(bk.status === 403, `backup export blocked on FREE (${bk.status})`);

  // 7. imaging upload paid-only
  const anyPatient = (await j('/patients?pageSize=1', { headers: H })).body;
  const pid = (anyPatient.data || anyPatient)[0]?.id;
  const fd = new FormData();
  fd.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'x.jpg');
  fd.append('category', 'PHOTO');
  const up = await fetch(B + `/patients/${pid}/files`, { method: 'POST', headers: H, body: fd });
  ok(up.status === 403, `imaging upload blocked on FREE (${up.status})`);

  console.log('\n══════ PART B — upgrade to PRO ══════');
  const trx = 'FM' + Date.now().toString().slice(-8);
  await j('/subscription/pay', { method: 'POST', headers: H, body: JSON.stringify({ trxId: trx, senderMsisdn: clinicPhone, plan: '1m' }) });
  const sa = await j('/superadmin/login', { method: 'POST', body: JSON.stringify(SUPER) });
  const SH = { Authorization: 'Bearer ' + sa.body.access_token };
  const pend = await j('/superadmin/payments/pending', { headers: SH });
  const mine = pend.body.find(p => p.trxId === trx);
  const ver = await j(`/superadmin/payments/${mine.id}/verify`, { method: 'POST', headers: SH });
  ok(ver.body.verified === true, 'super-admin verified payment → PRO');

  const sub2 = await j('/subscription', { headers: H });
  ok(sub2.body.isPaid === true, `now isPaid=${sub2.body.isPaid} status=${sub2.body.status} (expect Pro)`);

  // now unlimited + features unlocked
  const p101b = await j('/patients', { method: 'POST', headers: H, body: JSON.stringify({ fullName: 'Now Allowed', phone: phone() }) });
  ok(p101b.status === 201, `101st patient allowed on PRO (${p101b.status})`);
  const u2b = await j('/users', { method: 'POST', headers: H, body: JSON.stringify({ fullName: 'Assistant', phone: phone(), password: 'test1234', role: 'ASSISTANT', permissions: ['patients.manage'] }) });
  ok(u2b.status === 201, `2nd user allowed on PRO (${u2b.status})`);
  const repb = await j('/reports/revenue?days=30', { headers: H });
  ok(repb.status === 200, `reports allowed on PRO (${repb.status})`);
  const bkb = await fetch(B + '/backup/export', { headers: H });
  ok(bkb.status === 200, `backup export allowed on PRO (${bkb.status})`);

  console.log('\n══════ PART C — browser (signup → app, not paywall; free UI gates) ══════');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const cp = phone();
  await page.goto('https://dento.devcenter.dev/', { waitUntil: 'networkidle' });
  await page.locator('#signup input').nth(0).fill('Browser Free Clinic');
  await page.locator('#signup input').nth(1).fill('Dr Browser');
  await page.locator('#signup input').nth(2).fill(cp);
  await page.locator('#signup input').nth(3).fill('test1234');
  await page.locator('#signup button[type=submit]').click();
  await page.waitForTimeout(4000);
  const onDash = await page.locator('text=Dashboard').first().isVisible().catch(() => false);
  const onPaywall = await page.locator('text=সাবস্ক্রিপশন চালু করুন').isVisible().catch(() => false);
  ok(onDash && !onPaywall, `signup → straight into app (dashboard=${onDash}, paywall=${onPaywall})`);
  // nav Pro badge on Reports
  const proBadge = await page.locator('nav >> text=প্রো').first().isVisible().catch(() => false);
  ok(proBadge, 'Reports nav shows প্রো badge (free)');
  // Reports page → upgrade card
  await page.goto('https://dento.devcenter.dev/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const upCard = await page.locator('text=প্রো-তে আপগ্রেড করুন').first().isVisible().catch(() => false);
  ok(upCard, 'Reports page shows upgrade card (free)');
  await browser.close();

  // cleanup both test clinics
  for (const ph of [clinicPhone, cp]) {
    const ts = await j('/superadmin/tenants', { headers: SH });
    const t = ts.body.find(x => x.phone === ph);
    if (t) await j(`/superadmin/tenants/${t.id}/delete`, { method: 'POST', headers: SH });
  }
  console.log('\ncleaned up test clinics');
  console.log(fails === 0 ? '\n🎉 ALL FREEMIUM CHECKS PASSED' : `\n❌ ${fails} CHECK(S) FAILED`);
  process.exit(fails === 0 ? 0 : 1);
};
run().catch(e => { console.error(e); process.exit(1); });
