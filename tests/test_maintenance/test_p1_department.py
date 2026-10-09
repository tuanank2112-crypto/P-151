"""Plan 06 WP9 (SPEC-P06, TESTING §3.8): wrong department. T15 count and E03, T16, T17, E02, carry-over.

D-04 runs on both stores (`postgres` only with --pg); the other cases use the in-memory store.
"""

import pytest

from src.maintenance.catalog import WrongDeptReturnSla, load_catalog
from src.maintenance.engine import MaintenanceEngine, initial_stock
from src.maintenance.errors import ActionDeniedError, GuardError, InvalidTransitionError
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import BPTN, BQL, CLN, TEC, do_work, report, to_ready

SWEEP = "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh."
STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]


@pytest.fixture(params=STORES)
def store_engine(request, clock) -> MaintenanceEngine:
    if request.param == "postgres":
        repo = request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    else:
        repo = InMemoryRepository(initial_stock(load_catalog()))
    e = MaintenanceEngine(clock=clock, repo=repo)
    e.reset(with_fixtures=False)
    return e


def started(engine, text: str = SWEEP, *, work: bool = True) -> str:
    """A ticket the cleaning department accepted, with part of its work recorded."""
    tid = report(engine, text)
    engine.accept(tid, CLN)
    if work:
        do_work(engine, tid)
    return tid


def reported(engine, text: str = SWEEP) -> str:
    """`started` and then reported as the wrong department (T16): VERIFYING / WRONG_DEPT_AFTER_START."""
    tid = started(engine, text)
    engine.report_wrong_department(tid, CLN, note="Khu này thuộc phòng kỹ thuật")
    return tid


def escalations(case):
    return [n for n in case.notifications if n.type == "escalation"]


def test_d01_first_return_counts_without_escalating(fresh):
    tid = report(fresh, SWEEP)
    case = fresh.return_wrong_department(tid, CLN, note="Không phải việc của phòng vệ sinh")
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "WRONG_DEPT"
    assert case.ticket.blocker.owner_role == "BPTN" and case.ticket.blocker.resume_step == 6
    assert case.ticket.wrong_department_return_count == 1
    assert case.ticket.blocker.escalated is False
    assert escalations(case) == []


def test_d02_second_return_escalates_to_bql(fresh):
    tid = report(fresh, SWEEP)
    fresh.return_wrong_department(tid, CLN, note="Lần một")
    fresh.bptn_resolve(tid, BPTN, department="DEPT_TECHNICAL", note="Giao phòng kỹ thuật")
    case = fresh.return_wrong_department(tid, TEC, note="Lần hai")
    assert case.ticket.status == "VERIFYING" and case.ticket.wrong_department_return_count == 2
    assert case.ticket.blocker.escalated is True
    sent = escalations(case)
    assert len(sent) == 1 and sent[0].audience == "BQL"
    assert sent[0].payload["reason_code"] == "WRONG_DEPT" and sent[0].payload["wrong_department_return_count"] == 2


def test_d02b_threshold_comes_from_sla_config(fresh):
    sla = fresh.catalog.sla_config.model_copy(update={"wrong_dept_return": WrongDeptReturnSla(escalate_at_count=1)})
    fresh.catalog = fresh.catalog.model_copy(update={"sla_config": sla})  # never hardcoded 2
    tid = report(fresh, SWEEP)
    case = fresh.return_wrong_department(tid, CLN, note="Lần một")
    assert case.ticket.blocker.escalated is True and len(escalations(case)) == 1


def test_d03_return_on_in_progress_is_409(fresh):
    tid = started(fresh, work=False)
    with pytest.raises(InvalidTransitionError):
        fresh.return_wrong_department(tid, CLN, note="Sai phòng")
    assert fresh.get(tid).ticket.status == "IN_PROGRESS"


def test_d04_report_after_start_keeps_the_execution_data(store_engine):
    engine = store_engine
    tid = started(engine)
    before = engine.get(tid)
    case = engine.report_wrong_department(tid, CLN, note="Khu này thuộc phòng kỹ thuật")
    ticket = case.ticket
    assert ticket.status == "VERIFYING" and ticket.blocker.code == "WRONG_DEPT_AFTER_START"
    assert ticket.blocker.owner_role == "BQL"
    assert ticket.department_id == before.ticket.department_id == "DEPT_CLEANING"
    assert ticket.accepted_at == before.ticket.accepted_at and ticket.accepted_at is not None
    assert case.checklist_items == before.checklist_items
    assert case.material_lines == before.material_lines and case.material_lines
    assert case.evidence == before.evidence and case.evidence
    assert all(i.status == "COMPLETED" for i in case.checklist_items)
    sent = escalations(case)
    assert len(sent) == 1 and sent[0].audience == "BQL"
    assert sent[0].payload["reason_code"] == "WRONG_DEPT_AFTER_START"
    assert any(a.action == "REPORT_WRONG_DEPT" and a.new_value == "WRONG_DEPT_AFTER_START" for a in case.audit)


def test_d04b_report_guards(fresh):
    tid = report(fresh, SWEEP)
    with pytest.raises(InvalidTransitionError):  # ROUTED, not accepted: T15 is the way
        fresh.report_wrong_department(tid, CLN, note="x")
    fresh.accept(tid, CLN)
    with pytest.raises(GuardError):
        fresh.report_wrong_department(tid, CLN, note=" ")
    with pytest.raises(ActionDeniedError):
        fresh.report_wrong_department(tid, TEC, note="Phòng khác không được báo")
    assert fresh.get(tid).ticket.status == "IN_PROGRESS"


def test_d05_bptn_cannot_touch_a_ticket_bql_owns(fresh):
    tid = reported(fresh)
    attempts = [
        lambda: fresh.bptn_resolve(tid, BPTN, category="KY_THUAT", note="Đổi loại"),
        lambda: fresh.bql_wrong_department(tid, BPTN, decision="KEEP", note="x"),
        lambda: fresh.bql_wrong_department(tid, BPTN, decision="TO_BPTN", note="x"),
        lambda: fresh.cancel(tid, BPTN, cancel_reason="x"),
    ]
    for attempt in attempts:
        with pytest.raises(ActionDeniedError):
            attempt()
    case = fresh.get(tid)
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "WRONG_DEPT_AFTER_START"
    assert sum(1 for a in case.audit if a.action_result == "ACTION_DENIED") >= len(attempts)


def test_d06_keep_returns_to_in_progress_with_data_intact(fresh):
    tid = reported(fresh)
    before = fresh.get(tid)
    with pytest.raises(GuardError):
        fresh.bql_wrong_department(tid, BQL, decision="KEEP", note="")
    case = fresh.bql_wrong_department(tid, BQL, decision="KEEP", note="Đúng phòng vệ sinh, làm tiếp")
    assert case.ticket.status == "IN_PROGRESS" and case.ticket.blocker is None
    assert case.ticket.department_id == "DEPT_CLEANING" and case.ticket.accepted_at == before.ticket.accepted_at
    assert case.checklist_items == before.checklist_items and case.material_lines == before.material_lines
    assert any(a.action == "BQL_KEEP_DEPARTMENT" and a.old_value == "WRONG_DEPT_AFTER_START" for a in case.audit)


def test_d06b_keep_only_after_a_report(fresh):
    tid = started(fresh, work=False)
    with pytest.raises(InvalidTransitionError):  # IN_PROGRESS: not a VERIFYING ticket
        fresh.bql_wrong_department(tid, BQL, decision="KEEP", note="x")
    tid2 = report(fresh, "Đèn hành lang tầng 3 tòa S1 không sáng.")
    fresh.return_wrong_department(tid2, TEC, note="sai")
    with pytest.raises(InvalidTransitionError):  # VERIFYING but WRONG_DEPT (BPTN's), not WRONG_DEPT_AFTER_START
        fresh.bql_wrong_department(tid2, BQL, decision="KEEP", note="x")


def test_d07_to_bptn_takes_a_snapshot_and_resets_the_execution(fresh):
    tid = reported(fresh)
    before = fresh.get(tid)
    case = fresh.bql_wrong_department(tid, BQL, decision="TO_BPTN", note="Là việc kỹ thuật, BPTN giao lại")
    ticket = case.ticket
    assert ticket.status == "VERIFYING" and ticket.blocker.code == "WRONG_DEPT" and ticket.blocker.owner_role == "BPTN"
    assert ticket.blocker.resume_step == 6
    assert ticket.department_id is None and ticket.accepted_at is None and ticket.dispatched_at is None
    assert all(i.status == "PENDING" and i.updated_by is None and i.note is None for i in case.checklist_items)
    assert case.evidence_round_start == len(case.evidence) == len(before.evidence)
    assert len(case.execution_snapshots) == 1
    snapshot = case.execution_snapshots[0]
    assert snapshot.snapshot_id == f"SIM-SNP-{tid.removeprefix('SIM-TKT-')}-01"
    assert snapshot.reason == "BQL_REASSIGN_TO_BPTN" and snapshot.taken_by == BQL
    assert snapshot.department_id == "DEPT_CLEANING" and snapshot.playbook_id == before.draft.playbook_id
    assert snapshot.checklist_items == before.checklist_items
    assert all(i.status == "COMPLETED" for i in snapshot.checklist_items)
    assert snapshot.material_lines == before.material_lines
    assert snapshot.evidence_ids == [e.evidence_id for e in before.evidence]
    assert [m.issued_qty for m in case.material_lines] == [m.issued_qty for m in before.material_lines]  # not wiped
    assert any(a.action == "BQL_REASSIGN_TO_BPTN" and a.new_value == "WRONG_DEPT" for a in case.audit)
    assert len(case.events) == len(before.events) + 1 and case.events[-1].public is True


def test_d07b_to_bptn_guards(fresh):
    tid = reported(fresh)
    with pytest.raises(GuardError):
        fresh.bql_wrong_department(tid, BQL, decision="TO_BPTN", note=" ")
    assert fresh.get(tid).execution_snapshots == []
    other = report(fresh, "Hành lang tầng 5 tòa S1 nhiều rác, cần vệ sinh.")
    fresh.accept(other, CLN)
    with pytest.raises(InvalidTransitionError):
        fresh.bql_wrong_department(other, BQL, decision="TO_BPTN", note="x")


def test_d08_after_to_bptn_bptn_picks_another_category_and_a_new_department(fresh):
    tid = reported(fresh)
    fresh.bql_wrong_department(tid, BQL, decision="TO_BPTN", note="Là việc kỹ thuật")
    case = fresh.bptn_resolve(tid, BPTN, category="KY_THUAT", note="Gọi lại cư dân: đèn hỏng")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_TECHNICAL"
    assert case.ticket.accepted_at is None and case.ticket.blocker is None
    assert case.draft.department_id == "DEPT_TECHNICAL"
    assert all(i.status == "PENDING" for i in case.checklist_items)
    assert len(case.execution_snapshots) == 1  # the old work stays in the snapshot only
    assert fresh.accept(tid, TEC).ticket.status == "IN_PROGRESS"


def test_d08b_same_item_code_carries_issued_and_used(fresh):
    tid = reported(fresh)
    before = fresh.get(tid)
    fresh.bql_wrong_department(tid, BQL, decision="TO_BPTN", note="Giao lại phòng khác")
    case = fresh.bptn_resolve(tid, BPTN, department="DEPT_TECHNICAL", note="Cùng loại việc, đổi phòng ban")
    assert case.ticket.status == "ROUTED" and case.ticket.department_id == "DEPT_TECHNICAL"
    old = {m.item_code: m for m in before.material_lines}
    assert case.material_lines
    for line in case.material_lines:
        assert line.issued_qty == old[line.item_code].issued_qty is not None
        assert line.used_qty == old[line.item_code].used_qty


def test_d08c_carry_over_skips_unknown_codes_and_untouched_lines(fresh):
    tid = reported(fresh)
    old = [m.model_copy(deep=True) for m in fresh.get(tid).material_lines]
    new = [m.model_copy(update={"issued_qty": None, "used_qty": None, "variance_reason": None}) for m in old]
    extra = new[0].model_copy(update={"item_code": "SIM-MAT-NOT-IN-OLD"})
    untouched = old[0].model_copy(update={"issued_qty": None, "used_qty": None, "variance_reason": "cũ"})
    fresh._carry_over_material_qty([untouched], [extra, new[0]])
    assert extra.issued_qty is None and new[0].issued_qty is None and new[0].variance_reason is None
    fresh._carry_over_material_qty(old, new)
    assert [(m.issued_qty, m.used_qty) for m in new] == [(m.issued_qty, m.used_qty) for m in old]


def test_d09_unknown_decision_is_409_before_404(fresh):
    with pytest.raises(GuardError):
        fresh.bql_wrong_department("SIM-TKT-9999", BQL, decision="X", note="x")
    tid = reported(fresh)
    with pytest.raises(GuardError):
        fresh.bql_wrong_department(tid, BPTN, decision="X", note="x")  # even a non-BQL gets 409 first
    assert fresh.get(tid).ticket.blocker.code == "WRONG_DEPT_AFTER_START"


def test_d10_report_on_a_rework_ticket_replaces_the_blocker(fresh):
    tid = report(fresh, SWEEP)
    to_ready(fresh, tid)
    case = fresh.rework(tid, BQL, note="Còn bẩn")
    assert case.ticket.blocker.code == "REWORK" and case.ticket.rework_count == 1
    round_start = case.evidence_round_start
    case = fresh.report_wrong_department(tid, CLN, note="Thực ra thuộc phòng kỹ thuật")
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "WRONG_DEPT_AFTER_START"
    assert case.ticket.rework_count == 1 and case.evidence_round_start == round_start
    assert case.ticket.department_id == "DEPT_CLEANING"
