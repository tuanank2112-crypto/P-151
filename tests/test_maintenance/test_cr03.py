"""CR-BPTN-03 §15 acceptance tests (AC-01 … AC-16) on the engine. The labelled sentence set is in test_safety.py."""

from datetime import timedelta

import pytest

from src.maintenance.engine import ActionDeniedError, GuardError, InvalidTransitionError, MaintenanceEngine, can_route
from src.maintenance.enums import ChecklistStatus
from src.maintenance.models import Ticket
from src.maintenance.priority import decide
from src.maintenance.proposer import LLMAssessment, LLMRiskSignal
from src.maintenance.views import bql_rows, resident_view, safety_clearances
from tests.test_maintenance.helpers import (
    BPTN,
    BQL,
    CLEANING,
    CLN,
    LIGHTING,
    OTHER_RESIDENT,
    RESIDENT,
    TEC,
    WAREHOUSE,
    do_work,
    finish,
    report,
    to_ready,
)

PLACE = "hành lang tầng 3 tòa SIM-A"
EMERGENCY_TEXT = f"Đèn {PLACE} không sáng, hộp đèn bốc khói và có tia lửa"
TIER2_TEXT = f"Đèn {PLACE} không sáng, hình như có mùi khét"


def blocker(engine, tid):
    return engine.get(tid).ticket.blocker


# ---------------------------------------------------------------- AC-01 … AC-04: step 3b


@pytest.mark.parametrize(
    "text",
    [
        f"Đèn {PLACE} có mùi khét",
        f"Công tắc đèn {PLACE} tóe lửa",
        f"Dây điện hở ở đèn {PLACE}",
        EMERGENCY_TEXT,
        f"Tủ điện {PLACE} đang cháy",
        f"Có người bị thương ở {PLACE} vì đèn tối",
        f"Chất lỏng lạ ở {PLACE}, mùi hắc gây khó thở",
    ],
)
def test_ac01_tier1_goes_to_bql_without_draft_or_department(fresh, text):
    tid = report(fresh, text)
    case = fresh.get(tid)
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    assert case.ticket.blocker.owner_role == "BQL" and case.ticket.blocker.resume_step is None
    assert case.ticket.risk_level == "EMERGENCY" and not can_route(case.ticket)
    assert case.draft is None and case.ticket.department_id is None
    assert any(n.type == "emergency.created" and n.audience == "BQL" for n in case.notifications)
    assert case.ticket.blocker.public_message == "Phản ánh đang được kiểm tra."  # no risk detail for the resident


def test_ac02_out_of_scope_report_with_a_tier1_signal_is_still_an_emergency(fresh):
    case = fresh.get(report(fresh, f"Ở {PLACE} có mùi gas rất nặng"))
    assert case.classification.playbook_id is None  # no playbook: CATEGORY/OUT_OF_SCOPE would have stopped it
    assert case.ticket.blocker.code == "EMERGENCY_PENDING_BQL"


def test_ac03_a_burnt_bulb_alone_is_benign_but_with_smoke_it_is_not(fresh, clock):
    benign = fresh.get(report(fresh, f"Bóng đèn {PLACE} bị cháy"))
    assert benign.ticket.status == "ROUTED" and benign.ticket.risk_level == "NONE"
    clock.advance(hours=72)  # outside the duplicate window
    smoke = fresh.get(report(fresh, f"Bóng đèn {PLACE} cháy kèm khói"))
    assert smoke.ticket.blocker.code == "EMERGENCY_PENDING_BQL"


def test_ac04_negation_does_not_trigger_and_a_hedge_goes_to_bptn(fresh, clock):
    calm = fresh.get(report(fresh, f"Không có mùi khét, chỉ là đèn {PLACE} không sáng"))
    assert calm.ticket.status == "ROUTED"
    clock.advance(hours=72)
    unsure = fresh.get(report(fresh, TIER2_TEXT))
    assert unsure.ticket.status == "VERIFYING" and unsure.ticket.blocker.code == "SAFETY_REVIEW_REQUIRED"
    assert unsure.ticket.blocker.owner_role == "BPTN" and unsure.ticket.risk_level == "UNCLEAR"
    assert unsure.draft is None


def test_ac04b_safety_runs_before_an_unclear_category_stops(fresh):
    case = fresh.get(report(fresh, f"Hình như có mùi khét ở {PLACE}, thang máy cũng kêu"))
    assert case.ticket.blocker.code == "SAFETY_REVIEW_REQUIRED"
    case = fresh.safety_review(case.ticket.ticket_id, BPTN, decision="CONFIRM_SAFE", note="Gọi cư dân: cơm khét")
    assert case.ticket.blocker.code == "OUT_OF_SCOPE"  # resumed at step 3, then the category stop


# ---------------------------------------------------------------- AC-05: the model only raises


def test_ac05_model_signal_raises_a_calm_report(clock):
    def llm(_):
        return LLMAssessment(
            service_category="KY_THUAT",
            ticket_type="COMMON_AREA_LIGHTING",
            reason="Đèn hỏng",
            risk_signals=[LLMRiskSignal(signal_id="S-04", status="PRESENT", source_quote="không sáng")],
        )

    e = MaintenanceEngine(clock=clock, llm=llm, llm_label="fake")
    e.reset(with_fixtures=False)
    case = e.get(report(e, LIGHTING))
    assert case.ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    assert [s.detected_by for s in case.ticket.risk_signals] == ["LLM"]


# ---------------------------------------------------------------- AC-06 … AC-08: BPTN's three answers


def test_ac06_confirm_safe_needs_a_reason_and_bptn_cannot_touch_tier1(fresh, clock):
    tid = report(fresh, TIER2_TEXT)
    with pytest.raises(GuardError):
        fresh.safety_review(tid, BPTN, decision="CONFIRM_SAFE")
    case = fresh.safety_review(tid, BPTN, decision="CONFIRM_SAFE", note="Gọi cư dân: không có mùi nữa")
    assert case.ticket.status == "ROUTED" and case.ticket.safety_cleared_by == BPTN
    assert case.ticket.risk_level == "NONE" and any(a.action == "SAFETY_CONFIRM_SAFE" for a in case.audit)
    assert [c.ticket_id for c in safety_clearances(fresh)] == [tid]

    clock.advance(hours=72)
    hot = report(fresh, EMERGENCY_TEXT)
    for attempt in (
        lambda: fresh.safety_review(hot, BPTN, decision="CONFIRM_SAFE", note="x"),
        lambda: fresh.bptn_resolve(hot, BPTN, note="x"),
        lambda: fresh.emergency_downgrade(hot, BPTN, note="x"),
    ):
        with pytest.raises(ActionDeniedError):
            attempt()
        assert fresh.get(hot).audit[-1].action_result == "ACTION_DENIED"
    assert blocker(fresh, hot).code == "EMERGENCY_PENDING_BQL"


def test_ac06b_bptn_escalates_and_cannot_take_it_back(fresh):
    tid = report(fresh, TIER2_TEXT)
    case = fresh.safety_review(tid, BPTN, decision="ESCALATE")
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    assert case.ticket.blocker.owner_role == "BQL" and case.ticket.risk_level == "EMERGENCY"
    with pytest.raises(ActionDeniedError):
        fresh.safety_review(tid, BPTN, decision="CONFIRM_SAFE", note="Nhầm")


def test_ac07_nothing_automatic_clears_an_emergency(fresh, clock):
    tid = report(fresh, EMERGENCY_TEXT)
    before = fresh.get(tid)
    for days in (1, 3, 10):
        fresh.run_jobs(clock.now + timedelta(days=days))
        fresh.resume(tid)
    after = fresh.get(tid)
    assert after.ticket.status == "VERIFYING" and after.ticket.blocker == before.ticket.blocker
    assert len(after.events) == len(before.events)


def test_ac08_an_addition_runs_3b_again(fresh):
    tid = report(fresh, TIER2_TEXT)
    case = fresh.safety_review(tid, BPTN, decision="REQUEST_INFO", note="Hỏi cư dân còn mùi không")
    assert case.ticket.status == "NEED_INFO" and case.ticket.safety_context
    assert case.ticket.blocker.owner_role == "BPTN" and case.ticket.blocker.next_retry_at is None
    view = resident_view(fresh, case, fresh.clock())
    assert view.allowed_actions == ["ADD_INFO"] and "mô tả thêm tình trạng" in view.public_message
    case = fresh.add_resident_info(tid, RESIDENT, "Vẫn còn mùi khét ở hộp đèn, nóng ran")
    assert case.ticket.blocker.code == "EMERGENCY_PENDING_BQL" and not case.ticket.safety_context


def test_ac08b_an_unanswered_safety_question_escalates_and_is_never_safe_by_itself(fresh, clock):
    tid = report(fresh, TIER2_TEXT)
    fresh.safety_review(tid, BPTN, decision="REQUEST_INFO", note="Hỏi cư dân")
    start = clock.now
    fresh.run_jobs(start + timedelta(hours=11))
    assert not blocker(fresh, tid).escalated
    fresh.run_jobs(start + timedelta(hours=12))
    case = fresh.get(tid)
    assert case.ticket.status == "NEED_INFO" and case.ticket.blocker.escalated
    assert case.notifications[-1].type == "safety.review_escalated" and case.notifications[-1].audience == "BQL"
    with pytest.raises(InvalidTransitionError):
        fresh.transition(tid, "RECEIVED", BPTN, note="x")  # T03 is BQL only
    case = fresh.safety_review(tid, BQL, decision="CONFIRM_SAFE", note="Kỹ thuật kiểm tra: an toàn")
    assert case.ticket.status == "ROUTED" and case.ticket.safety_cleared_by == BQL


def test_ac08c_bql_raises_an_unanswered_safety_question(fresh):
    tid = report(fresh, TIER2_TEXT)
    fresh.safety_review(tid, BPTN, decision="REQUEST_INFO", note="Hỏi cư dân")
    case = fresh.safety_review(tid, BQL, decision="ESCALATE", note="Cư dân không nghe máy, để an toàn")
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "EMERGENCY_PENDING_BQL"


def test_ac08d_tier2_waiting_for_bptn_escalates_after_four_calendar_hours(fresh, clock):
    tid = report(fresh, TIER2_TEXT)
    assert blocker(fresh, tid).escalate_at == clock.now + timedelta(hours=4)
    fresh.run_jobs(clock.now + timedelta(hours=4))
    case = fresh.get(tid)
    assert case.ticket.blocker.escalated and case.ticket.status == "VERIFYING"
    assert case.notifications[-1].type == "safety.review_escalated"


def test_ac08e_a_location_added_later_still_goes_through_3b(fresh):
    tid = report(fresh, "Hình như có mùi khét ở đèn")
    assert fresh.get(tid).ticket.status == "NEED_INFO"
    case = fresh.add_resident_info(tid, RESIDENT, "Hành lang tầng 3 tòa SIM-A")
    assert case.ticket.blocker.code == "SAFETY_REVIEW_REQUIRED"


def test_ac08f_after_confirm_safe_only_new_content_is_assessed(fresh):
    tid = report(fresh, "Hình như có mùi khét")  # no location: NEED_INFO first
    case = fresh.add_resident_info(tid, RESIDENT, "Đèn hành lang tầng 3 tòa SIM-A không sáng")
    assert case.ticket.blocker.code == "SAFETY_REVIEW_REQUIRED"
    case = fresh.safety_review(tid, BPTN, decision="CONFIRM_SAFE", note="Mùi từ bếp, không phải điện")
    assert case.ticket.status == "ROUTED"  # the old tier-2 signal does not come back


# ---------------------------------------------------------------- AC-09: BQL and an emergency


def test_ac09_bql_closes_an_emergency_with_a_result_note(fresh):
    tid = report(fresh, EMERGENCY_TEXT)
    with pytest.raises(GuardError):
        fresh.emergency_close(tid, BQL, note=" ")
    case = fresh.emergency_close(tid, BQL, note="Đã ngắt cầu dao, kỹ thuật xử lý xong")
    assert case.ticket.status == "CLOSED" and case.ticket.closure_kind == "EMERGENCY_HANDLED"
    assert case.ticket.department_id is None
    view = resident_view(fresh, case, fresh.clock())
    assert view.public_message == "Sự việc đã được Ban quản lý xử lý." and view.allowed_actions == ["RATE"]


def test_ac09b_false_alarm_goes_back_to_the_normal_flow(fresh):
    tid = report(fresh, EMERGENCY_TEXT)
    case = fresh.emergency_downgrade(tid, BQL, note="Khói từ khu nướng BBQ, đèn chỉ hỏng")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_TECHNICAL"
    assert case.ticket.safety_cleared_by == BQL and case.draft is not None
    assert any(a.action == "EMERGENCY_DOWNGRADE" for a in case.audit)


def test_ac09c_follow_up_ticket_inherits_and_routes(fresh):
    tid = report(fresh, EMERGENCY_TEXT)
    follow = fresh.create_follow_up(tid, BQL, note="Đã xử lý khẩn cấp, cần thay bộ đèn")
    assert follow.ticket.ticket_id != tid and follow.ticket.follow_up_of == tid
    assert follow.ticket.status == "ROUTED" and follow.ticket.safety_cleared_by == BQL
    assert follow.ticket.raw.channel == "follow_up" and follow.ticket.resident_id == RESIDENT
    emergency = fresh.get(tid)
    assert emergency.ticket.status == "VERIFYING" and emergency.audit[-1].new_value == follow.ticket.ticket_id
    assert fresh.emergency_close(tid, BQL, note="Đã an toàn, việc sửa chuyển ticket mới").ticket.status == "CLOSED"


# ---------------------------------------------------------------- AC-10: priority


@pytest.mark.parametrize(
    ("text", "priority", "rule"),
    [
        (LIGHTING, "HIGH", "PRI-H1"),
        ("Sảnh chính tòa SIM-B sàn trơn trượt, cần vệ sinh", "HIGH", "PRI-H2"),
        (CLEANING, "MEDIUM", "PRI-M2"),
        ("Cầu thang bộ tầng 6 tòa SIM-A nhiều bụi bẩn, cần vệ sinh", "LOW", "PRI-L1"),
        ("Sảnh thang máy tầng 3 tòa SIM-A: thang máy kêu rất to", "MEDIUM", "PRI-D0"),
    ],
)
def test_ac10_each_priority_rule(fresh, text, priority, rule):
    ticket = fresh.get(report(fresh, text)).ticket
    assert (ticket.priority, ticket.priority_rule_id, ticket.priority_source) == (priority, rule, "AGENT_RULE")


def test_ac10b_m1_and_the_adjustments():
    other_place = decide(
        "KY_THUAT",
        "Tòa SIM-A / Tầng 2 / Phòng sinh hoạt",
        "Đèn không sáng",
        duplicate_count=0,
        raise_at=3,
        amplifiers=(),
    )
    assert (other_place.priority, other_place.rule_id) == ("MEDIUM", "PRI-M1")
    raised = decide(
        "VE_SINH",
        "Tòa SIM-A / Tầng 6 / Cầu thang bộ",
        "Nhiều bụi",
        duplicate_count=3,
        raise_at=3,
        amplifiers=("vulnerable_person",),
    )
    assert raised.priority == "HIGH" and "PRI-U1" in raised.reason and "PRI-U2" in raised.reason


def test_ac10c_duplicate_reports_raise_the_original(fresh, clock):
    dusty = "Cầu thang bộ tầng 6 tòa SIM-A nhiều bụi, cần vệ sinh"
    original = report(fresh, dusty)
    assert fresh.get(original).ticket.priority == "LOW"
    for _ in range(3):
        clock.advance(minutes=10)
        tid = report(fresh, dusty, resident=OTHER_RESIDENT)
        assert blocker(fresh, tid).code == "DUPLICATE"
    ticket = fresh.get(original).ticket
    assert ticket.duplicate_count == 3 and ticket.priority == "MEDIUM" and "PRI-U1" in ticket.priority_reason
    assert len(ticket.related_ticket_ids) == 3


def test_ac10d_a_person_sets_priority_with_a_reason_and_the_agent_keeps_it(fresh, clock):
    tid = report(fresh, "Cầu thang bộ tầng 6 tòa SIM-A nhiều bụi, cần vệ sinh")
    with pytest.raises(GuardError):
        fresh.set_priority(tid, BPTN, priority="HIGH", note=" ")
    with pytest.raises(ActionDeniedError):
        fresh.set_priority(tid, CLN, priority="HIGH", note="x")
    case = fresh.set_priority(tid, BPTN, priority="HIGH", note="Sắp có đoàn kiểm tra")
    assert (case.ticket.priority, case.ticket.priority_source) == ("HIGH", "HUMAN_OVERRIDE")
    assert case.audit[-1].action == "SET_PRIORITY" and case.audit[-1].actor_role == "BPTN"
    for _ in range(3):
        clock.advance(minutes=10)
        report(fresh, "Cầu thang bộ tầng 6 tòa SIM-A nhiều bụi, cần vệ sinh", resident=OTHER_RESIDENT)
    assert fresh.get(tid).ticket.priority == "HIGH"


def test_ac10e_lists_put_emergencies_first_then_priority(fresh, clock):
    low = report(fresh, "Cầu thang bộ tầng 6 tòa SIM-A nhiều bụi, cần vệ sinh")
    clock.advance(minutes=5)
    high = report(fresh, LIGHTING)
    clock.advance(minutes=5)
    hot = report(fresh, "Hộp điện sảnh chính tòa SIM-B bốc khói")
    order = [r.ticket_id for r in bql_rows(fresh, clock.now)]
    assert order == [hot, high, low]


# ---------------------------------------------------------------- AC-11: merge


def test_ac11_merge_links_both_ways_and_appends_additions(fresh, clock):
    first = report(fresh, LIGHTING)
    clock.advance(hours=1)
    second = report(fresh, "Đèn không sáng", resident=OTHER_RESIDENT)
    fresh.add_resident_info(second, OTHER_RESIDENT, "Đèn hành lang tầng 3 tòa SIM-A")
    assert blocker(fresh, second).code == "DUPLICATE"
    case = fresh.bptn_resolve(second, BPTN, merge=True, note="Cùng một đèn")
    assert case.ticket.merged_into == first
    original = fresh.get(first)
    assert original.ticket.merged_children == [second] and second in original.ticket.related_ticket_ids
    assert [a.content for a in original.additions] == [f"[Từ {second}] Đèn hành lang tầng 3 tòa SIM-A"]
    assert original.ticket.raw.original_description == LIGHTING


def test_ac11b_undo_merge_reruns_and_never_proposes_the_pair_again(fresh, clock):
    first = report(fresh, LIGHTING)
    clock.advance(hours=1)
    second = report(fresh, LIGHTING, resident=OTHER_RESIDENT)
    fresh.bptn_resolve(second, BPTN, merge=True)
    with pytest.raises(GuardError):
        fresh.undo_merge(second, BPTN, note=" ")
    case = fresh.undo_merge(second, BPTN, note="Hai đèn khác nhau")
    assert case.ticket.status == "ROUTED" and case.ticket.merged_into is None and first in case.not_duplicate_of
    assert fresh.get(first).ticket.merged_children == []


def test_ac11c_cancelling_the_original_sends_merged_tickets_back(fresh, clock):
    first = report(fresh, LIGHTING)
    clock.advance(hours=1)
    second = report(fresh, LIGHTING, resident=OTHER_RESIDENT)
    fresh.bptn_resolve(second, BPTN, merge=True)
    with pytest.raises(InvalidTransitionError):
        fresh.cancel(second, BQL, cancel_reason="Không hủy trực tiếp ticket đã gộp")
    fresh.cancel(first, BQL, cancel_reason="Cư dân rút phản ánh")
    child = fresh.get(second)
    assert child.ticket.status == "ROUTED" and child.ticket.merged_into is None
    assert any(e.actor_role == "SYSTEM" and e.from_status == "MERGED" for e in child.events)


def test_ac11d_emergencies_are_linked_and_only_bql_merges_them(fresh, clock):
    first = report(fresh, EMERGENCY_TEXT)
    clock.advance(minutes=10)
    second = report(fresh, f"Đèn {PLACE} có tia lửa", resident=OTHER_RESIDENT)
    assert blocker(fresh, second).code == "EMERGENCY_PENDING_BQL"  # linked, not stopped as DUPLICATE
    assert fresh.get(second).ticket.related_ticket_ids == [first]
    assert second in fresh.get(first).ticket.related_ticket_ids
    with pytest.raises(ActionDeniedError):
        fresh.transition(second, "MERGED", BPTN, into=first)
    case = fresh.bql_merge(second, BQL, into=first, note="Cùng sự cố")
    assert case.ticket.status == "MERGED" and fresh.get(first).ticket.merged_children == [second]


# ---------------------------------------------------------------- AC-12, AC-13: department


def test_ac12_material_short_after_accepting_resumes_work_when_stock_arrives(fresh):
    tid = report(fresh, CLEANING)
    fresh.accept(tid, CLN)
    fresh.stock["SIM-MAT-CLEAN-01"] = 0
    case = fresh.material_short(tid, CLN, note="Hết dung dịch trong kho tầng")
    assert case.ticket.status == "ON_HOLD" and case.ticket.blocker.code == "WAITING_MATERIAL"
    assert case.ticket.blocker.owner_role == "WAREHOUSE" and case.ticket.department_id == "DEPT_CLEANING"
    fresh.receive_stock(WAREHOUSE, "SIM-MAT-CLEAN-01", 5)
    case = fresh.get(tid)
    assert case.ticket.status == "IN_PROGRESS" and case.ticket.blocker is None
    assert case.events[-1].actor_role == "SYSTEM"


def test_ac13_second_wrong_department_return_escalates(fresh):
    tid = report(fresh, CLEANING)
    fresh.return_wrong_department(tid, CLN, note="Không phải việc vệ sinh")
    assert not blocker(fresh, tid).escalated
    fresh.bptn_resolve(tid, BPTN, department="DEPT_CLEANING", note="Đúng là vệ sinh")
    case = fresh.return_wrong_department(tid, CLN, note="Vẫn không phải")
    assert case.ticket.wrong_department_return_count == 2 and case.ticket.blocker.escalated
    assert case.notifications[-1].type == "escalation" and case.notifications[-1].audience == "BQL"


def test_ac13b_wrong_department_after_start_is_decided_by_bql(fresh):
    tid = report(fresh, CLEANING)
    fresh.accept(tid, CLN)
    do_work(fresh, tid, photo=False)
    with pytest.raises(InvalidTransitionError):
        fresh.return_wrong_department(tid, CLN, note="Không tự trả lại khi đã làm")
    case = fresh.report_wrong_department(tid, CLN, note="Rác là đồ thi công, cần kỹ thuật")
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.owner_role == "BQL"
    assert case.ticket.department_id == "DEPT_CLEANING"
    with pytest.raises(ActionDeniedError):
        fresh.bptn_resolve(tid, BPTN, department="DEPT_TECHNICAL", note="x")

    case = fresh.bql_wrong_department(tid, BQL, decision="KEEP", note="Vẫn là vệ sinh")
    assert case.ticket.status == "IN_PROGRESS" and case.ticket.blocker is None

    fresh.report_wrong_department(tid, CLN, note="Thật sự cần kỹ thuật")
    case = fresh.bql_wrong_department(tid, BQL, decision="TO_BPTN", note="Chuyển BPTN chọn lại")
    assert case.ticket.blocker.code == "WRONG_DEPT" and case.ticket.blocker.owner_role == "BPTN"
    assert case.ticket.department_id is None and case.ticket.accepted_at is None
    assert all(i.status == ChecklistStatus.COMPLETED for i in case.checklist_items)  # work kept

    case = fresh.bptn_resolve(tid, BPTN, department="DEPT_CLEANING", note="Cư dân xác nhận lại")
    assert case.ticket.status == "ROUTED"
    assert all(i.status == ChecklistStatus.COMPLETED for i in case.checklist_items)
    assert [(m.issued_qty, m.used_qty) for m in case.material_lines] == [(2, 2)]


# ---------------------------------------------------------------- AC-15, AC-16, AC-17


def test_ac15_rating_once_and_for_a_merged_ticket_after_the_original_closes(fresh, clock):
    first = report(fresh, LIGHTING)
    clock.advance(hours=1)
    second = report(fresh, LIGHTING, resident=OTHER_RESIDENT)
    fresh.bptn_resolve(second, BPTN, merge=True)
    with pytest.raises(GuardError):
        fresh.rate(second, OTHER_RESIDENT, 4)
    to_ready(fresh, first)
    fresh.close(first, BQL)
    assert fresh.rate(second, OTHER_RESIDENT, 4).ticket.rating == 4
    fresh.rate(first, RESIDENT, 5)
    with pytest.raises(GuardError):
        fresh.rate(first, RESIDENT, 1)
    case = fresh.get(first)
    assert case.ticket.rating == 5 and case.ticket.status == "CLOSED"


def test_ac16_new_rows_still_check_the_role(fresh):
    tid = report(fresh, EMERGENCY_TEXT)
    for actor in (CLN, RESIDENT, BPTN):
        with pytest.raises(ActionDeniedError):
            fresh.transition(tid, "CLOSED", actor, note="x")
    with pytest.raises(ActionDeniedError):
        fresh.create_follow_up(tid, BPTN, note="x")
    assert fresh.get(tid).ticket.status == "VERIFYING"


def test_ac17_resident_view_never_shows_risk_or_priority(fresh):
    case = fresh.get(report(fresh, EMERGENCY_TEXT))
    view = resident_view(fresh, case, fresh.clock()).model_dump()
    text = repr(view)
    for hidden in ("risk", "priority", "EMERGENCY", "S-02", "tia lửa và"):
        assert hidden not in text.replace(EMERGENCY_TEXT, ""), hidden


def test_legacy_v05_document_still_loads(fresh):
    """OPERATIONS §1: tickets stored by v0.5 (reopen_until, CLOSED without closure_kind) stay readable."""
    tid = report(fresh, CLEANING)
    to_ready(fresh, tid)
    doc = fresh.close(tid, BQL).ticket.model_dump(mode="json")
    for key in ("closure_kind", "risk_level", "risk_signals", "priority", "merged_children"):
        doc.pop(key)
    doc["reopen_until"] = "2026-10-09T09:00:00+07:00"
    ticket = Ticket.model_validate(doc)
    assert ticket.closure_kind == "NORMAL" and ticket.status == "CLOSED" and ticket.merged_children == []


def test_fixture_emergencies_wait_for_bql(engine):
    for tid in ("SIM-TKT-CLN-004", "SIM-TKT-TEC-005"):
        ticket = engine.get(tid).ticket
        assert ticket.blocker.code == "EMERGENCY_PENDING_BQL" and ticket.department_id is None


def test_finish_still_works_after_a_bql_keep(fresh):
    tid = report(fresh, CLEANING)
    fresh.accept(tid, CLN)
    fresh.report_wrong_department(tid, CLN, note="Hỏi lại")
    fresh.bql_wrong_department(tid, BQL, decision="KEEP", note="Giữ")
    assert finish(fresh, tid).ticket.status == "READY_FOR_REVIEW"
    assert TEC  # both department actors stay defined for other tests
