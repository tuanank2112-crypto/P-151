import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
const require = createRequire(new URL('../../../../portal/package.json', import.meta.url));
const {chromium} = require('@playwright/test');
const base='http://127.0.0.1:8018', web='http://127.0.0.1:3018';
let pass=0, fail=0;
function check(name, ok) { console.log(`${ok?'PASS':'FAIL'} ${name}`); ok?pass++:fail++; }
async function api(path,token,body) {
 const r=await fetch(base+path,{headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 return {status:r.status,data:await r.json().catch(()=>null)};
}
const demo=(await api('/api/v1/auth/demo-accounts')).data;
const profiles=[['resident','RESIDENT'],['reception','BPTN'],['management','BQL'],['cleaning','DEPARTMENT','vesinh'],['technical','DEPARTMENT','kythuat'],['warehouse','WAREHOUSE']];
const tokens={};
for (const [route,role,pattern] of profiles) {
 const account=demo.accounts.find(a=>a.role===role&&(!pattern||a.username.includes(pattern)));
 const login=await api('/api/v1/auth/login',null,{username:account.username,password:demo.shared_test_password});
 check(`${route} login200`,login.status===200); tokens[route]=login.data.access_token;
}
// A new independent safety ticket; never modifies root TEC001 or stock fixtures.
const created=await api('/api/v1/resident/tickets',tokens.resident,{original_description:'Thang máy kêu lạch tạch ở sảnh thang máy tầng 1 tòa S2. Kiểm tra an toàn độc lập.',channel:'form'});
check('own resident safety ticket created201',created.status===201);
const tid=created.data.ticket_id;
const safety=await api(`/api/v1/mo/tickets/${encodeURIComponent(tid)}`,tokens.management);
check('own safety blocker required',safety.data.ticket.blocker?.code==='SAFETY_REVIEW_REQUIRED');
const out=new URL('./screens/',import.meta.url); mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 for(const [route] of profiles) {
  const context=await browser.newContext(); await context.addCookies([{name:'python_portal_session',value:tokens[route],url:web,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage(); const errors=[]; const payloads=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async r=>{if(r.request().method()==='POST'&&r.url().startsWith(web)) payloads.push(await r.text().catch(()=>''));});
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000}); await page.goto(`${web}/${route}`); await page.waitForLoadState('networkidle');
   check(`${route}/${width} authenticated route`,new URL(page.url()).pathname===`/${route}`);
   check(`${route}/${width} no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:new URL(`${route}-${width}.png`,out).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  }
  if(route==='management') {
   await page.getByRole('textbox',{name:'Tìm ticket'}).fill(tid);
   await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();
   await page.getByRole('dialog').waitFor();
   for(const label of ['Xác nhận an toàn','Yêu cầu thêm thông tin','Chuyển khẩn cấp đến BQL']) check(`BQL safety button ${label}`,await page.getByRole('button',{name:label,exact:true}).count()===1);
   check('safety needs note disabled',await page.getByRole('button',{name:'Xác nhận an toàn',exact:true}).isDisabled());
   await page.getByRole('textbox',{name:'Ghi chú an toàn'}).fill('Đã kiểm tra độc lập: an toàn.');
   check('safety note enables action',await page.getByRole('button',{name:'Xác nhận an toàn',exact:true}).isEnabled());
   await page.screenshot({path:new URL('management-safety.png',out).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  }
  if(route==='technical'||route==='cleaning') {
   const buttons=page.getByRole('button',{name:'Xem chi tiết',exact:true});
   if(await buttons.count()) {await buttons.first().click(); await page.getByRole('dialog').waitFor(); await page.waitForTimeout(300); check(`${route} BFF detail returned`,payloads.length>0); check(`${route} payload no resident_id`,payloads.every(p=>!p.includes('resident_id'))); check(`${route} payload no internal audit`,payloads.every(p=>!p.includes('actor_id')&&!p.includes('internal_message')));}
  }
  check(`${route} no uncaught JS`,errors.length===0); await context.close();
 }
} finally {await browser.close();}
console.log(`TOTAL=${pass+fail} PASS=${pass} FAIL=${fail} SKIP=0`); process.exitCode=fail?1:0;
