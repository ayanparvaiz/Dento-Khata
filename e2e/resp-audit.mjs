import { chromium } from 'playwright';
const B='https://dento.devcenter.dev';
const WIDTHS=[{w:390,h:844,t:'mobile'},{w:820,h:1180,t:'tablet'},{w:1280,h:800,t:'laptop'}];
const ROUTES=[
  ['dashboard','/'],
  ['patients','/patients'],
  ['appointments','/appointments'],
  ['charting','/charting'],
  ['reports','/reports'],
  ['catalog','/catalog'],
  ['users','/users'],
  ['settings','/settings'],
  ['tutorial','/tutorial'],
];
const b=await chromium.launch();
for(const {w,h,t} of WIDTHS){
  const ctx=await b.newContext({viewport:{w:w,height:h,width:w},deviceScaleFactor:1});
  const p=await ctx.newPage();
  // login
  await p.goto(B+'/login',{waitUntil:'networkidle'});
  await p.locator('input[placeholder="01XXXXXXXXX"]').fill('01711111111');
  await p.locator('input[type=password]').fill('demo1234');
  await p.locator('button[type=submit]').click();
  await p.waitForTimeout(3500);
  for(const [name,route] of ROUTES){
    await p.goto(B+route,{waitUntil:'networkidle'});
    await p.waitForTimeout(1800);
    // detect horizontal overflow
    const of=await p.evaluate(()=>({docW:document.documentElement.scrollWidth, winW:window.innerWidth, bodyW:document.body.scrollWidth}));
    const overflow = of.docW > of.winW+2;
    await p.screenshot({path:`/tmp/resp/${t}-${name}.png`, fullPage:true});
    console.log(`${t.padEnd(7)} ${name.padEnd(13)} ${overflow?'⚠ H-OVERFLOW docW='+of.docW+' winW='+of.winW:'ok'}`);
  }
  // patient detail (data-heavy)
  await p.goto(B+'/patients',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
  const firstRow=p.locator('a[href^="/patients/"], tr[role], [data-patient]').first();
  try{ await firstRow.click({timeout:3000}); await p.waitForTimeout(2000);
    const of=await p.evaluate(()=>({docW:document.documentElement.scrollWidth, winW:window.innerWidth}));
    await p.screenshot({path:`/tmp/resp/${t}-patient-detail.png`, fullPage:true});
    console.log(`${t.padEnd(7)} patient-detail ${of.docW>of.winW+2?'⚠ H-OVERFLOW '+of.docW+'>'+of.winW:'ok'}`);
  }catch(e){ console.log(t,'patient-detail: could not open'); }
  await ctx.close();
}
await b.close();
console.log('DONE -> /tmp/resp');
