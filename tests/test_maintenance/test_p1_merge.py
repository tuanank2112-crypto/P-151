"""Plan 06 SPEC-P04 (WP7): duplicate count, PRI-U1, two-way merge, T09 undo, root cancel, BQL merge, rating of MERGED.

IDs M-01..M-12 follow TESTING-ACCEPTANCE §3.6; M-03 and M-08 also run on PostgreSQL (`--pg`, local docker only).
"""

import pytest

from src.maintenance.catalog import PrioritySla, load_catalog
from src.maintenance.engine import (
    ActionDeniedError,
    GuardError,
    InvalidTransitionError,
    MaintenanceEngine,
    initial_stock,
)
from src.maintenance.enums import Action, ActionResult
from src.maintenance.models import ResidentAddition
from src.maintenance.store.base import NotFoundError
from src.maintenance.store.memory import InMemoryRepository
from src.maintenance.views import resident_view
from tests.test_maintenance.helpers import BPTN, BQL, CLEANING, LIGHTING, RESIDENT, report, to_ready

STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]
EMERGENCY = "Có mùi khét ở hành lang tầng 3 tòa S1."
SYSTEM_NOTE = "Ticket gốc bị hủy"


@pytest.fixture(params=STORES)
def repo(request):
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    return InMemoryRepository(initial_stock(load_catalog()))


@pytest.fixture
def eng(repo, clock) -> MaintenanceEngine:
    e = MaintenanceEngine(clock=clock, repo=repo)
    e.reset(with_fixtures=False)
    return e


def later(clock, eng, text, minutes=5):
    clock.advance(minutes=minutes)
    return report(eng, text)


def count_rows(case):
    return [e for e in case.audit if e.action == Action.LINK_TICKETS and e.field_name == "duplicate_count"]


def state(eng, tid):
    t = eng.get(tid).ticket
    return t.status, t.blocker.code if t.blocker else None


def dup_pair(clock, eng, text=CLEANING):
    root = report(eng, text)
    child = later(clock, eng, text)
    assert state(eng, child) == ("VERIFYING", "DUPLICATE")
    return root, child


# ---------------------------------------------------------------------- M-01, M-02


def test_m01_detection_counts_on_root(clock, eng):
    """M-01: step 4 finds the root: duplicate_count 0 -> 1 with one LINK_TICKETS row on the root."""
    root = report(eng, CLEANING)
    assert eng.get(root).ticket.duplicate_count == 0
    child = later(clock, eng, CLEANING)
    case = eng.get(root)
    assert case.ticket.duplicate_count == 1
    rows = count_rows(case)
    assert len(rows) == 1 and (rows[0].old_value, rows[0].new_value) == (0, 1) and child in rows[0].reason
    assert eng.get(child).ticket.duplicate_count == 0


def test_m01b_every_extra_report_adds_one(clock, eng):
    root, _ = dup_pair(clock, eng)
    later(clock, eng, CLEANING)
    assert eng.get(root).ticket.duplicate_count == 2
    assert [r.new_value for r in count_rows(eng.get(root))] == [1, 2]


def test_m02_bptn_rejects_then_merge_does_not_count_again(clock, eng):
    """M-02: BPTN says "not a duplicate" 1 -> 0; confirming a duplicate (T08) adds nothing on top of detection."""
    root, child = dup_pair(clock, eng)
    case = eng.bptn_resolve(child, BPTN, merge=False)
    assert case.not_duplicate_of == [root] and case.ticket.status == "ROUTED"
    assert eng.get(root).ticket.duplicate_count == 0
    other = later(clock, eng, CLEANING)
    assert eng.get(root).ticket.duplicate_count == 1
    eng.bptn_resolve(other, BPTN, merge=True)
    assert eng.get(root).ticket.duplicate_count == 1


# ---------------------------------------------------------------------- M-03


def test_m03_t08_links_both_ways_and_hides_merged_text(clock, eng):
    """M-03 (pg): T08 appends the child's additions and photos to the root as `merged_from`, the root is not rerun,
    its Agent text (`_content`) and the resident view never read them; the child's own records stay."""
    root, child = dup_pair(clock, eng)
    eng.add_resident_photo(child, RESIDENT, "child.jpg")
    with eng.repo.transaction() as tx:
        case = tx.get_for_update(child)
        case.additions.append(
            ResidentAddition(
                addition_id=f"SIM-ADD-{child.removeprefix('SIM-TKT-')}-01",
                ticket_id=child,
                content="Bổ sung: có nước rỉ ra sàn",
                submitted_by=RESIDENT,
                submitted_at=clock(),
            )
        )
        tx.save(case)
    before = eng.get(root)
    merged = eng.bptn_resolve(child, BPTN, merge=True, note="Cùng sự cố")
    assert (merged.ticket.status, merged.ticket.merged_into) == ("MERGED", root)
    after = eng.get(root)
    assert after.ticket.merged_children == [child] and after.ticket.status == before.ticket.status
    assert len(after.events) == len(before.events)  # the root is not rerun (no status event)
    assert [(a.content, a.merged_from) for a in after.additions] == [("Bổ sung: có nước rỉ ra sàn", child)]
    assert [e.merged_from for e in after.evidence if e.merged_from] == [child]
    assert "nước rỉ" not in eng._content(after)
    assert resident_view(eng, after, clock()).additions == [] and resident_view(eng, after, clock()).photos == []
    assert len(merged.additions) == 1 and merged.additions[0].merged_from is None  # the child's own record is intact
    assert any(e.action == Action.LINK_TICKETS and e.field_name == "merged_children" for e in after.audit)


# ---------------------------------------------------------------------- M-04, M-05


def test_m04_merge_into_finished_root_is_refused(clock, eng):
    """M-04: a root that finished (cancelled here) cannot take a merge: 409 GUARD and nothing changes."""
    root, child = dup_pair(clock, eng)
    eng.cancel(root, BQL, cancel_reason="Đã xử lý ngoài hệ thống")
    assert state(eng, child) == ("VERIFYING", "DUPLICATE")  # kept for BPTN (P04 §6)
    snap = (eng.get(root).model_dump(), eng.get(child).model_dump())
    with pytest.raises(GuardError):
        eng.bptn_resolve(child, BPTN, merge=True)
    assert (eng.get(root).model_dump(), eng.get(child).model_dump()) == snap
    assert eng.bptn_resolve(child, BPTN, merge=False).ticket.status == "ROUTED"


def test_m05_chained_merge_is_refused(clock, eng):
    """M-05: a ticket that still has open merged children cannot itself be merged elsewhere."""
    e1 = report(eng, EMERGENCY)
    e2 = later(clock, eng, EMERGENCY)
    e3 = later(clock, eng, EMERGENCY)
    eng.bql_merge(e3, BQL, into=e2, note="Cùng một sự cố")
    assert eng.get(e2).ticket.merged_children == [e3]
    snap = (eng.get(e1).model_dump(), eng.get(e2).model_dump())
    with pytest.raises(GuardError):
        eng.bql_merge(e2, BQL, into=e1, note="Gộp dây chuyền")
    assert (eng.get(e1).model_dump(), eng.get(e2).model_dump()) == snap


# ---------------------------------------------------------------------- M-06, M-07


def test_m06_undo_merge_reruns_from_step_4(clock, eng):
    """M-06: T09 by BPTN: RECEIVED then the pipeline again from 4; the pair is not offered again; history kept."""
    root, child = dup_pair(clock, eng)
    eng.bptn_resolve(child, BPTN, merge=True)
    case = eng.undo_merge(child, BPTN, note="Không cùng sự cố")
    ticket = case.ticket
    assert (ticket.status, ticket.merged_into, ticket.blocker) == ("ROUTED", None, None)
    assert case.not_duplicate_of == [root]
    assert any(e.action == Action.MERGE_UNDO and e.old_value == root and e.new_value is None for e in case.audit)
    assert any(e.from_status == "MERGED" and e.to_status == "RECEIVED" for e in case.events)
    after = eng.get(root)
    assert after.ticket.merged_children == [child] and after.ticket.duplicate_count == 0
    with pytest.raises(InvalidTransitionError):
        eng.undo_merge(child, BPTN, note="x")  # not MERGED any more
    assert eng.get(child).ticket.status == "ROUTED"


def test_m06b_undo_needs_a_note_and_a_merged_ticket(clock, eng):
    root, child = dup_pair(clock, eng)
    with pytest.raises(InvalidTransitionError):
        eng.undo_merge(child, BPTN, note="x")  # VERIFYING, not MERGED
    eng.bptn_resolve(child, BPTN, merge=True)
    with pytest.raises(GuardError):
        eng.undo_merge(child, BPTN, note="  ")
    with pytest.raises(ActionDeniedError):
        eng.undo_merge(child, RESIDENT, note="x")
    assert eng.get(child).ticket.status == "MERGED" and eng.get(root).ticket.merged_children == [child]


def test_m07_bql_merge_of_emergencies_and_undo_by_role(clock, eng):
    """M-07: bql_merge of two emergencies; BPTN cannot undo (403 + audit); BQL undo reruns from 2 and the ticket
    stops again at EMERGENCY_PENDING_BQL, never ROUTED."""
    e1 = report(eng, EMERGENCY)
    e2 = later(clock, eng, EMERGENCY)
    assert state(eng, e1) == state(eng, e2) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    merged = eng.bql_merge(e2, BQL, into=e1, note="Cùng một sự cố")
    assert (merged.ticket.status, merged.ticket.merged_into) == ("MERGED", e1)
    assert any(e.action == Action.BQL_MERGE and e.new_value == e1 for e in merged.audit)
    root = eng.get(e1)
    assert root.ticket.merged_children == [e2] and root.ticket.duplicate_count == 1
    with pytest.raises(ActionDeniedError):
        eng.undo_merge(e2, BPTN, note="Thử hoàn tác")
    last = eng.get(e2).audit[-1]
    assert (last.action, last.action_result) == (Action.ACTION_DENIED, ActionResult.ACTION_DENIED)
    assert "requested=MERGE_UNDO" in last.reason and last.actor_id == BPTN
    assert eng.get(e2).ticket.status == "MERGED"
    case = eng.undo_merge(e2, BQL, note="Hai sự cố khác nhau")
    assert state(eng, e2) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert case.ticket.merged_into is None and case.ticket.status != "ROUTED"
    after = eng.get(e1)
    assert after.ticket.duplicate_count == 0 and after.ticket.merged_children == [e2]


# ---------------------------------------------------------------------- M-08


def test_m08_root_cancel_unmerges_children_in_one_transaction(clock, eng):
    """M-08 (pg): cancelling the root sends every MERGED child back (T09 SYSTEM); two children of one incident do not
    both get routed: the later becomes a duplicate of the earlier."""
    root, b = dup_pair(clock, eng)
    c = later(clock, eng, CLEANING)
    eng.bptn_resolve(b, BPTN, merge=True)
    eng.bptn_resolve(c, BPTN, merge=True)
    assert eng.get(root).ticket.merged_children == [b, c]
    eng.cancel(root, BQL, cancel_reason="Gốc nhập nhầm")
    first, second = eng.get(b), eng.get(c)
    assert eng.get(root).ticket.status == "CANCELLED"
    assert state(eng, b) == ("ROUTED", None)
    assert state(eng, c) == ("VERIFYING", "DUPLICATE") and second.ticket.blocker.related_ticket_id == b
    for case in (first, second):
        event = next(e for e in case.events if e.from_status == "MERGED" and e.to_status == "RECEIVED")
        assert (event.actor_role, event.internal_note) == ("SYSTEM", SYSTEM_NOTE)
        assert root in case.not_duplicate_of and case.ticket.merged_into is None
    assert eng.get(b).ticket.duplicate_count == 1  # the later report now counts on the earlier child
    assert eng.get(root).ticket.merged_children == [b, c]  # history is never removed


# ---------------------------------------------------------------------- M-09


def test_m09_pri_u1_raises_one_level_at_the_threshold(clock, eng):
    """M-09: 3 duplicates raise MEDIUM to HIGH ("PRI-U1" in the reason, rule kept); one rejected goes back."""
    root = report(eng, CLEANING)
    assert (eng.get(root).ticket.priority, eng.get(root).ticket.priority_rule_id) == ("MEDIUM", "PRI-M2")
    kids = [later(clock, eng, CLEANING) for _ in range(3)]
    ticket = eng.get(root).ticket
    assert (ticket.priority, ticket.priority_rule_id, ticket.priority_source) == ("HIGH", "PRI-M2", "AGENT_RULE")
    assert "PRI-U1" in ticket.priority_reason and "3 phản ánh trùng" in ticket.priority_reason
    rows = [e for e in eng.get(root).audit if e.action == Action.CREATE_PROPOSAL and e.field_name == "priority"]
    assert [r.new_value for r in rows] == ["MEDIUM", "HIGH"]
    eng.bptn_resolve(kids[0], BPTN, merge=False)
    ticket = eng.get(root).ticket
    assert (ticket.duplicate_count, ticket.priority, ticket.priority_rule_id) == (2, "MEDIUM", "PRI-M2")
    assert "PRI-U1" not in ticket.priority_reason


def test_m09b_human_override_is_never_touched(clock, eng):
    root = report(eng, CLEANING)
    eng.set_priority(root, BPTN, "LOW", note="Đã có người dọn")
    for _ in range(3):
        later(clock, eng, CLEANING)
    ticket = eng.get(root).ticket
    assert (ticket.duplicate_count, ticket.priority, ticket.priority_source) == (3, "LOW", "HUMAN_OVERRIDE")


def test_m09c_threshold_is_data_not_a_constant(clock, eng):
    """The threshold is `sla_config.priority.duplicate_raise_at_count`; 2 raises at two duplicates."""
    sla = eng.catalog.sla_config
    eng.catalog = eng.catalog.model_copy(
        update={"sla_config": sla.model_copy(update={"priority": PrioritySla(duplicate_raise_at_count=2)})}
    )
    root = report(eng, CLEANING)
    later(clock, eng, CLEANING)
    assert eng.get(root).ticket.priority == "MEDIUM"
    later(clock, eng, CLEANING)
    assert eng.get(root).ticket.priority == "HIGH"


def test_m09d_high_root_is_not_raised_and_a_rerun_writes_nothing(clock, eng):
    root = report(eng, LIGHTING)  # PRI-H1 already
    for _ in range(3):
        later(clock, eng, LIGHTING)
    ticket = eng.get(root).ticket
    assert (ticket.priority, "PRI-U1" in ticket.priority_reason) == ("HIGH", False)
    rows = [e for e in eng.get(root).audit if e.action == Action.CREATE_PROPOSAL and e.field_name == "priority"]
    assert len(rows) == 1


# ---------------------------------------------------------------------- M-10


def test_m10_rating_of_a_merged_ticket_waits_for_the_root(clock, eng):
    """M-10: MERGED rates only once the root is CLOSED, once; the resident view shows RATE accordingly."""
    root, child = dup_pair(clock, eng)
    eng.bptn_resolve(child, BPTN, merge=True)
    assert "RATE" not in resident_view(eng, eng.get(child), clock()).allowed_actions
    with pytest.raises(GuardError):
        eng.rate(child, RESIDENT, 4)
    to_ready(eng, root)
    with pytest.raises(GuardError):
        eng.rate(child, RESIDENT, 4)  # READY_FOR_REVIEW is not CLOSED
    eng.close(root, BQL)
    assert "RATE" in resident_view(eng, eng.get(child), clock()).allowed_actions
    assert eng.rate(child, RESIDENT, 4).ticket.rating == 4
    assert eng.get(root).ticket.rating is None  # the score stays on the child
    assert "RATE" not in resident_view(eng, eng.get(child), clock()).allowed_actions
    with pytest.raises(GuardError):
        eng.rate(child, RESIDENT, 5)


def test_m10b_root_closed_as_emergency_handled_can_be_rated_through(clock, eng):
    e1 = report(eng, EMERGENCY)
    e2 = later(clock, eng, EMERGENCY)
    eng.bql_merge(e2, BQL, into=e1, note="Cùng một sự cố")
    eng.emergency_close(e1, BQL, note="Đã xử lý tại chỗ")
    assert eng.get(e1).ticket.status == "CLOSED"
    assert eng.rate(e2, RESIDENT, 5).ticket.rating == 5


# ---------------------------------------------------------------------- M-11


def test_m11_bql_merge_target_checks(clock, eng):
    """M-11: `into` not an open emergency -> 409; missing -> 404; itself -> 409."""
    normal = report(eng, LIGHTING)
    clock.advance(minutes=5)
    e1 = report(eng, EMERGENCY)
    for into in (normal, e1):
        with pytest.raises(GuardError):
            eng.bql_merge(e1, BQL, into=into, note="x")
    with pytest.raises(NotFoundError):
        eng.bql_merge(e1, BQL, into="SIM-TKT-9999", note="x")
    assert state(eng, e1) == ("VERIFYING", "EMERGENCY_PENDING_BQL") and eng.get(e1).ticket.merged_into is None


def test_m11b_bql_merge_roles_state_and_note(clock, eng):
    e1 = report(eng, EMERGENCY)
    e2 = later(clock, eng, EMERGENCY)
    with pytest.raises(ActionDeniedError):
        eng.bql_merge(e2, BPTN, into=e1, note="x")
    assert eng.get(e2).audit[-1].action_result == ActionResult.ACTION_DENIED
    with pytest.raises(GuardError):
        eng.bql_merge(e2, BQL, into=e1, note="  ")
    n = later(clock, eng, LIGHTING)
    with pytest.raises(InvalidTransitionError):
        eng.bql_merge(n, BQL, into=e1, note="x")  # ROUTED, not an emergency waiting for BQL
    eng.bql_merge(e2, BQL, into=e1, note="ok")
    e3 = later(clock, eng, EMERGENCY)
    eng.cancel(e1, BQL, cancel_reason="Nhập nhầm")
    assert state(eng, e2) == ("VERIFYING", "EMERGENCY_PENDING_BQL")  # root cancelled: back to BQL, never ROUTED
    with pytest.raises(GuardError):
        eng.bql_merge(e3, BQL, into=e1, note="x")  # the root is finished


# ---------------------------------------------------------------------- M-12


def test_m12_cancelling_a_suspected_duplicate_releases_the_count(clock, eng):
    """M-12: BQL cancels the suspected duplicate: the root count drops by one, and never below zero."""
    root, child = dup_pair(clock, eng)
    assert eng.get(root).ticket.duplicate_count == 1
    eng.cancel(child, BQL, cancel_reason="Cư dân gửi nhầm")
    case = eng.get(root)
    assert case.ticket.duplicate_count == 0
    assert [(r.old_value, r.new_value) for r in count_rows(case)] == [(0, 1), (1, 0)]


def test_m12b_cancelling_after_the_root_finished_writes_nothing(clock, eng):
    root, child = dup_pair(clock, eng)
    eng.cancel(root, BQL, cancel_reason="Đã xử lý")
    before = eng.get(root).model_dump()
    eng.cancel(child, BQL, cancel_reason="Hết cần")
    assert eng.get(root).model_dump() == before
    assert eng.get(root).ticket.status == "CANCELLED"
