"""WP4 adversarial API probes (plan 16, H04): §C1-§C3/§C5 through the real FastAPI app (TestClient, memory store).

Usage: python probe_api.py [repo-root]
Every probe sends a raw HTTP body, checks the status code against CONTRACTS §C5 and that ticket/stock/audit/outbox
did not move. Prints HELD/BROKEN per probe; exit 0 only when every probe HELD.
"""

import json
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[4])
sys.path.insert(0, str(ROOT))
os.environ.update(LLM_MODE="mock", MO_STORE="memory", MO_PHOTO_STORE="local", MO_ALLOW_RESET="false")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.auth import actor_header_allowed  # noqa: E402
from src.api.routers.maintenance import get_engine  # noqa: E402
from src.main import app  # noqa: E402
from src.maintenance.engine import MaintenanceEngine  # noqa: E402
from tests.test_maintenance.helpers import CLN, MONDAY_9AM, RESIDENT, TEC, Clock  # noqa: E402

LAMP1, LAMP2, CLEAN = "SIM-MAT-LAMP-01", "SIM-MAT-LAMP-02", "SIM-MAT-CLEAN-01"
results = []

e = MaintenanceEngine(clock=Clock(MONDAY_9AM))
e.reset(with_fixtures=False)
app.dependency_overrides[get_engine] = lambda: e
app.dependency_overrides[actor_header_allowed] = lambda: True
api = TestClient(app, raise_server_exceptions=False)
H = lambda actor: {"X-Actor-Id": actor, "Content-Type": "application/json"}  # noqa: E731

t1 = e.receive("Đèn hành lang tầng 3 tòa S1 không sáng.", resident_id=RESIDENT).ticket.ticket_id
t2 = e.receive("Đèn hành lang tầng 7 tòa S2 không sáng.", resident_id=RESIDENT).ticket.ticket_id
c1 = e.receive("Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh.", resident_id=RESIDENT).ticket.ticket_id
e.accept(t1, TEC)
e.accept(c1, CLN)


def snap(tid):
    return (e.repo.get(tid).model_dump_json(), json.dumps(e.repo.stock(), sort_keys=True), len(e.repo.log_rows()),
            len(e.repo.notification_rows()), e.repo.version_of(tid))


LEAKS = ("Traceback", "sqlalchemy", "psycopg", "OverflowError", "File \"")


def probe(name, path, raw, want, *, actor=TEC, tid=t1, headers=None):
    before = snap(tid)
    r = api.post(f"/api/v1/mo/tickets/{tid}{path}", content=raw.encode(), headers=headers or H(actor))
    after = snap(tid)
    if want == 403:  # §C5: the existing auth-denial audit is kept; materials, stock and outbox must not move
        lines_of = lambda doc: json.loads(doc)["material_lines"]  # noqa: E731
        print(f"       denial audit rows added={after[2] - before[2]}")
        before, after = (lines_of(before[0]), before[1], before[3]), (lines_of(after[0]), after[1], after[3])
    leak = [w for w in LEAKS if w in r.text]
    held = r.status_code == want and before == after and not leak
    results.append((name, held))
    print(f"{'HELD  ' if held else 'BROKEN'} {name} :: status={r.status_code} want={want} state_unchanged={before == after} "
          f"leak={leak} body={r.text[:160]!r}")
    return r


U = "/material-usage"
BIG = "1" + "0" * 400  # a JSON integer: json.loads gives a Python int that does not fit a float
for label, value in (("true", "true"), ("'1'", '"1"'), ("0", "0"), ("-1", "-1"), ("0.5", "0.5"), ("null", "null"),
                     ("NaN", "NaN"), ("Infinity", "Infinity"), ("1e400", "1e400"), ("10**400", BIG), ("[]", "[]")):
    probe(f"A1 usage used_qty={label}", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":{value}}}]}}', 422)
probe("A2 usage extra top-level note", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":1}}],"note":"x"}}', 422)
probe("A2 usage extra line issued_qty", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":1,"issued_qty":9}}]}}', 422)
probe("A2 usage lines missing", U, "{}", 422)
probe("A2 usage lines null", U, '{"lines":null}', 422)
probe("A2 usage item_code number", U, '{"lines":[{"item_code":1,"used_qty":1}]}', 422)
probe("A3 usage foreign code", U, f'{{"lines":[{{"item_code":"{CLEAN}","used_qty":1}}]}}', 409)
probe("A3 usage duplicate", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":1}},{{"item_code":"{LAMP1}","used_qty":2}}]}}', 409)
probe("A3 usage technical []", U, '{"lines":[]}', 409)
probe("A3 usage shortage LAMP2", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":1}},{{"item_code":"{LAMP2}","used_qty":1}}]}}', 409)
probe("A3 usage on ROUTED ticket", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":1}}]}}', 409, tid=t2)
probe("A4 usage by cleaning actor on technical", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":1}}]}}', 403, actor=CLN)
probe("A4 usage bad bearer", U, f'{{"lines":[{{"item_code":"{LAMP1}","used_qty":1}}]}}', 401,
      headers={"Authorization": "Bearer nope", "Content-Type": "application/json"})
r = api.post(f"/api/v1/mo/tickets/SIM-TKT-9999{U}", json={"lines": [{"item_code": LAMP1, "used_qty": 1}]}, headers=H(TEC))
results.append(("A4 usage missing ticket", r.status_code == 404))
print(f"{'HELD  ' if r.status_code == 404 else 'BROKEN'} A4 usage missing ticket :: status={r.status_code}")

P = "/material-plan"
for label, value in (("true", "true"), ("'1'", '"1"'), ("0", "0"), ("0.5", "0.5"), ("NaN", "NaN"), ("10**400", BIG)):
    probe(f"A5 plan planned_qty={label}", P, f'{{"lines":[{{"item_code":"{LAMP1}","planned_qty":{value}}}]}}', 422)
probe("A5 plan foreign", P, f'{{"lines":[{{"item_code":"{CLEAN}","planned_qty":1}}]}}', 409)
probe("A5 plan technical []", P, '{"lines":[]}', 409)
M = f"/materials/{LAMP1}"
for label, value in (("true", "true"), ("'1'", '"1"'), ("0", "0"), ("0.5", "0.5"), ("NaN", "NaN"), ("10**400", BIG)):
    probe(f"A6 record issued_qty={label}", M, f'{{"issued_qty":{value},"used_qty":1}}', 422)
    probe(f"A6 record used_qty={label}", M, f'{{"issued_qty":1,"used_qty":{value}}}', 422)
probe("A6 record foreign code path", f"/materials/{CLEAN}", '{"issued_qty":1,"used_qty":1}', 409)

# positive: one save, then the same payload again (no extra stock move), Case returned
ok1 = api.post(f"/api/v1/mo/tickets/{t1}{U}", json={"lines": [{"item_code": LAMP1, "used_qty": 4}]}, headers=H(TEC))
s1 = e.repo.stock()[LAMP1]
ok2 = api.post(f"/api/v1/mo/tickets/{t1}{U}", json={"lines": [{"item_code": LAMP1, "used_qty": 4}]}, headers=H(TEC))
s2 = e.repo.stock()[LAMP1]
held = ok1.status_code == ok2.status_code == 200 and s1 == s2 == 1.0 and ok2.json()["ticket"]["ticket_id"] == t1
results.append(("A7 save x4 twice", held))
print(f"{'HELD  ' if held else 'BROKEN'} A7 save x4 twice :: status={ok1.status_code},{ok2.status_code} stock={s1},{s2}")
okc = api.post(f"/api/v1/mo/tickets/{c1}{U}", json={"lines": []}, headers=H(CLN))
mode = okc.json()["draft"]["material_requirement_mode"] if okc.status_code == 200 else None
results.append(("A8 cleaning [] -> 200 N_A", okc.status_code == 200 and mode == "N_A"))
print(f"{'HELD  ' if okc.status_code == 200 and mode == 'N_A' else 'BROKEN'} A8 cleaning [] :: status={okc.status_code} mode={mode}")

cat = api.get("/api/v1/mo/catalog", headers=H(TEC))
by = cat.json().get("material_codes_by_department") if cat.status_code == 200 else None
want_by = {"DEPT_CLEANING": ["SIM-MAT-BAG-01", "SIM-MAT-CLEAN-01"],
           "DEPT_TECHNICAL": ["SIM-MAT-LAMP-01", "SIM-MAT-LAMP-02", "SIM-MAT-STARTER-01"]}
held = by == want_by and "materials" in cat.json()
results.append(("A9 catalog mapping", held))
print(f"{'HELD  ' if held else 'BROKEN'} A9 catalog mapping :: status={cat.status_code} by={by}")
res = api.get("/api/v1/mo/catalog", headers=H(RESIDENT))
print(f"INFO   A9b catalog as resident :: status={res.status_code} has_mapping={'material_codes_by_department' in res.text}")

broken = [n for n, h in results if not h]
print(f"SUMMARY probes={len(results)} held={len(results) - len(broken)} broken={len(broken)}")
for n in broken:
    print(f"  BROKEN {n}")
sys.exit(1 if broken else 0)
