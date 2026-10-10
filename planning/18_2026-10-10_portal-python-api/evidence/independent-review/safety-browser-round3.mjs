import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../../portal/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const base='http://127.0.0.1:8018',web='http://127.0.0.1:3018';
let pass=0,fail=0;
function check(n,ok){console.log(`${ok?'PASS':'FAIL'} ${n}`);ok?pass++:fail++;}
async function api(path,token,body){const r=await fetch(base+path,{headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
const demo=(await api('/api/v1/auth/demo-accounts')).data,tokens={};
for(const role of ['RESIDENT','BPTN','BQL']){const a=demo.accounts.find(a=>a.role===role);const r=await api('/api/v1/auth/login',null,{username:a.username,password:demo.shared_test_password});check(`${role} login200`,r.status===200);tokens[role]=r.data.access_token;}
const own=await api('/api/v1/resident/tickets',tokens.RESIDENT,{original_description:'Thang máy kêu lạch tạch ở sảnh thang máy tầng 6 tòa S1. Fixture reviewer round3.',channel:'form'});
check('own create201',own.status===201);const tid=own.data.ticket_id,path=`/api/v1/mo/tickets/${encodeURIComponent(tid)}`;
let c=await api(path,tokens.BQL);check('VERIFYING safety nonescalated',c.status===200&&c.data.ticket.status==='VERIFYING'&&c.data.ticket.blocker.code==='SAFETY_REVIEW_REQUIRED'&&!c.data.ticket.blocker.escalated);
const browser=await chromium.launch({headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:1000}});await ctx.addCookies([{name:'python_portal_session',value:tokens.BQL,url:web,httpOnly:true,sameSite:'Lax'}]);
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const labels=['Xác nhận an toàn','Yêu cầu thêm thông tin','Chuyển khẩn cấp đến BQL'];
 async function open(){await page.goto(web+'/management');await page.waitForLoadState('networkidle');await page.getByRole('textbox',{name:'Tìm ticket'}).fill(tid);await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();await page.getByRole('dialog').waitFor();}
 await open();for(const label of labels)check(`BQL nonescalated hides ${label}`,await page.getByRole('button',{name:label,exact:true}).count()===0);
 await page.screenshot({path:new URL('./screens/round3-preescalation.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 const requested=await api(path+'/safety',tokens.BPTN,{decision:'REQUEST_INFO',note:'Bổ sung thông tin cho fixture reviewer round3.'});check('BPTN REQUEST_INFO200→NEED_INFO',requested.status===200&&requested.data.ticket.status==='NEED_INFO');
 await open();check('BQL NEED_INFO confirm exists',await page.getByRole('button',{name:labels[0],exact:true}).count()===1);check('BQL NEED_INFO request-info absent',await page.getByRole('button',{name:labels[1],exact:true}).count()===0);check('BQL NEED_INFO escalate exists',await page.getByRole('button',{name:labels[2],exact:true}).count()===1);
 check('BQL NEED_INFO two safety actions',await page.getByRole('button',{name:labels[0],exact:true}).count()+await page.getByRole('button',{name:labels[2],exact:true}).count()===2);
 check('empty note disables confirm',await page.getByRole('button',{name:labels[0],exact:true}).isDisabled());await page.getByRole('textbox',{name:'Ghi chú an toàn'}).fill('Đã kiểm tra độc lập.');check('nonempty note enables confirm',await page.getByRole('button',{name:labels[0],exact:true}).isEnabled());
 await page.screenshot({path:new URL('./screens/round3-needinfo.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 check('round3 no uncaughtJS',errors.length===0);check('round3 no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await ctx.close();
}finally{await browser.close();}
console.log(`TOTAL=${pass+fail} PASS=${pass} FAIL=${fail} SKIP=0`);process.exitCode=fail?1:0;
