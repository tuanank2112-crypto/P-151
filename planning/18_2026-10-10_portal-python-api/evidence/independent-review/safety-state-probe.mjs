const base='http://127.0.0.1:8018';
async function api(path,token,body){const r=await fetch(base+path,{headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>null)};}
const demo=(await api('/api/v1/auth/demo-accounts')).data;
const tokens={};
for(const role of ['RESIDENT','BPTN','BQL']) {const a=demo.accounts.find(a=>a.role===role);tokens[role]=(await api('/api/v1/auth/login',null,{username:a.username,password:demo.shared_test_password})).data.access_token;}
const own=(await api('/api/v1/resident/tickets',tokens.RESIDENT,{original_description:'Có tiếng lạch tạch tại cầu thang bộ tầng 4 tòa S1. Kiểm chứng safety states độc lập.',channel:'form'})).data;
if(!own)throw new Error('own fixture missing');
const path=`/api/v1/mo/tickets/${encodeURIComponent(own.ticket_id)}`;
const c=(await api(path,tokens.BQL)).data;
console.log(`MEASURE own VERIFYING=${c.ticket.status==='VERIFYING'} SAFETY_REVIEW=${c.ticket.blocker?.code==='SAFETY_REVIEW_REQUIRED'} escalated=${c.ticket.blocker?.escalated}`);
const bqlBefore=await api(path+'/safety',tokens.BQL,{decision:'REQUEST_INFO',note:'Kiểm chứng control trước leo thang.'});
console.log(`MEASURE BQL REQUEST_INFO before escalation HTTP=${bqlBefore.status}`);
const bptn=await api(path+'/safety',tokens.BPTN,{decision:'REQUEST_INFO',note:'Bổ sung thông tin cho fixture độc lập.'});
console.log(`MEASURE BPTN REQUEST_INFO HTTP=${bptn.status} status=${bptn.data.ticket?.status}`);
const bqlNeed=await api(path+'/safety',tokens.BQL,{decision:'REQUEST_INFO',note:'Kiểm chứng control tại NEED_INFO.'});
console.log(`MEASURE BQL REQUEST_INFO in NEED_INFO HTTP=${bqlNeed.status}`);
console.log('TOTAL=3 PASS='+[bqlBefore.status===403,bptn.status===200,bqlNeed.status===409].filter(Boolean).length);
process.exitCode=bqlBefore.status===403&&bptn.status===200&&bqlNeed.status===409?0:1;
