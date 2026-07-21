import { chromium } from 'playwright';
const B=process.env.URL||'https://dento.devcenter.dev';
const tag=process.env.TAG||'x';
const b=await chromium.launch();
async function shot(vp, mobile, name){
  const ctx=await b.newContext({viewport:vp, isMobile:mobile, hasTouch:mobile, ...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}:{})});
  const p=await ctx.newPage();
  await p.goto(B+'/login',{waitUntil:'networkidle'});
  await p.locator('input[placeholder="01XXXXXXXXX"]').fill('01711111111');
  await p.locator('input[type=password]').fill('demo1234');
  await p.locator('button[type=submit]').click(); await p.waitForTimeout(3500);
  await p.goto(B+'/charting',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
  await p.locator('text=রেহানা পারভীন').first().click().catch(()=>{});
  await p.waitForTimeout(2500);
  await p.screenshot({path:`/tmp/${name}.png`, fullPage:true});
  await ctx.close();
}
await shot({width:1280,height:900}, false, `dc-desktop-${tag}`);
await shot({width:390,height:844}, true, `dc-mobile-${tag}`);
console.log('shots done:',tag);
await b.close();
