"""CR-BPTN-02 §7: the twelve acceptance tests (the resident API one lives in test_api.py)."""

from datetime import datetime, timedelta

import pytest

import src.maintenance.engine as engine_module
from src.maintenance.demo import evaluate
from src.maintenance.engine import ActionDeniedError, GuardError, InvalidTransitionError, MaintenanceEngine, can_route
from src.maintenance.proposer import LLMAssessment
from src.maintenance.views import resident_view
from tests.test_maintenance.helpers import (
    BPTN,
    BQL,
    CLEANING,
    CLN,
    LIGHTING,
    TEC,
    TZ,
    WAREHOUSE,
    finish,
    report,
    to_ready,
)


def timeline(engine, ticket_id):
    return [entry.status for entry in resident_view(engine, engine.get(ticket_id), engine.clock()).timeline]


def test_01_happy_path_has_five_resident_milestones(fresh):
    tid = report(fresh, "Hành lang tầng 3 tòa SIM-A nhiều rác")
    case = fresh.get(tid)
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_CLEANING"
    assert case.ticket.blocker is None and case.draft.assignee_id is None

    assert fresh.accept(tid, CLN).ticket.status == "IN_PROGRESS"
    assert finish(fresh, tid).ticket.status == "READY_FOR_REVIEW"
    assert fresh.close(tid, BQL).ticket.status == "CLOSED"
    assert timeline(fresh, tid) == ["RECEIVED", "ROUTED", "IN_PROGRESS", "READY_FOR_REVIEW", "CLOSED"]


def test_02_missing_location_waits_for_the_resident_then_continues(fresh):
    tid = report(fresh, "Nhiều rác quá, cần dọn gấp.")
    case = fresh.get(tid)
    assert case.ticket.status == "NEED_INFO" and case.ticket.blocker.code == "MISSING_INFO"
    assert case.ticket.blocker.resume_step == 2
    assert case.ticket.blocker.public_message == "Vui lòng bổ sung: vị trí (tòa, tầng, khu vực)."
    original, marker = case.ticket.raw.original_description, case.ticket.raw_integrity_marker

    case = fresh.add_resident_info(tid, "SIM-ACTOR-RESIDENT-01", "Ở hành lang tầng 3 tòa SIM-A")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_CLEANING"
    assert case.draft.location == "Tòa SIM-A / Tầng 3 / Hành lang"
    assert case.ticket.raw.original_description == original
    assert case.ticket.raw.integrity_marker() == marker
    assert [a.content for a in case.additions] == ["Ở hành lang tầng 3 tòa SIM-A"]


def test_03_bptn_category_is_locked_and_never_reclassified(fresh, monkeypatch):
    calls = []
    real = engine_module.propose
    monkeypatch.setattr(engine_module, "propose", lambda *a, **k: calls.append(a) or real(*a, **k))

    tid = report(fresh, "Hành lang tầng 3 tòa SIM-A nhiều rác và bóng đèn hành lang không sáng")
    case = fresh.get(tid)
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "CATEGORY_UNCLEAR"
    assert case.ticket.blocker.resume_step == 6 and len(calls) == 1

    case = fresh.bptn_resolve(tid, BPTN, category="VE_SINH", note="Cư dân xác nhận chủ yếu là rác")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_CLEANING"
    assert case.ticket.locked_fields.category == "VE_SINH"
    assert case.proposal.category_source == "BPTN_LOCKED"
    assert len(calls) == 1  # the Agent did not classify again
    assert [e.to_status for e in case.events][-3:] == ["VERIFYING", "RECEIVED", "ROUTED"]


def test_04_material_shortage_holds_then_resumes_on_stock_received(fresh, clock):
    fresh.stock["SIM-MAT-LAMP-01"] = 0
    tid = report(fresh, LIGHTING)
    case = fresh.get(tid)
    assert case.ticket.status == "ON_HOLD" and case.ticket.blocker.code == "WAITING_MATERIAL"
    assert case.ticket.blocker.owner_role == "WAREHOUSE" and case.ticket.blocker.resume_step == 7
    assert "Đang chờ vật tư, dự kiến xử lý trước" in case.ticket.blocker.public_message

    view = resident_view(fresh, case, clock.now)
    assert view.allowed_actions == []  # the ticket waits on stock, not on the resident
    with pytest.raises(GuardError):
        fresh.add_resident_info(tid, "SIM-ACTOR-RESIDENT-01", "Vẫn chưa sửa")
    assert view.eta == case.ticket.blocker.eta

    clock.advance(hours=25)  # past the eta, still no stock: never show a date in the past as the plan
    view = resident_view(fresh, fresh.get(tid), clock.now)
    assert view.eta is None and view.public_message.startswith("Việc xử lý đang chậm hơn dự kiến")

    fresh.receive_stock(WAREHOUSE, "SIM-MAT-LAMP-01", 5)
    case = fresh.get(tid)
    assert case.ticket.status == "ROUTED" and case.ticket.blocker is None
    assert [e.to_status for e in case.events][-2:] == ["RECEIVED", "ROUTED"]


def test_04b_no_stock_for_24h_escalates_without_changing_status(fresh, clock):
    fresh.stock["SIM-MAT-LAMP-01"] = 0
    tid = report(fresh, LIGHTING)
    for hours in range(1, 25):
        fresh.run_jobs(clock.now + timedelta(hours=hours))
    case = fresh.get(tid)
    assert case.ticket.status == "ON_HOLD"
    assert case.ticket.blocker.escalated is True
    assert any(n.type == "escalation" and n.audience == "BQL" for n in case.notifications)


def test_05_out_of_hours_is_dispatched_at_shift_start(fresh, clock):
    clock.now = datetime(2026, 9, 28, 23, tzinfo=TZ)
    tid = report(fresh, LIGHTING)
    case = fresh.get(tid)
    assert case.ticket.status == "ROUTED" and case.ticket.blocker.code == "OUT_OF_HOURS"
    shift_start = datetime(2026, 9, 29, 6, tzinfo=TZ)
    assert case.ticket.blocker.next_retry_at == shift_start
    assert case.ticket.blocker.public_message == "Phản ánh sẽ được xử lý từ 06:00 29/09/2026."

    assert fresh.run_jobs(shift_start - timedelta(minutes=5)) == []
    assert fresh.run_jobs(shift_start) == [tid]
    case = fresh.get(tid)
    assert case.ticket.status == "ROUTED" and case.ticket.blocker is None
    assert case.ticket.dispatched_at == shift_start
    assert case.notifications[-1].type == "department.dispatch"
    assert case.notifications[-1].audience == "DEPARTMENT"


def test_06_wrong_department_goes_back_to_bptn_and_reroutes(fresh):
    tid = report(fresh, CLEANING)
    case = fresh.return_wrong_department(tid, CLN, note="Thực ra là đèn hỏng, không phải rác")
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "WRONG_DEPT"

    case = fresh.bptn_resolve(tid, BPTN, category="KY_THUAT", note="Gọi lại cư dân: đèn hỏng")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_TECHNICAL"
    assert case.draft.playbook_id == "PB-TEC-01" and case.draft.department_id == "DEPT_TECHNICAL"
    assert case.ticket.asset_resolution == "FOUND" and case.proposal.asset_id == "SIM-ASSET-LIGHT-001"
    assert [m.item_code for m in case.material_lines] == ["SIM-MAT-LAMP-01"]
    assert fresh.accept(tid, TEC).ticket.status == "IN_PROGRESS"


def test_07_third_rework_escalates(fresh):
    tid = report(fresh, CLEANING)
    to_ready(fresh, tid)
    for round_ in (1, 2, 3):
        case = fresh.rework(tid, BQL, note=f"Còn bẩn (lần {round_})")
        assert case.ticket.status == "IN_PROGRESS" and case.ticket.rework_count == round_
        assert case.ticket.blocker.code == "REWORK"
        assert case.ticket.blocker.escalated is (round_ >= 3)
        if round_ < 3:
            finish(fresh, tid)
    assert any(n.type == "escalation" for n in fresh.get(tid).notifications)


@pytest.mark.parametrize("actor", ["SIM-ACTOR-AGENT", BPTN, CLN, "SIM-ACTOR-RESIDENT-01", WAREHOUSE])
@pytest.mark.parametrize("target", ["CLOSED", "CANCELLED"])
def test_08_only_bql_closes_or_cancels(fresh, actor, target):
    tid = report(fresh, CLEANING)
    to_ready(fresh, tid)
    with pytest.raises(ActionDeniedError):
        fresh.transition(tid, target, actor, cancel_reason="x")
    case = fresh.get(tid)
    assert case.ticket.status == "READY_FOR_REVIEW"
    assert case.audit[-1].action_result == "ACTION_DENIED"
    reason = {"cancel_reason": "Cư dân rút phản ánh"} if target == "CANCELLED" else {}
    assert fresh.transition(tid, target, BQL, **reason).ticket.status == target


def test_09_reopen_window(fresh, clock):
    early = report(fresh, CLEANING)
    late = report(fresh, LIGHTING)
    for tid in (early, late):
        to_ready(fresh, tid)
        fresh.close(tid, BQL)
    clock.advance(days=6)
    assert fresh.reopen(early, "SIM-ACTOR-RESIDENT-01", note="Vẫn còn rác").ticket.status == "READY_FOR_REVIEW"
    clock.advance(days=2)
    with pytest.raises(GuardError):
        fresh.reopen(late, "SIM-ACTOR-RESIDENT-01")
    assert fresh.get(late).ticket.status == "CLOSED"


def test_10_duplicate_is_merged_and_the_resident_sees_the_original(fresh, clock):
    first = report(fresh, LIGHTING)
    clock.advance(hours=3)
    second = report(fresh, "Bóng đèn hành lang tầng 3 tòa SIM-A tắt rồi", resident="SIM-ACTOR-RESIDENT-02")
    case = fresh.get(second)
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "DUPLICATE"
    assert case.ticket.blocker.related_ticket_id == first

    case = fresh.bptn_resolve(second, BPTN, merge=True)
    assert case.ticket.status == "MERGED" and case.ticket.merged_into == first
    view = resident_view(fresh, case, clock.now)
    assert view.merged_into.ticket_id == first and view.merged_into.status == "ROUTED"
    assert view.allowed_actions == []


def test_10b_rejected_duplicate_resumes_at_step_4(fresh, clock):
    first = report(fresh, LIGHTING)
    clock.advance(hours=1)
    second = report(fresh, LIGHTING)
    case = fresh.bptn_resolve(second, BPTN, merge=False, note="Hai đèn khác nhau")
    assert case.ticket.status == "ROUTED" and case.not_duplicate_of == [first]


def test_10c_duplicate_window_is_48h(fresh, clock):
    report(fresh, LIGHTING)
    clock.advance(hours=49)
    assert fresh.get(report(fresh, LIGHTING)).ticket.status == "ROUTED"


def test_11_resume_twice_writes_one_event(fresh, clock):
    clock.now = datetime(2026, 9, 28, 23, tzinfo=TZ)
    tid = report(fresh, LIGHTING)
    clock.now = datetime(2026, 9, 29, 6, tzinfo=TZ)
    before = len(fresh.get(tid).events)
    fresh.resume(tid)
    fresh.resume(tid)
    assert len(fresh.get(tid).events) == before + 1


# ---------------------------------------------------------------- amendment: review → asset → hand over


def llm_only_engine(clock):
    def llm(_):
        return LLMAssessment(service_category="KY_THUAT", ticket_type="COMMON_AREA_LIGHTING", reason="Bóng tuýp chết")

    e = MaintenanceEngine(clock=clock, llm=llm, llm_label="fake")
    e.reset(with_fixtures=False)
    return e


def actions_after(case, action):
    """Audit actions recorded after the last `action` event."""
    last = max(i for i, a in enumerate(case.audit) if a.action == action)
    return [a.action for a in case.audit[last + 1 :]]


@pytest.mark.parametrize("actor", ["SIM-ACTOR-SYSTEM", "SIM-ACTOR-AGENT", BPTN, TEC, BQL])
def test_13_pending_review_cannot_be_routed(clock, actor):
    e = llm_only_engine(clock)
    tid = report(e, "Hành lang tầng 3 tòa SIM-A tối om, bóng tuýp chết rồi")
    case = e.get(tid)
    assert case.ticket.blocker.code == "PENDING_REVIEW" and not can_route(case.ticket)
    with pytest.raises(ActionDeniedError):
        e.transition(tid, "ROUTED", actor)
    assert e.get(tid).ticket.status == "VERIFYING" and e.get(tid).ticket.department_id is None


def test_13b_the_guard_itself_refuses_routing_without_review(clock):
    """Even the internal path (pipeline/system) cannot hand over while review is pending."""
    e = llm_only_engine(clock)
    tid = report(e, "Hành lang tầng 3 tòa SIM-A tối om, bóng tuýp chết rồi")
    work = e.get(tid).model_copy(deep=True)
    e._set_ticket(work, status="RECEIVED", blocker=None)
    with pytest.raises(InvalidTransitionError) as err:
        e._apply_transition(
            work, "ROUTED", "SIM-ACTOR-SYSTEM", "SYSTEM", clock.now, department_id=work.ticket.proposed_department_id
        )
    assert err.value.detail["failing"] == ["review_status=PENDING_REVIEW", "asset_resolution=None"]


def test_14_asset_unclear_waits_for_bptn(fresh, clock):
    tid = report(fresh, "Đèn cầu thang bộ tầng 9 tòa SIM-A không sáng")  # no asset registered there
    for days in (1, 2, 3):
        fresh.run_jobs(clock.now + timedelta(days=days))
        fresh.resume(tid)
    case = fresh.get(tid)
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "ASSET_UNCLEAR"
    assert case.ticket.asset_resolution is None and case.ticket.department_id is None
    assert case.ticket.blocker.escalated  # it escalates, it never routes itself

    case = fresh.bptn_resolve(tid, BPTN, asset_id="SIM-ASSET-LIGHT-001", note="Cư dân nhầm, là đèn tầng 3")
    assert case.ticket.status == "ROUTED" and case.ticket.asset_resolution == "FOUND"
    assert case.ticket.department_id == "DEPT_TECHNICAL"


def test_15_wrong_department_to_lighting_goes_through_asset_lookup(fresh):
    tid = report(fresh, "Cầu thang bộ tầng 9 tòa SIM-A nhiều rác")
    fresh.return_wrong_department(tid, CLN, note="Không có rác, đèn cầu thang hỏng")
    assert fresh.get(tid).ticket.department_id is None

    case = fresh.bptn_resolve(tid, BPTN, category="KY_THUAT", note="Cư dân xác nhận đèn hỏng")
    assert "LOOKUP_ASSET" in actions_after(case, "BPTN_RESOLVE")
    # No lighting asset at that spot: the ticket stops at step 6 instead of reaching DEPT_TECHNICAL
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "ASSET_UNCLEAR"
    assert case.ticket.department_id is None and case.ticket.proposed_department_id == "DEPT_TECHNICAL"

    case = fresh.bptn_resolve(tid, BPTN, asset_onsite=True, note="Chưa có trong sổ tài sản")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_TECHNICAL"
    assert case.ticket.asset_resolution == "ONSITE_BY_BPTN"


def test_15b_wrong_department_same_category_resumes_at_step_7(fresh):
    tid = report(fresh, CLEANING)
    fresh.return_wrong_department(tid, CLN, note="Khu này do phòng kỹ thuật quản lý")
    case = fresh.bptn_resolve(tid, BPTN, department="DEPT_TECHNICAL", note="Đúng, khu kỹ thuật")
    after = actions_after(case, "BPTN_RESOLVE")
    assert "LOOKUP_ASSET" not in after and "CHECK_MATERIAL_STOCK" in after
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_TECHNICAL"
    assert case.ticket.locked_fields.department == "DEPT_TECHNICAL"


def test_invariant_6_every_handed_over_ticket_satisfied_can_route(engine):
    evaluate(engine)
    for case in engine.cases.values():
        if case.ticket.department_id is not None:
            assert can_route(case.ticket), case.ticket.ticket_id
        else:
            assert case.ticket.status not in ("ROUTED", "IN_PROGRESS", "READY_FOR_REVIEW", "CLOSED")
