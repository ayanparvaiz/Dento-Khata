import { chromium, devices } from 'playwright';

const BASE = 'http://localhost:5173';
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const uniq = `recep_${Date.now().toString().slice(-6)}`;
const results = [];
const ok = (n) => { results.push([true, n]); console.log(`  PASS ${n}`); };
const bad = (n, e) => { results.push([false, n]); console.log(`  FAIL ${n}${e ? ' :: ' + e : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  [page error]', e.message));

async function shot(name) { await page.screenshot({ path: SHOTS + name + '.png', fullPage: true }); }

try {
  // 1. Login page renders
  await page.goto(BASE + '/login');
  await page.getByRole('button', { name: /sign in/i }).waitFor({ timeout: 10000 });
  await shot('01-login');
  ok('login page renders');

  // 2. Login as admin -> dashboard, backend connected
  await page.locator('input').first().fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });
  await page.getByText(/connected/i).waitFor({ timeout: 10000 });
  await shot('02-dashboard');
  ok('admin login -> dashboard, backend connected');

  // 3. Admin sees "Users & Roles" nav (admin-only)
  const usersNav = page.getByRole('link', { name: /users & roles/i });
  if (await usersNav.isVisible()) ok('admin sees Users & Roles nav'); else bad('admin sees Users & Roles nav');

  // 4. Create a receptionist user via UI
  await usersNav.click();
  await page.getByRole('heading', { name: /users & roles/i }).waitFor();
  await shot('03-users-before');
  const form = page.locator('form').first();
  await form.locator('input').nth(0).fill('Test Receptionist'); // full name
  await form.locator('input').nth(1).fill(uniq);                 // username
  await form.locator('input[type="password"]').fill('recep123'); // password
  await page.getByRole('button', { name: /add user/i }).click();
  await page.getByText(uniq).waitFor({ timeout: 10000 });
  await shot('04-users-after');
  ok(`created user "${uniq}" via UI`);

  // 5. Settings: change clinic name and save
  await page.goto(BASE + '/settings');
  await page.getByRole('button', { name: /save settings/i }).waitFor({ timeout: 10000 });
  const nameInput = page.locator('input').first();
  await nameInput.fill('Dr. Boro Vai Dental Chamber');
  await page.getByRole('button', { name: /save settings/i }).click();
  await page.getByText(/saved/i).waitFor({ timeout: 10000 });
  await shot('05-settings-saved');
  ok('admin saved clinic settings');

  // 6. Sign out
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.getByRole('button', { name: /sign in/i }).waitFor({ timeout: 10000 });
  await shot('06-signed-out');
  ok('sign out -> back to login');

  // 7. Login as the new receptionist
  await page.locator('input').first().fill(uniq);
  await page.locator('input[type="password"]').fill('recep123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 10000 });
  await shot('07-receptionist-dashboard');
  ok('receptionist login works');

  // 8. Receptionist must NOT see Users & Roles nav
  const navHidden = !(await page.getByRole('link', { name: /users & roles/i }).isVisible().catch(() => false));
  if (navHidden) ok('receptionist: Users & Roles nav hidden'); else bad('receptionist: Users & Roles nav hidden');

  // 9. Receptionist hitting /users directly is blocked
  await page.goto(BASE + '/users');
  await page.getByText(/don.t have permission/i).waitFor({ timeout: 10000 });
  await shot('08-receptionist-blocked');
  ok('receptionist blocked from /users (role guard UI)');

  // 10. Bonus: mobile (phone) viewport renders login (PWA/responsive proof)
  const mctx = await browser.newContext({ ...devices['iPhone 13'] });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE + '/login');
  await mpage.getByRole('button', { name: /sign in/i }).waitFor({ timeout: 10000 });
  await mpage.screenshot({ path: SHOTS + '09-mobile-login.png' });
  await mctx.close();
  ok('mobile (iPhone) viewport renders login');
} catch (e) {
  bad('exception', e.message);
} finally {
  await browser.close();
}

const passed = results.filter((r) => r[0]).length;
console.log(`\n==== ${passed}/${results.length} UI checks passed ====`);
process.exit(passed === results.length ? 0 : 1);
