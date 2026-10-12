"""Plan 16 TESTING §T1: guard RED must come from the old code ACCEPTING wrong data, not from a missing endpoint.

Usage (from the snapshot or repo root): python <this file>
Only legacy paths (material-plan, materials/{code}, engine confirm/record/complete): they exist in both trees.
Prints one line per probe: ACCEPTED (the bug) or REFUSED <status/error>; the final line counts them.
"""

import os
import sys

sys.path.insert(0, os.getcwd())
os.environ.update(LLM_MODE="mock", MO_STORE="memory", MO_PHOTO_STORE="local")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.auth import actor_header_allowed  # noqa: E402
from src.api.routers.maintenance import get_engine  # noqa: E402
from src.main import app  # noqa: E402
from src.maintenance.engine import MaintenanceEngine  # noqa: E402
from src.maintenance.enums import ChecklistStatus, EvidenceType, ReadabilityStatus  # noqa: E402
from src.maintenance.models import PlannedMaterial  # noqa: E402
from tests.test_maintenance.helpers import CLEANING, CLN, LIGHTING, MONDAY_9AM, TEC, Clock, report  # noqa: E402

results = {"ACCEPTED": 0, "REFUSED": 0}


def say(name: str, accepted: bool, detail: str) -> None:
    results["ACCEPTED" if accepted else "REFUSED"] += 1
    print(f"{'ACCEPTED' if accepted else 'REFUSED '} {name} {detail}")


def fresh():
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM))
    engine.reset(with_fixtures=False)
    app.dependency_overrides[get_engine] = lambda: engine
    return engine


def started(engine, text, actor):
    tid = report(engine, text)
    engine.accept(tid, actor)
    return tid


app.dependency_overrides[actor_header_allowed] = lambda: True
api = TestClient(app, raise_server_exceptions=False)
H = {TEC: {"X-Actor-Id": TEC}, CLN: {"X-Actor-Id": CLN}}

# P1 department: Kỹ thuật plans CLEAN-01 through the legacy API
e = fresh()
tid = started(e, LIGHTING, TEC)
r = api.post(f"/api/v1/mo/tickets/{tid}/material-plan", json={"lines": [{"item_code": "SIM-MAT-CLEAN-01", "planned_qty": 1}]}, headers=H[TEC])
say("P1-api-plan-foreign", r.status_code == 200, f"status={r.status_code}")
r = api.post(f"/api/v1/mo/tickets/{tid}/materials/SIM-MAT-CLEAN-01", json={"issued_qty": 1, "used_qty": 1}, headers=H[TEC])
say("P2-api-record-foreign", r.status_code == 200, f"status={r.status_code}")

# P3 Vệ sinh plans LAMP-01 through the engine directly
e = fresh()
tid = started(e, CLEANING, CLN)
try:
    e.confirm_materials(tid, CLN, lines=[PlannedMaterial(item_code="SIM-MAT-LAMP-01", planned_qty=1)])
    say("P3-engine-plan-foreign", True, "no error")
except Exception as exc:  # the probe reports, it does not judge
    say("P3-engine-plan-foreign", False, type(exc).__name__)

# P4/P5 fractions through the legacy API
e = fresh()
tid = started(e, LIGHTING, TEC)
r = api.post(f"/api/v1/mo/tickets/{tid}/material-plan", json={"lines": [{"item_code": "SIM-MAT-LAMP-01", "planned_qty": 0.5}]}, headers=H[TEC])
say("P4-api-plan-0.5", r.status_code == 200, f"status={r.status_code}")
r = api.post(f"/api/v1/mo/tickets/{tid}/materials/SIM-MAT-LAMP-01", json={"issued_qty": 0.5, "used_qty": 0.5}, headers=H[TEC])
say("P5-api-record-0.5", r.status_code == 200, f"status={r.status_code} stock={e.repo.stock_of('SIM-MAT-LAMP-01')}")
r = api.post(f"/api/v1/mo/tickets/{tid}/materials/SIM-MAT-LAMP-01", json={"issued_qty": True, "used_qty": True}, headers=H[TEC])
say("P6-api-record-true", r.status_code == 200, f"status={r.status_code}")

# P7 Kỹ thuật with no material at all: saved, then completed (READY_FOR_REVIEW)
e = fresh()
tid = started(e, LIGHTING, TEC)
r = api.post(f"/api/v1/mo/tickets/{tid}/material-plan", json={"lines": []}, headers=H[TEC])
say("P7-api-plan-technical-empty", r.status_code == 200, f"status={r.status_code}")
case = e.get(tid)
for item in case.checklist_items:
    e.update_checklist(tid, TEC, item.template_item_id, status=ChecklistStatus.COMPLETED)
e.add_evidence(tid, TEC, requirement_id=None, evidence_type=EvidenceType.SIMULATED_IMAGE, content_or_metadata="after.jpg", readability_status=ReadabilityStatus.READABLE)
done = e.report_complete(tid, TEC)
say("P8-technical-empty-completes", done.ticket.status == "READY_FOR_REVIEW", f"status={done.ticket.status}")

print(f"RESULT accepted={results['ACCEPTED']} refused={results['REFUSED']}")
