"""API routes of the safety/emergency layer (plan 03): thin wrappers over the five engine methods."""

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

BPTN = {"X-Actor-Id": "SIM-ACTOR-BPTN-01"}
BQL = {"X-Actor-Id": "SIM-ACTOR-BQL-01"}
CLN = {"X-Actor-Id": "SIM-ACTOR-DEPT-CLN-01"}
AGENT = {"X-Actor-Id": "SIM-ACTOR-AGENT"}
SYSTEM = {"X-Actor-Id": "SIM-ACTOR-SYSTEM"}
RESIDENT = {"X-Actor-Id": "SIM-ACTOR-RESIDENT-01"}
TIER2 = "Hình như có mùi khét ở hành lang tầng 3 tòa S1."
TEC005 = "SIM-TKT-TEC-005"
SAFETY = "/api/v1/mo/tickets/{}/safety"
CLOSE = "/api/v1/bql/tickets/{}/emergency/close"
DOWNGRADE = "/api/v1/bql/tickets/{}/emergency/downgrade"


def _client(engine):
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[actor_header_allowed] = lambda: True
    return TestClient(app, headers={"X-Actor-Id": "SIM-ACTOR-QA-01"})


@pytest.fixture
def fresh_api():
    """Empty engine on a controllable clock; tickets are created through the engine."""
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM))
    engine.reset(with_fixtures=False)
    yield _client(engine), engine
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


@pytest.fixture
def fixture_api():
    """Engine with the 12 fixture tickets (TEC005 is a tier-1 ticket waiting for BQL)."""
    engine = MaintenanceEngine()
    engine.reset()
    yield _client(engine), engine
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def tier2(engine, text=TIER2):
    return engine.receive(text, resident_id="SIM-ACTOR-RESIDENT-01").ticket.ticket_id


def snapshot(engine, tid):
    t = engine.get(tid).ticket
    return t.status, t.blocker.code if t.blocker else None, t.risk_level


# ---------------------------------------------------------------- BPTN /safety


def test_safety_confirm_safe_200(fresh_api):
    api, engine = fresh_api
    tid = tier2(engine)
    r = api.post(SAFETY.format(tid), json={"decision": "CONFIRM_SAFE", "note": "Đã gọi cư dân, mùi sơn"}, headers=BPTN)
    assert r.status_code == 200, r.text
    body = r.json()["ticket"]
    assert body["safety_cleared_by"] == BPTN["X-Actor-Id"] and body["risk_level"] == "NONE"
    assert body["safety_clear_reason"] == "Đã gọi cư dân, mùi sơn"


def test_safety_request_info_200(fresh_api):
    api, engine = fresh_api
    tid = tier2(engine)
    r = api.post(SAFETY.format(tid), json={"decision": "REQUEST_INFO", "note": "Hỏi rõ mùi"}, headers=BPTN)
    assert r.status_code == 200, r.text
    ticket = r.json()["ticket"]
    assert (ticket["status"], ticket["safety_context"]) == ("NEED_INFO", True)


def test_safety_escalate_200(fresh_api):
    api, engine = fresh_api
    tid = tier2(engine)
    r = api.post(SAFETY.format(tid), json={"decision": "ESCALATE", "note": "Nghi nặng"}, headers=BPTN)
    assert r.status_code == 200, r.text
    ticket = r.json()["ticket"]
    assert (ticket["status"], ticket["blocker"]["code"]) == ("VERIFYING", "EMERGENCY_PENDING_BQL")


@pytest.mark.parametrize("decision", ["CONFIRM_SAFE", "REQUEST_INFO"])
@pytest.mark.parametrize("note", [None, "", "   "])
def test_safety_missing_note_409_and_nothing_cleared(fresh_api, decision, note):
    api, engine = fresh_api
    tid = tier2(engine)
    before = snapshot(engine, tid)
    body = {"decision": decision} if note is None else {"decision": decision, "note": note}
    r = api.post(SAFETY.format(tid), json=body, headers=BPTN)
    assert r.status_code in (409, 422), r.text
    assert snapshot(engine, tid) == before
    assert engine.get(tid).ticket.safety_cleared_by is None


@pytest.mark.parametrize("headers", [CLN, AGENT, SYSTEM, RESIDENT])
def test_safety_other_roles_403_with_audit(fresh_api, headers):
    api, engine = fresh_api
    tid = tier2(engine)
    before, events = snapshot(engine, tid), len(engine.get(tid).events)
    r = api.post(SAFETY.format(tid), json={"decision": "CONFIRM_SAFE", "note": "x"}, headers=headers)
    assert r.status_code == 403, r.text
    case = engine.get(tid)
    assert case.audit[-1].action_result == "ACTION_DENIED"
    assert snapshot(engine, tid) == before and len(case.events) == events


def test_safety_bql_before_escalation_403(fresh_api):
    """Q19: BQL may use the three tier-2 choices only after escalation."""
    api, engine = fresh_api
    tid = tier2(engine)
    for decision in ("CONFIRM_SAFE", "REQUEST_INFO", "ESCALATE"):
        r = api.post(SAFETY.format(tid), json={"decision": decision, "note": "x"}, headers=BQL)
        assert r.status_code == 403, r.text
    assert snapshot(engine, tid)[1] == "SAFETY_REVIEW_REQUIRED"


def test_safety_unknown_decision_422(fresh_api):
    api, engine = fresh_api
    tid = tier2(engine)
    before = snapshot(engine, tid)
    for decision in ("CLOSE", "confirm_safe", ""):
        r = api.post(SAFETY.format(tid), json={"decision": decision, "note": "x"}, headers=BPTN)
        assert r.status_code == 422, r.text
    assert api.post(SAFETY.format(tid), json={"note": "x"}, headers=BPTN).status_code == 422
    assert snapshot(engine, tid) == before


def test_safety_unknown_ticket_404(fresh_api):
    api, _ = fresh_api
    r = api.post(SAFETY.format("SIM-TKT-NOPE"), json={"decision": "CONFIRM_SAFE", "note": "x"}, headers=BPTN)
    assert r.status_code == 404


# ---------------------------------------------------------------- BQL emergency


def test_emergency_close_bql_200(fixture_api):
    api, engine = fixture_api
    r = api.post(CLOSE.format(TEC005), json={"note": "Đã cắt điện, kỹ thuật xử lý tại chỗ"}, headers=BQL)
    assert r.status_code == 200, r.text
    ticket = r.json()["ticket"]
    assert (ticket["status"], ticket["closure_kind"], ticket["department_id"]) == ("CLOSED", "EMERGENCY_HANDLED", None)
    assert ticket["closed_by"] == BQL["X-Actor-Id"] and ticket["closed_at"]


def test_emergency_close_ignores_client_closure_kind(fixture_api):
    api, _ = fixture_api
    r = api.post(CLOSE.format(TEC005), json={"note": "xong", "closure_kind": "NORMAL"}, headers=BQL)
    assert r.status_code == 200, r.text
    assert r.json()["ticket"]["closure_kind"] == "EMERGENCY_HANDLED"


def test_emergency_downgrade_bql_200(fixture_api):
    api, engine = fixture_api
    r = api.post(DOWNGRADE.format(TEC005), json={"note": "Báo nhầm: khét từ bếp căn hộ"}, headers=BQL)
    assert r.status_code == 200, r.text
    ticket = r.json()["ticket"]
    assert ticket["risk_level"] == "NONE" and ticket["safety_cleared_by"] == BQL["X-Actor-Id"]
    assert ticket["blocker"]["code"] != "EMERGENCY_PENDING_BQL"


@pytest.mark.parametrize("url", [CLOSE, DOWNGRADE])
@pytest.mark.parametrize("note", [None, "", " "])
def test_emergency_missing_note_409(fixture_api, url, note):
    api, engine = fixture_api
    before = snapshot(engine, TEC005)
    r = api.post(url.format(TEC005), json={} if note is None else {"note": note}, headers=BQL)
    assert r.status_code in (409, 422), r.text
    assert snapshot(engine, TEC005) == before


@pytest.mark.parametrize("url", [CLOSE, DOWNGRADE])
@pytest.mark.parametrize("headers", [BPTN, CLN, AGENT, SYSTEM, RESIDENT])
def test_emergency_other_roles_403(fixture_api, url, headers):
    api, engine = fixture_api
    before = snapshot(engine, TEC005)
    r = api.post(url.format(TEC005), json={"note": "x"}, headers=headers)
    assert r.status_code == 403, r.text
    assert snapshot(engine, TEC005) == before
    assert engine.get(TEC005).audit[-1].action_result == "ACTION_DENIED"


def test_emergency_wrong_state_409(fresh_api):
    """A tier-2 ticket is not an emergency yet: BQL close/downgrade is an invalid transition."""
    api, engine = fresh_api
    tid = tier2(engine)
    for url in (CLOSE, DOWNGRADE):
        r = api.post(url.format(tid), json={"note": "x"}, headers=BQL)
        assert r.status_code == 409, r.text
    assert snapshot(engine, tid)[1] == "SAFETY_REVIEW_REQUIRED"


# ---------------------------------------------------------------- resident addition, resume, jobs


def test_resident_addition_with_hazard_keeps_emergency_hold(fresh_api):
    """NEED_INFO (safety) + a resident answer that still carries the hazard: VERIFYING / EMERGENCY_PENDING_BQL."""
    api, engine = fresh_api
    tid = tier2(engine)
    ask = api.post(SAFETY.format(tid), json={"decision": "REQUEST_INFO", "note": "Hỏi rõ"}, headers=BPTN)
    assert ask.status_code == 200
    r = api.post(
        f"/api/v1/resident/tickets/{tid}/additions", json={"content": "Vẫn còn mùi khét rõ, rất nồng"}, headers=RESIDENT
    )
    assert r.status_code == 200, r.text
    ticket = engine.get(tid).ticket
    assert (ticket.status, ticket.blocker.code, ticket.department_id) == ("VERIFYING", "EMERGENCY_PENDING_BQL", None)


def test_resident_addition_hazard_without_location_keeps_hold(fresh_api):
    """The answer lacks floor/location and the hazard stays: still held for BQL, nothing routed."""
    api, engine = fresh_api
    tid = tier2(engine)
    api.post(SAFETY.format(tid), json={"decision": "REQUEST_INFO", "note": "Hỏi rõ"}, headers=BPTN)
    r = api.post(f"/api/v1/resident/tickets/{tid}/additions", json={"content": "Có tia lửa điện"}, headers=RESIDENT)
    assert r.status_code == 200, r.text
    ticket = engine.get(tid).ticket
    assert (ticket.status, ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert ticket.department_id is None


def test_resume_and_jobs_run_keep_unhandled_emergency(fixture_api):
    api, engine = fixture_api
    before = engine.get(TEC005)
    assert api.post(f"/api/v1/mo/tickets/{TEC005}/resume").status_code == 200
    r = api.post("/api/v1/mo/jobs/run", json={"now": "2026-12-31T09:00:00+07:00"})
    assert r.status_code == 200, r.text
    assert TEC005 not in r.json()["changed"]
    after = engine.get(TEC005)
    assert (after.ticket.status, after.ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert after.ticket.department_id is None and after.draft == before.draft
    assert len(after.events) == len(before.events)


def test_openapi_has_three_new_paths(fresh_api):
    api, _ = fresh_api
    paths = api.get("/openapi.json").json()["paths"]
    for p in (
        "/api/v1/mo/tickets/{ticket_id}/safety",
        "/api/v1/bql/tickets/{ticket_id}/emergency/close",
        "/api/v1/bql/tickets/{ticket_id}/emergency/downgrade",
    ):
        assert list(paths[p]) == ["post"], p
