import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=new URL('../../../../',import.meta.url),require=createRequire(new URL('../../../../portal/package.json',import.meta.url));const {chromium}=require('@playwright/test');let pass=0,fail=0;
function check(n,ok){console.log(`${ok?'PASS':'FAIL'} ${n}`);ok?pass++:fail++;}
const source=readFileSync(new URL('portal/src/components/python-dashboard.tsx',root),'utf8');
const init=source.match(/const \[saved, setSaved\] = useState\(([^]*?)\);/)?.[1];if(!init)throw Error('saved initializer missing');const saved=new Function('c',`return ${init};`);
check('blankTRACKED initially unsaved',saved({material_lines:[],draft:{material_requirement_mode:'TRACKED'},ticket:{department_id:'DEPT_CLEANING'}})===false);
check('emptyN_A initially saved',saved({material_lines:[],draft:{material_requirement_mode:'N_A'},ticket:{department_id:'DEPT_CLEANING'}})===true);
check('actualusage initially saved',saved({material_lines:[{used_qty:2}],draft:{material_requirement_mode:'TRACKED'},ticket:{department_id:'DEPT_CLEANING'}})===true);
check('missingmode unsaved',saved({material_lines:[],draft:null,ticket:{department_id:'DEPT_CLEANING'}})===false);
const projection=readFileSync(new URL('portal/src/lib/case-view.ts',root),'utf8');check('projection forwards requirementmode',projection.includes('"material_requirement_mode"'));
const base='http://127.0.0.1:8018',web='http://127.0.0.1:3018';
async function api(path,token,body){const r=await fetch(base+path,{headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
const demo=(await api('/api/v1/auth/demo-accounts')).data;const account=demo.accounts.find(a=>a.username==='vesinh01');const login=await api('/api/v1/auth/login',null,{username:account.username,password:demo.shared_test_password});check('cleaning login200',login.status===200);const token=login.data.access_token;
const rows=(await api('/api/v1/mo/tickets',token)).data;let fixture;
for(const row of rows.filter(r=>r.status==='IN_PROGRESS')){const r=await api(`/api/v1/mo/tickets/${encodeURIComponent(row.ticket_id)}`,token);if(r.data.draft?.material_requirement_mode==='N_A'){fixture=r.data;break;}}
if(!fixture)throw Error('read-only N_A fixture unavailable');check('backendfixture IN_PROGRESS/N_A',fixture.ticket.status==='IN_PROGRESS'&&fixture.draft.material_requirement_mode==='N_A');
const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:390,height:1000}});await ctx.addCookies([{name:'python_portal_session',value:token,url:web,httpOnly:true,sameSite:'Lax'}]);const page=await ctx.newPage();let mutation=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().startsWith(base))mutation++;});
 await page.goto(web+'/cleaning');await page.waitForLoadState('networkidle');await page.getByRole('textbox',{name:'Tìm ticket'}).fill(fixture.ticket.ticket_id);await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();await page.getByRole('dialog').waitFor();
 check('reopened N_A save disabled',await page.getByRole('button',{name:'Lưu vật tư',exact:true}).isDisabled());check('N_A no-material checked',await page.getByRole('checkbox',{name:'Không sử dụng vật tư',exact:true}).isChecked());
 await page.getByRole('button',{name:'+ Thêm vật tư',exact:true}).click();check('local draft edit enables save',await page.getByRole('button',{name:'Lưu vật tư',exact:true}).isEnabled());check('local edit no API mutation',mutation===0);
 await page.screenshot({path:new URL('./screens/material-delta-localedit.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});await ctx.close();
}finally{await browser.close();}console.log(`TOTAL=${pass+fail} PASS=${pass} FAIL=${fail} SKIP=0`);process.exitCode=fail?1:0;
