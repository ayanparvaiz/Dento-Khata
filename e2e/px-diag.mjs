import { chromium } from 'playwright';
const b = await chromium.launch({ headless:false, args:['--disable-blink-features=AutomationControlled'] });
const ctx = await b.newContext({ viewport:{width:1280,height:900}, userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
await ctx.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>undefined}));
const p = await ctx.newPage();
const hits=[]; p.on('request', r=>{const u=r.url(); if(u.includes('facebook.com/tr')) hits.push(new URL(u).searchParams.get('ev'));});
p.on('console', m=>{const t=m.text(); if(/facebook|pixel|restrict|unverif/i.test(t)) console.log('CONSOLE:', t.slice(0,180));});
await p.goto('https://dento.devcenter.dev',{waitUntil:'networkidle'}); await p.waitForTimeout(3000);
for (const [ev,d] of [['CompleteRegistration',{}],['Purchase',{value:1990,currency:'BDT'}],['InitiateCheckout',{value:1990,currency:'BDT'}],['Lead',{}],['ViewContent',{}]]) {
  const before=hits.length;
  await p.evaluate(([e,dd])=>window.fbq('track',e,dd,{eventID:'t-'+e}),[ev,d]);
  await p.waitForTimeout(2200);
  console.log((hits.length>before?'✅ FIRED  ':'❌ BLOCKED')+'  '+ev);
}
console.log('ALL HITS:', hits.join(', '));
await b.close();
