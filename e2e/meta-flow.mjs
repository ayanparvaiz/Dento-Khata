// Real-browser end-to-end: landing → signup → paywall → super-admin grant →
// auto-enter dashboard, while capturing Meta Pixel network calls.
// Usage: node e2e/meta-flow.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://dento.devcenter.dev';
const API = `${BASE}/api`;
const SUPER = { username: 'superadmin', password: process.env.SUPER_PASS };
const phone = '019' + Math.floor(10000000 + Math.random() * 89999999);
const pass = 'test1234';
const ok = (c, m) => console.log(`${c ? '✅' : '❌'} ${m}`);
let failures = 0;
const must = (c, m) => { ok(c, m); if (!c) failures++; };

const j = async (path, opts = {}) => {
  const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : {} };
};

const run = async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Capture every Meta pixel hit (browser side)
  const pixel = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('facebook.com/tr')) {
      const q = new URL(u).searchParams;
      pixel.push({ ev: q.get('ev'), id: q.get('eid') || q.get('event_id'), pid: q.get('id') });
    }
  });

  console.log('\n── 1. Landing page ──');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  must(await page.locator('text=Dento Khata').first().isVisible(), 'landing renders (Dento Khata)');
  must(/১,৯৯০|1,990/.test(await page.content()), 'pricing ৳1,990 shown');
  await page.waitForTimeout(1500);
  must(pixel.some((p) => p.ev === 'PageView'), `pixel PageView fired (${pixel.length} hits)`);
  must(pixel.every((p) => p.pid === '1611647527154508'), 'pixel id correct');

  console.log('\n── 2. Signup (CompleteRegistration) ──');
  await page.locator('#signup input').first().scrollIntoViewIfNeeded();
  await page.locator('#signup input').nth(0).fill('E2E ডেন্টাল কেয়ার');
  await page.locator('#signup input').nth(1).fill('ডাঃ ই-টু-ই');
  await page.locator('#signup input').nth(2).fill(phone);
  await page.locator('#signup input').nth(3).fill(pass);
  await page.locator('#signup button[type=submit]').click();
  await page.waitForTimeout(4000);

  const reg = pixel.find((p) => p.ev === 'CompleteRegistration');
  must(!!reg, 'pixel CompleteRegistration fired');
  must(!!reg?.id, `CompleteRegistration has event_id (dedup): ${reg?.id}`);

  console.log('\n── 3. Paywall shown (unpaid) ──');
  const paywall = await page.locator('text=সাবস্ক্রিপশন চালু করুন').isVisible().catch(() => false);
  must(paywall, 'paywall visible after signup');
  must(await page.locator('text=01992147963').first().isVisible(), 'bKash number shown on paywall');

  console.log('\n── 4. Submit bKash TrxID ──');
  const trx = 'E2E' + Date.now().toString().slice(-8);
  await page.locator('input[placeholder*="9AB7CD"]').fill(trx);
  await page.locator('button:has-text("পেমেন্ট জমা দিন")').click();
  await page.waitForTimeout(2500);
  must(/যাচাই|জমা হয়েছে/.test(await page.content()), 'payment submitted message');

  console.log('\n── 5. Super-admin verifies payment ──');
  const sa = await j('/superadmin/login', { method: 'POST', body: JSON.stringify(SUPER) });
  must(sa.status === 201 || sa.status === 200, 'super-admin login');
  const stok = { Authorization: `Bearer ${sa.body.access_token}` };
  const pend = await j('/superadmin/payments/pending', { headers: stok });
  const mine = pend.body.find((p) => p.trxId === trx);
  must(!!mine, `pending payment visible to super-admin (${trx})`);
  const ver = await j(`/superadmin/payments/${mine.id}/verify`, { method: 'POST', headers: stok });
  must(ver.body.verified === true, 'super-admin verified payment (+30d)');

  console.log('\n── 6. Auto-enter dashboard (no manual refresh) ──');
  // paywall polls every 10s — just wait, do NOT reload
  const entered = await page.locator('text=Dashboard').first()
    .waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false);
  must(entered, 'clinic auto-entered dashboard after grant (poll worked)');

  console.log('\n── 7. Purchase event (browser + CAPI dedup) ──');
  await page.waitForTimeout(2500);
  const pur = pixel.find((p) => p.ev === 'Purchase');
  must(!!pur, 'pixel Purchase fired on first activated load');
  must(!!pur?.id, `Purchase has event_id (matches server CAPI): ${pur?.id}`);

  console.log('\n── 8. Purchase fires only ONCE ──');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const purCount = pixel.filter((p) => p.ev === 'Purchase').length;
  must(purCount === 1, `Purchase not duplicated on reload (count=${purCount})`);

  console.log('\n── 9. Login event ──');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[placeholder="01XXXXXXXXX"]').fill(phone);
  await page.locator('input[type=password]').fill(pass);
  await page.locator('button[type=submit]').click();
  await page.waitForTimeout(3500);
  must(await page.locator('text=Dashboard').first().isVisible().catch(() => false), 'login → dashboard (active clinic)');
  must(pixel.some((p) => p.ev === 'Login'), 'pixel Login event fired');

  console.log('\n── Pixel events captured ──');
  console.log(pixel.map((p) => p.ev).join(', '));
  console.log(`\nTest clinic phone: ${phone} / ${pass}`);

  await browser.close();
  console.log(failures === 0 ? '\n🎉 ALL CHECKS PASSED' : `\n❌ ${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};
run().catch((e) => { console.error(e); process.exit(1); });
