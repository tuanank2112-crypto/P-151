"""Safety/emergency flow (SPEC-P02): human actions of BPTN/BQL, resume/job guard, deadlines, outbox, resident label."""

import json
from datetime import timedelta

import pytest

from src.maintenance.engine import (
    ActionDeniedError,
    AuditWriteError,
    GuardError,
    InvalidTransitionError,
    MaintenanceEngine,
)
from src.maintenance.enums import Action, BlockerOwner, RiskLevel
from src.maintenance.views import bql_rows, resident_view
from tests.test_maintenance.helpers import (
    AGENT,
    BPTN,
    BQL,
    CLEANING,
    CLN,
    RESIDENT,
    SYSTEM,
    WAREHOUSE,
    report,
    to_ready,
)

TIER2 = "Hình như có mùi khét ở hành lang tầng 3 tòa S1."
TIER2_LAMP = "Hình như có mùi khét, đèn hành lang tầng 3 tòa S1 không sáng."
TEC005 = "SIM-TKT-TEC-005"
FORBIDDEN_FOR_RESIDENT = (
    "EMERGENCY",
    "SAFETY",
    "risk",
    "S-0",
    "T2-",
    "khẩn cấp",
    "nguy hiểm",
    "priority",
    "HIGH",
    "reason_code",
    "internal_note",
)


def last_audit(engine, ticket_id):
    return engine.get(ticket_id).audit[-1]


def count(case, action):
    return sum(e.action == action for e in case.audit)


def request_info(fresh, text=TIER2):
    tid = report(fresh, text)
    return tid, fresh.safety_request_info(tid, BPTN, note="Hỏi rõ mùi")


def test_bptn_confirm_safe_resumes_pipeline(fresh):
    """E-01/E-02, AC-06: BPTN clears tier 2 with a reason; the pipeline restarts and 2b does not run again."""
    tid = report(fresh, TIER2)
    case = fresh.safety_confirm_safe(tid, BPTN, note="Đã gọi cư dân, chỉ là mùi sơn")
    assert [e.to_status for e in case.events][-3:] == ["VERIFYING", "RECEIVED", "VERIFYING"]
    assert case.ticket.blocker.code == "OUT_OF_SCOPE"  # not a lamp report: step 3 stops it
    assert (case.ticket.risk_level, case.ticket.safety_cleared_by) == (RiskLevel.NONE, BPTN)
    assert case.ticket.safety_clear_reason == "Đã gọi cư dân, chỉ là mùi sơn"
    assert count(case, Action.SAFETY_CONFIRM_SAFE) == 1 and count(case, Action.ASSESS_SAFETY) == 1
    lamp = fresh.safety_confirm_safe(report(fresh, TIER2_LAMP), BPTN, note="Đã gọi cư dân, mùi sơn")
    assert lamp.ticket.status == "ROUTED" and lamp.ticket.department_id == "DEPT_TECHNICAL"
    assert (lamp.ticket.priority, lamp.ticket.priority_rule_id) == ("HIGH", "PRI-H1")
    assert lamp.ticket.risk_level == RiskLevel.NONE


def test_bptn_confirm_safe_needs_note(fresh):
    """E-03, AC-06: a blank reason is a GuardError and nothing changes."""
    tid = report(fresh, TIER2_LAMP)
    before = len(fresh.get(tid).events)
    for blank in ("  ", ""):
        with pytest.raises(GuardError):
            fresh.safety_confirm_safe(tid, BPTN, note=blank)
    case = fresh.get(tid)
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "SAFETY_REVIEW_REQUIRED")
    assert len(case.events) == before


def test_bptn_escalate_e01_changes_owner_not_status(fresh):
    """E-04 (E01): the owner becomes BQL, the status stays VERIFYING, one public event and one outbox row."""
    tid = report(fresh, TIER2)
    before = fresh.get(tid)
    case = fresh.safety_escalate(tid, BPTN)
    ticket = case.ticket
    assert (ticket.status, ticket.blocker.code, ticket.blocker.owner_role) == (
        "VERIFYING",
        "EMERGENCY_PENDING_BQL",
        "BQL",
    )
    assert ticket.risk_level == RiskLevel.EMERGENCY and ticket.blocker.escalate_at is None
    assert len(case.events) == len(before.events) + 1 and case.events[-1].public
    assert [n.type for n in case.notifications].count("emergency.created") == 1
    assert count(case, Action.SAFETY_ESCALATE) == 1


def test_bptn_cannot_touch_emergency_action_denied(fresh):
    """E-04/E-13, AC-06, I-11: once tier 1, every BPTN write is ACTION_DENIED with an audit row."""
    tid = report(fresh, TIER2)
    fresh.safety_escalate(tid, BPTN)
    for call in (
        lambda: fresh.safety_confirm_safe(tid, BPTN, note="x"),
        lambda: fresh.safety_escalate(tid, BPTN),
        lambda: fresh.safety_request_info(tid, BPTN, note="x"),
        lambda: fresh.emergency_downgrade(tid, BPTN, note="x"),
        lambda: fresh.emergency_close(tid, BPTN, note="x"),
        lambda: fresh.transition(tid, "RECEIVED", BPTN, note="x"),
    ):
        with pytest.raises(ActionDeniedError):
            call()
        assert last_audit(fresh, tid).action_result == "ACTION_DENIED"
    case = fresh.get(tid)
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")


def test_bptn_request_info_sets_safety_context_12h(fresh):
    """E-05 (T06): VERIFYING → NEED_INFO with safety_context, a 12 h deadline and neutral wording for the resident."""
    tid, case = request_info(fresh)
    ticket = case.ticket
    assert (ticket.status, ticket.blocker.code, ticket.safety_context) == ("NEED_INFO", "MISSING_INFO", True)
    assert ticket.blocker.escalate_at == fresh.clock() + timedelta(hours=12)
    assert ticket.blocker.public_message.startswith("Vui lòng bổ sung: mô tả rõ hơn")
    assert ticket.blocker.owner_role == "RESIDENT" and count(case, Action.SAFETY_REQUEST_INFO) == 1
    with pytest.raises(GuardError):
        fresh.safety_request_info(report(fresh, TIER2.replace("tầng 3", "tầng 4")), BPTN, note=" ")


def test_safety_need_info_escalates_12h_and_job_never_auto_clears(fresh, clock):
    """E-05, AC-08: after 12 h BQL is told (`escalation`, safety_context true); the job never calls it safe."""
    tid, _ = request_info(fresh)
    assert fresh.run_jobs(clock() + timedelta(hours=11)) == []
    assert fresh.run_jobs(clock() + timedelta(hours=13)) == [tid]
    case = fresh.get(tid)
    assert (case.ticket.status, case.ticket.blocker.escalated) == ("NEED_INFO", True)
    assert case.notifications[-1].type == "escalation" and case.notifications[-1].payload["safety_context"] is True
    events = len(case.events)
    fresh.resume(tid)
    fresh.run_jobs(clock() + timedelta(days=5))
    assert (fresh.get(tid).ticket.status, len(fresh.get(tid).events)) == ("NEED_INFO", events)


def test_resident_addition_reruns_2b(fresh, clock):
    """E-06, AC-08: the resident's answer reruns 2b on the whole text; a tier-1 answer ends in EMERGENCY_PENDING_BQL."""
    tid, _ = request_info(fresh)
    clock.advance(hours=1)
    case = fresh.add_resident_info(tid, RESIDENT, "Vẫn còn mùi khét rõ, rất nồng")
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert case.ticket.safety_context is False and count(case, Action.ASSESS_SAFETY) == 2
    assert case.ticket.raw.original_description == TIER2  # the original never changes


def test_bql_t07_escalate_from_need_info(fresh):
    """E-07 (T07): only BQL escalates a safety NEED_INFO."""
    tid, _ = request_info(fresh)
    with pytest.raises(ActionDeniedError):
        fresh.safety_escalate(tid, BPTN)
    assert last_audit(fresh, tid).action_result == "ACTION_DENIED"
    case = fresh.safety_escalate(tid, BQL)
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert case.ticket.safety_context is False and case.notifications[-1].type == "emergency.created"
    assert case.notifications[-1].payload["from"] == "MISSING_INFO"


def test_bql_t03_confirm_safe_from_need_info(fresh):
    """E-08 (T03): only BQL, with a reason, clears a safety NEED_INFO; the pipeline then routes the lamp report."""
    tid, _ = request_info(fresh, TIER2_LAMP)
    with pytest.raises(ActionDeniedError):
        fresh.safety_confirm_safe(tid, BPTN, note="x")
    with pytest.raises(GuardError):
        fresh.safety_confirm_safe(tid, BQL, note=" ")
    case = fresh.safety_confirm_safe(tid, BQL, note="Gọi cư dân, an toàn")
    assert case.ticket.status == "ROUTED" and case.ticket.safety_cleared_by == BQL
    assert case.ticket.safety_context is False and count(case, Action.SAFETY_CONFIRM_SAFE) == 1


def test_safety_review_only_escalates_never_clears(fresh, clock):
    """E-09, AC-07: tier 2 is escalated at exactly 4 calendar hours; the blocker and the status stay."""
    tid = report(fresh, TIER2)
    assert fresh.run_jobs(clock() + timedelta(hours=3, minutes=59)) == []
    assert fresh.run_jobs(clock() + timedelta(hours=4)) == [tid]
    case = fresh.get(tid)
    assert case.ticket.blocker.escalated is True and case.notifications[-1].type == "safety.review_escalated"
    assert (
        case.notifications[-1].audience == BlockerOwner.BQL
        and case.notifications[-1].payload["safety_context"] is False
    )
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "SAFETY_REVIEW_REQUIRED")
    assert fresh.run_jobs(clock() + timedelta(days=9)) == []  # escalated once only


def test_resume_and_jobs_never_clear_emergency(engine):
    """E-10, AC-07, I-10: resume() and run_jobs() leave a tier-1 ticket untouched."""
    before = engine.get(TEC005)
    for _ in range(3):
        engine.resume(TEC005)
    changed = engine.run_jobs(engine.clock() + timedelta(days=30))
    after = engine.get(TEC005)
    assert TEC005 not in changed
    assert (after.ticket.status, after.ticket.blocker) == (before.ticket.status, before.ticket.blocker)
    assert len(after.events) == len(before.events)


def test_bql_emergency_close(engine):
    """E-11, AC-09, I-07: BQL closes with a note; closure_kind=EMERGENCY_HANDLED, no department; the resident can rate."""
    with pytest.raises(GuardError):
        engine.emergency_close(TEC005, BQL, note="")
    case = engine.emergency_close(TEC005, BQL, note="Đã cắt điện hộp đèn, kỹ thuật xử lý tại chỗ")
    ticket = case.ticket
    assert (ticket.status, ticket.closure_kind, ticket.department_id, ticket.blocker) == (
        "CLOSED",
        "EMERGENCY_HANDLED",
        None,
        None,
    )
    assert ticket.closed_by == BQL and count(case, Action.EMERGENCY_CLOSE) == 1
    view = resident_view(engine, case, engine.clock())
    assert view.status_label == "Hoàn thành" and view.allowed_actions == ["RATE"]


def test_plain_close_rejects_emergency(engine):
    """OPERATIONS §5.3: `close` only closes from READY_FOR_REVIEW; an emergency is closed by `emergency_close` alone."""
    before = engine.get(TEC005)
    with pytest.raises(InvalidTransitionError):
        engine.close(TEC005, BQL, note="Đã xử lý tại chỗ")
    after = engine.get(TEC005)
    assert (after.ticket.status, after.ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert count(after, Action.EMERGENCY_CLOSE) == 0 and len(after.events) == len(before.events)


def test_bql_downgrade_routes_normally(engine):
    """E-12, AC-09: a false alarm goes back to the normal flow (the lift-lobby asset matches: ROUTED)."""
    related = engine.get(TEC005).ticket.related_ticket_ids
    with pytest.raises(GuardError):
        engine.emergency_downgrade(TEC005, BQL, note=" ")
    case = engine.emergency_downgrade(TEC005, BQL, note="Báo nhầm: khét từ bếp căn hộ")
    ticket = case.ticket
    assert (ticket.status, ticket.risk_level) == ("ROUTED", RiskLevel.NONE)
    assert case.proposal.asset_id == "SIM-ASSET-LIGHT-LIFT-LOBBY"
    assert ticket.safety_cleared_by == BQL and ticket.related_ticket_ids == related
    assert count(case, Action.EMERGENCY_DOWNGRADE) == 1 and count(case, Action.ASSESS_SAFETY) == 1


def test_bptn_resolve_rejects_safety_blockers(engine, fresh):
    """E-13/X-2, CR-03 §4.4.5 + AC-06: on a BQL-owned blocker every BPTN write, bptn_resolve included, is a 403 with
    audit and no state change; on SAFETY_REVIEW_REQUIRED (BPTN-owned) bptn_resolve stays a 409 GuardError."""
    before = engine.get(TEC005)
    with pytest.raises(ActionDeniedError):
        engine.bptn_resolve(TEC005, BPTN, note="x")
    denied = engine.get(TEC005)
    assert denied.audit[-1].action_result == "ACTION_DENIED" and denied.audit[-1].reason.endswith(
        "(requested=BPTN_RESOLVE)"
    )
    assert (denied.ticket.status, denied.ticket.blocker) == (before.ticket.status, before.ticket.blocker)
    assert len(denied.events) == len(before.events)
    with pytest.raises(ActionDeniedError):
        engine.attempt(TEC005, BPTN, Action.EDIT_RAW, field_name="original_description", new_value="x", reason="t")
    assert last_audit(engine, TEC005).action_result == "ACTION_DENIED"
    with pytest.raises(ActionDeniedError):
        engine.set_priority(TEC005, BPTN, "HIGH", note="x")
    assert last_audit(engine, TEC005).action_result == "ACTION_DENIED" and engine.get(TEC005).ticket.priority is None
    tid = report(fresh, TIER2)
    with pytest.raises(GuardError):
        fresh.bptn_resolve(tid, BPTN, note="x")
    assert fresh.get(tid).ticket.blocker.code == "SAFETY_REVIEW_REQUIRED"


def test_pairs_outside_table_are_invalid(engine, fresh):
    """E-14, AC-16: pairs outside the table are INVALID_TRANSITION; a role that reaches no such target is denied."""
    with pytest.raises(InvalidTransitionError):
        engine.transition("SIM-TKT-CLN-001", "CLOSED", BQL, note="x")  # ROUTED → CLOSED
    with pytest.raises(InvalidTransitionError):
        engine.transition("SIM-TKT-TEC-002", "CLOSED", BQL, note="x")  # ROUTED → CLOSED
    plain = report(fresh, "Nhiều rác quá, cần dọn")  # NEED_INFO / MISSING_INFO without safety_context
    with pytest.raises(InvalidTransitionError):
        fresh.transition(plain, "VERIFYING", BQL)
    closed = report(fresh, CLEANING)
    to_ready(fresh, closed)
    fresh.close(closed, BQL)
    with pytest.raises(ActionDeniedError):
        fresh.transition(closed, "READY_FOR_REVIEW", RESIDENT)
    assert last_audit(fresh, closed).action_result == "ACTION_DENIED"


@pytest.mark.parametrize(
    "actor", [RESIDENT, AGENT, BPTN, CLN, WAREHOUSE], ids=["RESIDENT", "AGENT", "BPTN", "DEPT", "WH"]
)
def test_only_bql_reaches_closed_from_verifying(engine, actor):
    """I-07, AC-16: no role but BQL closes from VERIFYING; the denial is audited and the ticket is untouched."""
    with pytest.raises(ActionDeniedError):
        engine.transition(TEC005, "CLOSED", actor, note="x")
    case = engine.get(TEC005)
    assert case.audit[-1].action_result == "ACTION_DENIED" and case.ticket.status == "VERIFYING"


def test_system_actor_cannot_move_verifying_to_received(engine):
    """§11: the SYSTEM actor used from outside gets INVALID_TRANSITION on VERIFYING → RECEIVED."""
    with pytest.raises(InvalidTransitionError):
        engine.transition(TEC005, "RECEIVED", SYSTEM, note="x")
    assert engine.get(TEC005).ticket.status == "VERIFYING"


def test_resident_view_hides_risk_and_shows_checking_label(engine):
    """E-15, AC-17, I-14: the resident sees one neutral label and message; no risk wording or internal field."""
    case = engine.get(TEC005)
    view = resident_view(engine, case, engine.clock())
    assert view.status_label == "Đang được kiểm tra" and view.public_message == "Phản ánh đang được kiểm tra."
    assert view.department_name is None and view.allowed_actions == []
    text = json.dumps(view.model_dump(mode="json"), ensure_ascii=False)
    for banned in FORBIDDEN_FOR_RESIDENT:
        assert banned not in text, banned


def test_bql_rows_expose_risk_owner_and_filters(engine):
    """P02 §9 / 01 §8: BQL rows carry risk and owner; tier 1 sorts first; the new filters work."""
    rows = bql_rows(engine, engine.clock())
    assert [r.ticket_id for r in rows[:2]] == ["SIM-TKT-CLN-004", TEC005]
    assert all(r.risk_level == "EMERGENCY" and r.blocker_owner_role == "BQL" for r in rows[:2])
    assert {r.ticket_id for r in bql_rows(engine, engine.clock(), risk_level=RiskLevel.EMERGENCY)} == {
        "SIM-TKT-CLN-004",
        TEC005,
    }
    mine = bql_rows(engine, engine.clock(), blocker_owner_role=BlockerOwner.BQL)
    assert {r.ticket_id for r in mine} == {"SIM-TKT-CLN-004", TEC005}
    assert "SIM-TKT-CLN-003" in {
        r.ticket_id for r in bql_rows(engine, engine.clock(), blocker_owner_role=BlockerOwner.BPTN)
    }


def test_audit_failure_rolls_back_safety_action(clock):
    """I-02: a failing audit sink on safety_confirm_safe leaves the ticket as it was."""
    failing = {"on": False}

    def sink(rows):
        if failing["on"]:
            raise OSError("disk full")

    engine = MaintenanceEngine(clock=clock, audit_sink=sink)
    engine.reset(with_fixtures=False)
    tid = report(engine, TIER2_LAMP)
    failing["on"] = True
    with pytest.raises(AuditWriteError):
        engine.safety_confirm_safe(tid, BPTN, note="an toàn")
    case = engine.get(tid)
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "SAFETY_REVIEW_REQUIRED")
    assert case.ticket.safety_cleared_by is None


def test_emergency_created_notification_payload(fresh):
    """P02 §8: emergency.created goes to BQL only, from 2b, E01 and T07, with the documented payload keys."""
    tier1 = fresh.get(report(fresh, "Có tia lửa ở hộp đèn hành lang tầng 3 tòa S1."))
    created = [n for n in tier1.notifications if n.type == "emergency.created"]
    assert [n.audience for n in created] == ["BQL"] and created[0].payload["signal_ids"] == ["S-02"]
    e01 = fresh.safety_escalate(report(fresh, TIER2.replace("tầng 3", "tầng 5")), BPTN)
    note = [n for n in e01.notifications if n.type == "emergency.created"][-1]
    assert (
        note.audience == "BQL"
        and note.payload["escalated_by"] == BPTN
        and note.payload["from"] == "SAFETY_REVIEW_REQUIRED"
    )
    assert all(n.audience == "BQL" for c in (tier1, e01) for n in c.notifications if n.type == "emergency.created")


def test_bql_tier2_choices_need_escalation(fresh, clock):
    """Q19 (CR-03 §2): BQL uses the three tier-2 choices only after the ticket has been escalated; BPTN always may."""
    tid = report(fresh, TIER2)
    for call in (
        lambda: fresh.safety_confirm_safe(tid, BQL, note="x"),
        lambda: fresh.safety_escalate(tid, BQL),
        lambda: fresh.safety_request_info(tid, BQL, note="x"),
        lambda: fresh.transition(tid, "RECEIVED", BQL, note="x"),
    ):
        with pytest.raises(ActionDeniedError):
            call()
        assert last_audit(fresh, tid).action_result == "ACTION_DENIED"
    assert fresh.get(tid).ticket.blocker.code == "SAFETY_REVIEW_REQUIRED"
    fresh.run_jobs(clock() + timedelta(hours=4))
    case = fresh.safety_request_info(tid, BQL, note="Quá hạn, hỏi lại cư dân")
    assert case.ticket.status == "NEED_INFO" and case.ticket.safety_context is True
