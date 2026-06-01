import { chromium } from 'playwright';
const G='/tmp/gallery/';
const b=await chromium.launch();
const errs=[];
async function tok(){return (await (await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123'})})).json()).access_token;}
const t=await tok();
const pid=(await (await fetch('http://localhost:3000/api/patients?search=Karim',{headers:{Authorization:'Bearer '+t}})).json()).items[0].id;

async function run(tag,vp,mobile){
  const p=await (await b.newContext({viewport:vp,isMobile:mobile})).newPage();
  p.on('pageerror',e=>errs.push(`[${tag}] ${e.message}`));
  const shot=(n)=>p.screenshot({path:`${G}${tag}_${n}.png`,fullPage:true});
  await p.goto('http://localhost:3000/login'); await p.getByRole('button',{name:/sign in/i}).waitFor(); await shot('01login');
  await p.locator('input').first().fill('admin');await p.locator('input[type=password]').fill('admin123');await p.getByRole('button',{name:/sign in/i}).click();
  await p.getByRole('heading',{name:'Dashboard'}).waitFor();await p.waitForTimeout(700);await shot('02dash');
  await p.goto('http://localhost:3000/patients');await p.waitForTimeout(600);await shot('03patients');
  const tabs=['Overview','Medical History','Dental Chart','Prescriptions','Treatment & Billing','Notes','Imaging','Appointments'];
  for(let i=0;i<tabs.length;i++){await p.goto('http://localhost:3000/patients/'+pid+'?tab='+encodeURIComponent(tabs[i]));await p.waitForTimeout(700);await shot('04pd'+String(i)+tabs[i].replace(/[^a-z]/gi,''));}
  await p.goto('http://localhost:3000/appointments');await p.waitForTimeout(800);await shot('05apptDay');
  await p.getByRole('button',{name:'Week'}).click();await p.waitForTimeout(500);await shot('06apptWeek');
  await p.goto('http://localhost:3000/reports');await p.waitForTimeout(800);await shot('07reports30');
  await p.getByRole('button',{name:'1 Year'}).click();await p.waitForTimeout(600);await shot('08reports1y');
  await p.goto('http://localhost:3000/charting');await p.waitForTimeout(600);await shot('09charting');
  await p.goto('http://localhost:3000/catalog');await p.waitForTimeout(600);await shot('10catalog');
  await p.goto('http://localhost:3000/users');await p.waitForTimeout(600);await shot('11users');
  await p.goto('http://localhost:3000/settings');await p.waitForTimeout(600);await shot('12settings');
}
await run('D',{width:1366,height:900},false);
await run('M',{width:390,height:844},true);
console.log('errors:',errs.length?errs:'NONE');
await b.close();
