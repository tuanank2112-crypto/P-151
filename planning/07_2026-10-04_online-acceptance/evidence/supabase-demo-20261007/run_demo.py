"""One explicitly authorized shared-Supabase demo; never resets or seeds data."""
import hashlib
import json
import struct
import sys
import zlib
from datetime import datetime, timezone
from pathlib import Path

import httpx
import yaml
from sqlalchemy import text

from src.config import Settings
from src.maintenance.store.postgres import sql_engine

ROOT = Path(__file__).resolve().parent
RESULT = ROOT / 'result.json'
S = Settings()
C = httpx.Client(base_url='http://127.0.0.1:8001', timeout=100)
R = json.loads(RESULT.read_text(encoding='utf-8')) if RESULT.exists() else {'steps': []}


def save():
    RESULT.write_text(json.dumps(R, ensure_ascii=False, indent=2), encoding='utf-8')


def login(user):
    password = yaml.safe_load(Path('seed/maintenance_v1/accounts.yaml').read_text(encoding='utf-8'))['shared_test_password']
    response = C.post('/api/v1/auth/login', json={'username': user, 'password': password})
    response.raise_for_status()
    return {'Authorization': 'Bearer ' + response.json()['access_token']}


def call(role, method, path, **kwargs):
    response = C.request(method, '/api/v1' + path, headers=AUTH[role], **kwargs)
    item = {'role': role, 'method': method, 'path': path, 'http_status': response.status_code}
    if response.status_code >= 400:
        R['steps'].append(item)
        save()
        raise RuntimeError('HTTP_' + str(response.status_code))
    doc = response.json()
    item['ticket_status'] = doc.get('ticket', {}).get('status', doc.get('status')) if isinstance(doc, dict) else None
    R['steps'].append(item)
    save()
    return doc


def snapshot():
    with sql_engine(S.database_url).connect() as conn:
        conn.execute(text('SET TRANSACTION READ ONLY'))
        cases = dict(conn.execute(text('select ticket_id, md5(doc::text) from maintops.cases')).all())
        stock = dict(conn.execute(text('select item_code, qty from maintops.stock')).all())
        return {'case_count': len(cases), 'case_hashes': cases, 'stock': stock}


def fixture(name, color):
    def chunk(kind, payload):
        return struct.pack('!I', len(payload)) + kind + payload + struct.pack('!I', zlib.crc32(kind + payload) & 0xffffffff)
    width, height = 320, 180
    raw = b''.join(b'\0' + bytes(color) * width for _ in range(height))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, 2, 0, 0, 0))
    data += chunk(b'tEXt', b'Description\0DEMO ONLY - SIMULATED EVIDENCE - NOT A REAL SITE PHOTO')
    data += chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    (ROOT / name).write_bytes(data)
    return data


def download(evidence, expected, label):
    tid = R['ticket_id']
    response = C.get(f"/api/v1/mo/tickets/{tid}/photos/{evidence['evidence_id']}", headers=AUTH['qa'])
    response.raise_for_status()
    assert response.content == expected, 'API_PHOTO_MISMATCH'
    ref = evidence['content_or_metadata']
    with httpx.Client(timeout=30) as storage:
        response = storage.get(S.supabase_url + '/storage/v1/object/' + S.supabase_storage_bucket + '/' + ref,
                               headers={'apikey': S.supabase_service_role_key.get_secret_value()})
    response.raise_for_status()
    assert response.content == expected, 'STORAGE_PHOTO_MISMATCH'
    R.setdefault('photo_checks', {})[label] = {'evidence_id': evidence['evidence_id'], 'object_ref': ref,
        'bytes': len(expected), 'sha256': hashlib.sha256(expected).hexdigest(), 'api_match': True, 'storage_match': True}
    save()


AUTH = {role: login(user) for role, user in [('resident', 'cudan01'), ('department', 'vesinh01'), ('bql', 'bql01'), ('qa', 'qa01')]}
phase = sys.argv[1]
if phase == 'create':
    assert 'ticket_id' not in R, 'DEMO_TICKET_ALREADY_EXISTS_DO_NOT_RECREATE'
    R['started_at'] = datetime.now(timezone.utc).isoformat()
    R['configuration'] = {'store': S.mo_store, 'photos': S.mo_photo_store, 'model': S.model_name,
                          'jobs_enabled': S.mo_jobs_enabled, 'seed_on_empty': S.mo_seed_on_empty, 'allow_reset': S.mo_allow_reset}
    assert S.mo_store == 'postgres' and S.mo_photo_store == 'supabase'
    assert not S.mo_jobs_enabled and not S.mo_seed_on_empty and not S.mo_allow_reset
    R['before'] = snapshot()
    R['demo_label'] = 'DEMO-TRUONG-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    save()
    doc = call('resident', 'POST', '/resident/tickets', json={'original_description':
        f"Hành lang tầng 37 tòa S1 có rác giấy, cần dọn vệ sinh. {R['demo_label']}. Dữ liệu demo mô phỏng."})
    R['ticket_id'] = doc['ticket_id']
    save()
    doc = call('qa', 'GET', '/mo/tickets/' + R['ticket_id'])
    R['initial_case'] = doc
    save()
    print(json.dumps({'ticket_id': R['ticket_id'], 'status': doc['ticket']['status'], 'draft': bool(doc['draft']), 'before_count': R['before']['case_count']}, ensure_ascii=False))
elif phase == 'finish':
    tid = R['ticket_id']
    path = '/mo/tickets/' + tid
    doc = call('qa', 'GET', path)
    assert doc['ticket']['status'] == 'ROUTED', 'EXPECTED_ROUTED'
    before_photo = fixture('demo-before-simulated.png', (224, 171, 45))
    after_photo = fixture('demo-after-simulated.png', (55, 150, 105))
    call('resident', 'POST', f'/resident/tickets/{tid}/photos', files={'files': ('demo-before-simulated.png', before_photo, 'image/png')})
    doc = call('department', 'POST', path + '/accept')
    assert doc['ticket']['status'] == 'IN_PROGRESS'
    for item in doc['checklist_items']:
        call('department', 'POST', path + '/checklist/' + item['template_item_id'], json={'status': 'COMPLETED', 'note': 'DEMO: checklist mô phỏng, không phải xác nhận xử lý thực tế.'})
    for line in doc['material_lines']:
        qty = line['planned_qty']
        call('department', 'POST', path + '/materials/' + line['item_code'], json={'issued_qty': qty, 'used_qty': qty})
    call('department', 'POST', path + '/evidence', json={'requirement_id': 'CLN-EVD-PROCESSING-NOTE', 'evidence_type': 'PROCESSING_NOTE', 'content_or_metadata': 'DEMO: mô phỏng thu gom rác giấy tại hành lang tầng 37, không phải công việc thực tế.'})
    doc = call('department', 'POST', path + '/complete')
    R['missing_photo_guard'] = doc['draft']['readiness_evaluation']
    save()
    assert doc['ticket']['status'] == 'IN_PROGRESS'
    assert 'execution_photo' in json.dumps(R['missing_photo_guard'])
    doc = call('department', 'POST', path + '/photos', files={'files': ('demo-after-simulated.png', after_photo, 'image/png')})
    for e in doc['evidence']:
        if e['evidence_type'] == 'RESIDENT_ORIGINAL':
            download(e, before_photo, 'resident')
        elif e['evidence_type'] == 'SIMULATED_IMAGE':
            download(e, after_photo, 'execution')
    doc = call('department', 'POST', path + '/complete')
    R['ready_evaluation'] = doc['draft']['readiness_evaluation']
    save()
    assert doc['ticket']['status'] == 'READY_FOR_REVIEW'
    doc = call('bql', 'POST', '/bql/tickets/' + tid + '/close', json={'note': 'DEMO-ONLY: nghiệm thu luồng phần mềm với ảnh và checklist mô phỏng; không nghiệm thu hiện trường.'})
    assert doc['ticket']['status'] == 'CLOSED'
    # No rating: synthetic execution must not masquerade as resident satisfaction.
    logs = call('qa', 'GET', '/mo/ai-logs', params={'limit': 100})
    relevant = [log for log in logs if R['demo_label'] in json.dumps(log.get('prompt_sent', {}), ensure_ascii=False)]
    R['ai_logs'] = [{k: log.get(k) for k in ['log_id', 'timestamp', 'ticket_id', 'model_name', 'latency_ms', 'status', 'structured_output']} | {'error_classification': 'AUTHENTICATION' if 'auth' in (log.get('error_message') or '').lower() or '401' in (log.get('error_message') or '') else ('ERROR_PRESENT' if log.get('error_message') else None)} for log in relevant]
    R['final_case'] = doc
    R['finished_at'] = datetime.now(timezone.utc).isoformat()
    save()
    print(json.dumps({'ticket_id': tid, 'status': doc['ticket']['status'], 'ai_logs': R['ai_logs'], 'photo_checks': R['photo_checks']}, ensure_ascii=False))
elif phase == 'verify':
    tid = R['ticket_id']
    doc = call('qa', 'GET', '/mo/tickets/' + tid)
    assert doc['ticket']['status'] == 'CLOSED'
    for label, filename in [('resident', 'demo-before-simulated.png'), ('execution', 'demo-after-simulated.png')]:
        evidence = next(e for e in doc['evidence'] if e['evidence_id'] == R['photo_checks'][label]['evidence_id'])
        download(evidence, (ROOT / filename).read_bytes(), label)
    after = snapshot()
    before = R['before']
    changed = [tid for tid, digest in before['case_hashes'].items() if after['case_hashes'].get(tid) != digest]
    with sql_engine(S.database_url).connect() as conn:
        conn.execute(text('SET TRANSACTION READ ONLY'))
        counts = {name: conn.execute(text(f'select count(*) from maintops.{name} where ticket_id=:tid'), {'tid': tid}).scalar_one() for name in ['audit_log', 'notifications']}
    R['restart_verification'] = {'ticket_status': doc['ticket']['status'], 'photos_count': len(R['photo_checks']), 'counts': counts}
    R['after'] = after
    R['scope_checks'] = {'preexisting_cases_changed': changed, 'stock_unchanged': before['stock'] == after['stock'], 'new_ticket_ids': sorted(set(after['case_hashes']) - set(before['case_hashes']))}
    save()
    assert not changed, 'PREEXISTING_CASES_CHANGED'
    assert R['scope_checks']['stock_unchanged'], 'STOCK_CHANGED'
    assert R['scope_checks']['new_ticket_ids'] == [tid], 'UNEXPECTED_NEW_TICKETS'
    print(json.dumps({'restart_verification': R['restart_verification'], 'scope_checks': R['scope_checks'], 'before_count': before['case_count'], 'after_count': after['case_count']}, ensure_ascii=False))
else:
    raise RuntimeError('UNKNOWN_PHASE')
