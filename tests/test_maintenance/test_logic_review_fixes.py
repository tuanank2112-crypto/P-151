"""Regression tests for plan 04 (logic review fixes, 2026-10-04): engine part (A1 engine side, E1–E5).

Router-only tests (A2, A3, A4, L2, route limits) live in test_backend_review_fixes.py, handed to the API owner.
"""

import threading

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.ai_logger import ai_logger
from src.maintenance.engine import DENIED_TEXT_MAX, MaintenanceEngine
from src.maintenance.enums import Action, ChecklistStatus
from src.maintenance.models import RawTicket
from src.maintenance.proposer import LLMAssessment
from tests.test_maintenance.helpers import (
    BPTN,
    BQL,
    CLEANING,
    OTHER_RESIDENT,
    RESIDENT,
    TEC,
    dept_of,
    do_work,
    report,
    to_ready,
)

TIER2 = "Hành lang tầng 3 tòa SIM-A hình như có mùi khét."
H = {name: {"X-Actor-Id": actor} for name, actor in {
    "resident": RESIDENT, "other": OTHER_RESIDENT, "bptn": BPTN, "bql": BQL, "tec": TEC,
    "cln": "SIM-ACTOR-DEPT-CLN-01", "warehouse": "SIM-ACTOR-WAREHOUSE-01",
}.items()}  # fmt: skip


@pytest.fixture
def api_engine(fresh):
    app.dependency_overrides[get_engine] = lambda: fresh
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield TestClient(app), fresh
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


# ---------------------------------------------------------------------- A1: out-of-scope callers


def test_out_of_scope_denial_does_not_reveal_status(api_engine):
    api, engine = api_engine
    tid = report(engine, CLEANING)
    for who, path, body in [
        ("other", f"/api/v1/mo/tickets/{tid}/attempt", {"action": "EDIT_RAW", "field_name": "x"}),
        ("other", f"/api/v1/mo/tickets/{tid}/transition", {"to": "CLOSED"}),
        ("tec", f"/api/v1/mo/tickets/{tid}/accept", None),
    ]:
        r = api.post(path, json=body, headers=H[who])
        assert r.status_code == 403, (who, path, r.text)
        assert "unchanged_status" not in r.json()["detail"], (who, path)
        assert "ROUTED" not in r.text, (who, path)


def test_out_of_scope_transition_from_another_status_is_403_not_409(api_engine):
    """A 409 INVALID_TRANSITION would name the current status; an out-of-scope caller gets the plain denial."""
    api, engine = api_engine
    tid = report(engine, TIER2)  # VERIFYING / SAFETY_REVIEW_REQUIRED, no department yet
    r = api.post(f"/api/v1/mo/tickets/{tid}/transition", json={"to": "IN_PROGRESS"}, headers=H["cln"])
    assert r.status_code == 403 and "VERIFYING" not in r.text


def test_in_scope_denial_still_reports_status(api_engine):
    api, engine = api_engine
    tid = report(engine, CLEANING)
    r = api.post(f"/api/v1/mo/tickets/{tid}/transition", json={"to": "CLOSED"}, headers=H["cln"])
    assert r.status_code == 403 and r.json()["detail"]["unchanged_status"] == "ROUTED"


def test_denied_values_are_clipped_in_the_audit(fresh):
    tid = report(fresh, CLEANING)
    with pytest.raises(Exception):  # noqa: B017 - ActionDeniedError
        fresh.attempt(
            tid, OTHER_RESIDENT, Action.EDIT_RAW, field_name="f" * 5000, new_value="x" * 50_000, reason="r" * 9000
        )
    row = fresh.get(tid).audit[-1]
    assert row.action_result == "ACTION_DENIED"
    assert len(row.new_value) <= DENIED_TEXT_MAX + 1 and len(row.field_name) <= DENIED_TEXT_MAX
    assert len(row.reason) < DENIED_TEXT_MAX + 100


# ---------------------------------------------------------------------- E1: rework needs new evidence


def test_rework_needs_new_photo_and_note(fresh):
    tid = report(fresh, CLEANING)
    to_ready(fresh, tid)
    case = fresh.rework(tid, BQL, note="Còn bẩn, làm lại")
    actor = dept_of(fresh, tid)
    for item in case.checklist_items:  # only the checklist again, no new photo or note
        fresh.update_checklist(tid, actor, item.template_item_id, status=ChecklistStatus.COMPLETED)
    case = fresh.report_complete(tid, actor)
    failing = case.draft.readiness_evaluation.failing_items
    assert case.ticket.status == "IN_PROGRESS"
    assert "execution_photo" in failing and not case.draft.readiness_evaluation.processing_note_present
    do_work(fresh, tid)  # a new photo and note in this round
    assert fresh.report_complete(tid, actor).ticket.status == "READY_FOR_REVIEW"


# ---------------------------------------------------------------------- E2: BQL keeps an escalated safety ticket


def test_bql_keeps_control_after_resident_answers_a_t06(fresh, clock):
    tid = report(fresh, TIER2)
    clock.advance(hours=5)
    fresh.run_jobs()
    assert fresh.get(tid).ticket.blocker.escalated
    fresh.safety_request_info(tid, BQL, note="Hỏi cư dân mùi ở đâu")
    clock.advance(minutes=10)
    case = fresh.add_resident_info(tid, RESIDENT, "Mùi ở góc hành lang gần thang bộ tầng 3.")
    assert case.ticket.blocker.code == "SAFETY_REVIEW_REQUIRED" and case.ticket.blocker.escalated
    assert sum(n.type == "safety.review_escalated" for n in case.notifications) == 2
    assert fresh.safety_escalate(tid, BQL, note="Nâng khẩn cấp").ticket.blocker.code == "EMERGENCY_PENDING_BQL"


def test_first_tier2_still_waits_for_escalation_before_bql(fresh):
    tid = report(fresh, TIER2)
    assert not fresh.get(tid).ticket.blocker.escalated  # Q19 unchanged for a ticket never escalated


# ---------------------------------------------------------------------- E3 + E4: LLM call


class RecordingLLM:
    def __init__(self, engine_ref):
        self.engine_ref = engine_ref
        self.calls = 0
        self.lock_free = []

    def __call__(self, text):
        self.calls += 1
        free = []
        probe = threading.Thread(target=lambda: free.append(self._try_lock()))
        probe.start()
        probe.join()
        self.lock_free.append(free[0])
        return LLMAssessment(service_category="VE_SINH", ticket_type="COMMON_AREA_CLEANING", reason="rác")

    def _try_lock(self):
        lock = self.engine_ref[0].lock
        if lock.acquire(blocking=False):
            lock.release()
            return True
        return False


@pytest.fixture
def llm_engine(clock):
    ref = []
    llm = RecordingLLM(ref)
    engine = MaintenanceEngine(clock=clock, llm=llm, llm_label="fake")
    engine.reset(with_fixtures=False)
    ref.append(engine)
    return engine, llm


def test_receive_calls_the_llm_once_outside_the_engine_lock(llm_engine):
    engine, llm = llm_engine
    case = engine.receive(CLEANING, resident_id=RESIDENT)
    assert llm.calls == 1 and llm.lock_free == [True]
    assert case.ticket.status == "ROUTED" and case.classification.proposer == "rules+llm:fake"


def test_ai_log_carries_the_ticket_id(llm_engine):
    engine, _ = llm_engine
    ai_logger.clear()
    tid = engine.receive(CLEANING, resident_id=RESIDENT).ticket.ticket_id
    assert [e.ticket_id for e in ai_logger.get_logs(ticket_id=tid)] == [tid]
    ai_logger.clear()


def test_no_early_llm_call_when_the_safety_layer_stops_the_ticket(llm_engine):
    engine, llm = llm_engine
    engine.receive("Có khói bốc ra từ hộp điện hành lang tầng 3 tòa SIM-A", resident_id=RESIDENT)  # tier 1
    assert llm.calls == 0


def test_a_report_without_location_is_classified_once_outside_the_lock(llm_engine):
    """Plan 05 Q05: step 2 needs the category to know whether to ask for a location, so the call happens early."""
    engine, llm = llm_engine
    engine.receive("Nhiều rác quá", resident_id=RESIDENT)  # no location: classified, then NEED_INFO (in scope)
    assert llm.calls == 1 and llm.lock_free == [True]


# ---------------------------------------------------------------------- E5: orphaned RECEIVED ticket


def test_job_runs_the_pipeline_on_an_orphaned_ticket(fresh, clock):
    raw = RawTicket(
        ticket_id="SIM-TKT-0099",
        created_at=clock.now.isoformat(timespec="seconds"),
        original_description=CLEANING,
        channel="form",
    )
    fresh.ingest(raw)  # the pipeline transaction never committed
    clock.advance(minutes=1)
    assert fresh.run_jobs() == [] and fresh.get("SIM-TKT-0099").ticket.status == "RECEIVED"  # grace period
    clock.advance(minutes=2)
    assert fresh.run_jobs() == ["SIM-TKT-0099"]
    assert fresh.get("SIM-TKT-0099").ticket.status == "ROUTED"


# ---------------------------------------------------------------------- plan 05: one broken ticket never stops the job


def test_a_ticket_at_the_end_of_the_calendar_does_not_stop_the_job(fresh, clock):
    """Backend audit 2026-10-04 (A1): a created_at of 9999-12-31 23:59:59 overflowed in `_orphaned` (plan 04 E5)
    and the error, not an EngineError, stopped every run of the job for all tickets."""
    from datetime import datetime, timedelta, timezone

    far = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone(timedelta(hours=7)))
    fresh.ingest(
        RawTicket(
            ticket_id="SIM-TKT-0098",
            created_at=far.isoformat(timespec="seconds"),
            original_description=CLEANING,
            channel="form",
        )
    )
    fresh.ingest(
        RawTicket(
            ticket_id="SIM-TKT-0099",
            created_at=clock.now.isoformat(timespec="seconds"),
            original_description=CLEANING,
            channel="form",
        )
    )
    clock.advance(minutes=3)
    assert fresh.run_jobs() == ["SIM-TKT-0099"]  # the other orphan is still picked up
    assert fresh.get("SIM-TKT-0098").ticket.status == "RECEIVED"
