import pytest
from fastapi.testclient import TestClient

from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine

BPTN = {"X-Actor-Id": "SIM-ACTOR-BPTN-01"}
EXEC = {"X-Actor-Id": "SIM-ACTOR-EXEC-01"}
AGENT = {"X-Actor-Id": "SIM-ACTOR-AGENT"}


@pytest.fixture
def api():
    engine = MaintenanceEngine()
    engine.reset()
    app.dependency_overrides[get_engine] = lambda: engine
    yield TestClient(app)
    app.dependency_overrides.pop(get_engine, None)


def test_queue_lists_twelve_fixture_tickets(api):
    rows = api.get("/api/v1/mo/tickets").json()
    assert len(rows) == 12
    assert {r["flow"] for r in rows} == {"DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4", "REGRESSION"}


def test_evaluate_endpoint_passes_all(api):
    report = api.post("/api/v1/mo/evaluate").json()
    assert report["passed"] == 12 and report["demo_flows_passed"] == 4


def test_confirm_execute_and_handoff_over_http(api):
    tid = "SIM-TKT-TEC-001"
    body = {"location_normalized": "Tòa SIM-A / Tầng 3 / Hành lang", "reason": "Xác nhận mô phỏng"}
    case = api.post(f"/api/v1/mo/tickets/{tid}/confirm", json=body, headers=BPTN).json()
    assert case["draft"]["route_status"] == "ROUTED"

    for item in ("TEC-CHK-01", "TEC-CHK-02", "TEC-CHK-03"):
        api.post(f"/api/v1/mo/tickets/{tid}/checklist/{item}", json={"status": "COMPLETED"}, headers=EXEC)
    api.post(f"/api/v1/mo/tickets/{tid}/materials/SIM-MAT-LAMP-01", json={"issued_qty": 1, "used_qty": 1}, headers=EXEC)
    case = api.post(
        f"/api/v1/mo/tickets/{tid}/evidence",
        json={
            "requirement_id": "TEC-EVD-RESULT-NOTE",
            "evidence_type": "RESULT_NOTE",
            "content_or_metadata": "Đã xử lý",
        },
        headers=EXEC,
    ).json()
    assert case["ticket"]["current_state"] == "READY_FOR_REVIEW"
    assert api.post(f"/api/v1/mo/tickets/{tid}/handoff", headers=BPTN).json()["handed_off_to_bql"] is True


def test_forbidden_action_returns_403_and_is_audited(api):
    tid = "SIM-TKT-CLN-001"
    response = api.post(
        f"/api/v1/mo/tickets/{tid}/attempt",
        json={"action": "ASSIGN_EMPLOYEE", "field_name": "assignee_id", "new_value": "NV-01"},
        headers=AGENT,
    )
    assert response.status_code == 403 and response.json()["detail"]["code"] == "ACTION_DENIED"
    audit = api.get(f"/api/v1/mo/tickets/{tid}/audit").json()
    assert audit[-1]["action_result"] == "ACTION_DENIED"


def test_handoff_before_ready_is_409(api):
    assert api.post("/api/v1/mo/tickets/SIM-TKT-CLN-002/handoff", headers=BPTN).status_code == 409


def test_ingest_new_ticket(api):
    response = api.post(
        "/api/v1/mo/tickets",
        json={
            "ticket_id": "SIM-TKT-CLN-201",
            "created_at": "2026-09-28T08:15:00+07:00",
            "original_description": "Hành lang tầng 3 tòa SIM-A nhiều rác, cần vệ sinh.",
        },
    )
    assert response.status_code == 201
    assert response.json()["proposal"]["playbook_id"] == "PB-CLN-01"
