import {readFileSync} from 'node:fs';
const root = new URL('../../../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
let failures = 0, passes = 0;
function check(name, value) { console.log(`${value ? 'PASS' : 'FAIL'} ${name}`); value ? passes++ : failures++; }
function control(name, guard, good, bad) { check(`${name} GREEN`, guard(good)); check(`${name} mutant RED`, !guard(bad)); }
const dashboard = read('portal/src/components/python-dashboard.tsx');
const action = read('portal/src/app/actions/backend.ts');
const client = read('portal/src/server/backend-client.ts');
const queries = read('portal/src/server/queries.ts');
const photo = read('portal/src/app/api/backend-photos/[scope]/[ticketId]/[evidenceId]/route.ts');
control('spoofed actor removal', s => s.includes('headers.delete("X-Actor-Id")'), client, client.replace('headers.delete("X-Actor-Id")', 'void 0'));
control('authenticated resident internal photo boundary', s => s.includes('scope === "internal" && user.role === "resident"'), photo, photo.replace('scope === "internal" && user.role === "resident"', 'false'));
control('readside no old DB fallback', s => !/from\s+["'][^"']*(?:db\/|workflow)/.test(s), queries, queries + '\nimport db from "../db/index";');
control('complete200 business readiness', s => s.includes('data.ticket?.status !== "READY_FOR_REVIEW"'), action, action.replace('data.ticket?.status !== "READY_FOR_REVIEW"','false'));
const management = dashboard.split('function ManagementPanel')[1]?.split('function Priority')[0] ?? '';
check('BQL safety decision exposed', management.includes('<SafetyPanel'));
const policy = read('portal/src/lib/python-ui.ts');
const needsFn = policy.match(/export function needsRole[^]*?\n}/)?.[0].replace('export ', '').replace(/ticket: TicketSummary, role: PortalRole/, 'ticket, role').replace(/\): boolean/, ')');
const needs = new Function('BPTN_REASONS', `${needsFn}; return needsRole`)(new Set(['SAFETY_REVIEW_REQUIRED']));
check('escalated safety appears BQL needs queue', needs({status:'VERIFYING', reason_code:'SAFETY_REVIEW_REQUIRED', escalated:true}, 'management'));
const base = 'http://127.0.0.1:8018';
const api = async (path, token, body) => {
  const response = await fetch(base+path, {headers: {...(token ? {Authorization:`Bearer ${token}`} : {}), ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {method:'POST',body:JSON.stringify(body)} : {})});
  return {status: response.status, body: await response.json().catch(()=>null)};
};
const demo = await api('/api/v1/auth/demo-accounts');
if (demo.status !== 200 || !demo.body.shared_test_password) throw new Error('isolated demo credentials unavailable');
const actors = {};
for (const role of ['RESIDENT','DEPARTMENT','BQL']) {
  const account = demo.body.accounts.find(a => a.role === role);
  const login = await api('/api/v1/auth/login', null, {username:account.username,password:demo.body.shared_test_password});
  check(`isolated ${role} login200`, login.status === 200); actors[role] = login.body.access_token;
}
check('unauthenticated internal list401', (await api('/api/v1/mo/tickets')).status === 401);
check('resident internal list403', (await api('/api/v1/mo/tickets', actors.RESIDENT)).status === 403);
const rows = await api('/api/v1/mo/tickets', actors.DEPARTMENT);
check('department summary200', rows.status === 200);
if (rows.body.length) {
  const c = await api(`/api/v1/mo/tickets/${encodeURIComponent(rows.body[0].ticket_id)}`, actors.DEPARTMENT);
  check('department Case200', c.status === 200);
  const residentIdentity = JSON.stringify(c.body).includes('resident_id');
  console.log(`MEASURE department Case resident_id present=${residentIdentity}; BFF forwards unmodified=${action.includes('return execute((role) => backendFetch(')}`);
}
console.log(`TOTAL=${passes+failures} PASS=${passes} FAIL=${failures} SKIP=0`);
process.exitCode = failures ? 1 : 0;
