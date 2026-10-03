"""Priority (SPEC-P03, CR-BPTN-03 §7): rules PRI-H1/H2/M1/M2/L1/D0, manual override, queue order, locked-category path."""

import ast
from pathlib import Path

import pytest
import yaml

import src.maintenance.engine as engine_module
from src.maintenance.catalog import load_lexicon
from src.maintenance.engine import ActionDeniedError, GuardError
from src.maintenance.enums import Action, Priority, ServiceCategory
from src.maintenance.priority import propose_priority
from src.maintenance.views import bql_rows
from tests.test_maintenance.helpers import BPTN, BQL, CLEANING, CLN, LIGHTING, RESIDENT, report, to_ready

DATA = yaml.safe_load((Path(__file__).parent / "data" / "safety_cases_p0.yaml").read_text(encoding="utf-8"))
CASES = DATA["priority_cases"]
LEX = load_lexicon().priority
EMERGENCY_TEXT = "Có mùi khét ở hành lang tầng 3 tòa SIM-A."
EXPECTED_FIXTURES = {
    "SIM-TKT-CLN-001": ("MEDIUM", "PRI-M2"),
    "SIM-TKT-CLN-002": ("MEDIUM", "PRI-M2"),
    "SIM-TKT-CLN-003": (None, None),
    "SIM-TKT-CLN-004": (None, None),
    "SIM-TKT-CLN-005": ("LOW", "PRI-L1"),
    "SIM-TKT-CLN-006": ("MEDIUM", "PRI-M2"),
    "SIM-TKT-TEC-001": ("HIGH", "PRI-H1"),
    "SIM-TKT-TEC-002": ("HIGH", "PRI-H1"),
    "SIM-TKT-TEC-003": ("HIGH", "PRI-H1"),
    "SIM-TKT-TEC-004": ("HIGH", "PRI-H1"),
    "SIM-TKT-TEC-005": (None, None),
    "SIM-TKT-TEC-006": ("HIGH", "PRI-H1"),
}


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_each_rule_has_a_sample(case):
    """AC-10, R-01: every labelled priority sample gets its priority and rule (H1, M1, H2, M2, L1, D0)."""
    proposal = propose_priority(ServiceCategory(case["category"]), case["location"], case["text"], LEX)
    assert (proposal.priority, proposal.rule_id) == (case["expect"], case["rule"])
    assert proposal.reason.startswith(case["rule"])


def test_d0_when_location_or_category_is_missing():
    """P03 §1.1 step 0 (PRI-D0): no location or no category defaults to MEDIUM."""
    assert propose_priority(None, "Tòa SIM-A / Tầng 3 / Hành lang", "x", LEX).rule_id == "PRI-D0"
    assert propose_priority(ServiceCategory.VE_SINH, None, "nhiều rác", LEX).rule_id == "PRI-D0"
    assert propose_priority(ServiceCategory.UNKNOWN, "Tòa SIM-A / Tầng 3 / Hành lang", "x", LEX).priority == "MEDIUM"


def test_fixture_priorities(engine):
    """AC-10, R-02: the fixture priorities; tier-1 and NEED_INFO tickets have none."""
    got = {t: (c.ticket.priority, c.ticket.priority_rule_id) for t, c in engine.cases.items()}
    assert got == EXPECTED_FIXTURES
    assert all(c.ticket.priority_source in (None, "AGENT_RULE") for c in engine.cases.values())


def test_h2_end_to_end(fresh):
    """AC-10, R-06: an obstructing spill is HIGH by PRI-H2 and is still routed."""
    case = fresh.get(report(fresh, "Sảnh chính tòa SIM-A nước tràn ra lối đi, trơn trượt, chắn lối, cần vệ sinh."))
    assert (case.ticket.priority, case.ticket.priority_rule_id, case.ticket.status) == ("HIGH", "PRI-H2", "ROUTED")
    rows = [e for e in case.audit if e.action == Action.CREATE_PROPOSAL and e.field_name == "priority"]
    assert len(rows) == 1 and rows[0].rule_id == "PRI-H2" and rows[0].new_value == "HIGH"


def test_priority_set_for_locked_category_too(fresh):
    """P03 §3.1: a category chosen by BPTN also gets a priority (lighting in a corridor becomes HIGH)."""
    tid = report(fresh, CLEANING)
    assert fresh.get(tid).ticket.priority == "MEDIUM"
    fresh.return_wrong_department(tid, CLN, note="Việc kỹ thuật")
    case = fresh.bptn_resolve(tid, BPTN, category="KY_THUAT", note="Đúng là kỹ thuật")
    assert (case.ticket.priority, case.ticket.priority_rule_id) == ("HIGH", "PRI-H1")
    assert case.ticket.priority_source == "AGENT_RULE"


def test_human_override_needs_note_and_sticks(fresh):
    """AC-10, R-04: a manual change needs a reason, is audited once, and survives every pipeline rerun."""
    tid = report(fresh, CLEANING)
    with pytest.raises(GuardError):
        fresh.set_priority(tid, BPTN, "HIGH", note="  ")
    case = fresh.set_priority(tid, BPTN, "HIGH", note="Lối đi chính giờ cao điểm")
    assert (case.ticket.priority, case.ticket.priority_source, case.ticket.priority_rule_id) == (
        "HIGH",
        "HUMAN_OVERRIDE",
        None,
    )
    assert case.ticket.priority_reason == "Lối đi chính giờ cao điểm"
    fresh.return_wrong_department(tid, CLN, note="Việc kỹ thuật")
    case = fresh.bptn_resolve(tid, BPTN, category="KY_THUAT", note="Đúng là kỹ thuật")
    assert (case.ticket.priority, case.ticket.priority_source, case.ticket.priority_rule_id) == (
        "HIGH",
        "HUMAN_OVERRIDE",
        None,
    )
    rows = [e for e in case.audit if e.action == Action.SET_PRIORITY]
    assert len(rows) == 1 and (rows[0].old_value, rows[0].new_value, rows[0].reason) == (
        "MEDIUM",
        "HIGH",
        "Lối đi chính giờ cao điểm",
    )
    assert fresh.set_priority(tid, BQL, Priority.LOW, note="Đã dọn xong phần lối đi").ticket.priority == "LOW"


def test_set_priority_denied_for_other_roles(fresh, engine):
    """AC-10, R-05, I-11: other roles get 403 with audit; bad input and finished tickets get 409; BPTN is denied on tier 1."""
    tid = report(fresh, CLEANING)
    before = fresh.get(tid).ticket.priority
    for actor in (CLN, RESIDENT):
        with pytest.raises(ActionDeniedError):
            fresh.set_priority(tid, actor, "LOW", note="x")
        assert fresh.get(tid).audit[-1].action_result == "ACTION_DENIED"
    with pytest.raises(GuardError):
        fresh.set_priority(tid, BPTN, "URGENT", note="x")
    assert fresh.get(tid).ticket.priority == before
    to_ready(fresh, tid)
    fresh.close(tid, BQL)
    with pytest.raises(GuardError):
        fresh.set_priority(tid, BQL, "HIGH", note="x")
    with pytest.raises(ActionDeniedError):  # E-13: BPTN on a BQL-owned blocker
        engine.set_priority("SIM-TKT-TEC-005", BPTN, "HIGH", note="x")
    assert engine.get("SIM-TKT-TEC-005").audit[-1].action_result == "ACTION_DENIED"
    assert engine.get("SIM-TKT-TEC-005").ticket.priority is None
    assert engine.set_priority("SIM-TKT-TEC-005", BQL, "HIGH", note="Ưu tiên xử lý").ticket.priority == "HIGH"


def test_queue_sort_order_and_related_ids(fresh, clock):
    """AC-10, R-03, Q11, Q14: EMERGENCY first, then HIGH, MEDIUM, LOW; the tier-1 ticket links the earlier ones."""
    t1 = report(fresh, CLEANING)
    clock.advance(minutes=1)
    t2 = report(fresh, LIGHTING)
    clock.advance(minutes=1)
    t3 = report(fresh, EMERGENCY_TEXT)
    clock.advance(minutes=1)
    t4 = report(fresh, "Cầu thang bộ tầng 6 tòa SIM-A nhiều bụi bẩn, cần vệ sinh.")
    assert [r.ticket_id for r in bql_rows(fresh, clock())] == [t3, t2, t1, t4]
    assert fresh.get(t3).ticket.related_ticket_ids == sorted([t1, t2])
    assert fresh.get(t3).ticket.priority is None  # tier 1: priority is not computed


def test_bql_rows_sorted(engine):
    """Q14: bql_rows follows the queue key: tier 1 first (oldest first), then HIGH, MEDIUM, LOW."""
    ids = [r.ticket_id for r in bql_rows(engine, engine.clock())]
    assert ids[:2] == ["SIM-TKT-CLN-004", "SIM-TKT-TEC-005"]
    rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, None: 3}
    ranks = [rank[engine.get(t).ticket.priority] for t in ids[2:]]
    assert ranks == sorted(ranks)


def test_set_priority_no_status_event_no_notification(fresh):
    """P03 §3.2: a manual change writes one audit row and no event or notification."""
    tid = report(fresh, CLEANING)
    before = fresh.get(tid)
    case = fresh.set_priority(tid, BQL, "HIGH", note="Khách VIP")
    assert len(case.events) == len(before.events) and len(case.notifications) == len(before.notifications)
    assert len(case.audit) == len(before.audit) + 1 and case.audit[-1].action == Action.SET_PRIORITY


def test_set_priority_goes_through_lock_and_mutate():
    """OPERATIONS §7.4: the new public writer takes the engine lock via `_mutate`."""
    source = Path(engine_module.__file__).read_text(encoding="utf-8")
    cls = next(n for n in ast.parse(source).body if isinstance(n, ast.ClassDef) and n.name == "MaintenanceEngine")
    func = next(f for f in cls.body if isinstance(f, ast.FunctionDef) and f.name == "set_priority")
    assert "self._mutate(" in ast.get_source_segment(source, func)


def test_priority_never_notifies_and_ignores_risk(fresh):
    """P03 §6 CẤM 1/2: a HIGH ticket sends nothing extra, and risk_level plays no part in the rule."""
    case = fresh.get(report(fresh, LIGHTING))
    assert case.ticket.priority == "HIGH"
    assert {n.type for n in case.notifications} <= {"ticket.status_changed", "department.dispatch"}


def test_negated_obstruction_is_not_h2():
    """R05 N-10 / Q27: 'không chắn lối đi, không trơn trượt' does not trigger PRI-H2; the plain wording still does."""
    where = "Tòa SIM-A / Tầng 3 / Hành lang"
    negated = "Hành lang tầng 3 tòa SIM-A có nhiều rác, không chắn lối đi, không trơn trượt."
    proposal = propose_priority(ServiceCategory.VE_SINH, where, negated, LEX)
    assert proposal.rule_id != "PRI-H2" and proposal.priority != "HIGH"
    assert proposal.rule_id == "PRI-M2"  # the real impact ("nhiều rác") is kept
    only_negated = propose_priority(ServiceCategory.VE_SINH, where, "Hành lang không chắn lối đi, không bị trơn.", LEX)
    assert only_negated.rule_id != "PRI-H2"
    assert (
        propose_priority(ServiceCategory.VE_SINH, where, "Hành lang chắn lối đi, trơn trượt.", LEX).rule_id == "PRI-H2"
    )
    mixed = propose_priority(ServiceCategory.VE_SINH, where, "Không chắn lối đi nhưng trơn trượt.", LEX)
    assert mixed.rule_id == "PRI-H2"  # a negation does not cross the conjunction


def test_priority_uses_shared_scope():
    """R-08 (WP3c, SPEC-P03 §1.1): priority negation is the safety R1 function itself; the seven documented sentences."""
    import src.maintenance.priority as priority_module
    import src.maintenance.safety as safety_module

    assert priority_module.scope_before is safety_module.scope_before
    where = "Tòa SIM-A / Tầng 3 / Hành lang"
    table = [
        ("Rác chưa được dọn chắn hết lối đi", "HIGH", "PRI-H2"),
        ("Sàn chưa lau nên trơn trượt", "HIGH", "PRI-H2"),
        ("Không ai dọn rác tràn ra lối đi", "HIGH", "PRI-H2"),
        ("Hành lang không chắn lối đi, không bị trơn.", "LOW", "PRI-L1"),
        ("Hành lang tầng 3 tòa SIM-A có nhiều rác, không chắn lối đi, không trơn trượt.", "MEDIUM", "PRI-M2"),
        ("Không chắn lối đi nhưng sàn trơn trượt", "HIGH", "PRI-H2"),
        ("Không có rác chắn lối đi", "HIGH", "PRI-H2"),  # known trade-off P3-06: "rác" is the cue's object
    ]
    for text, expected_priority, expected_rule in table:
        proposal = propose_priority(ServiceCategory.VE_SINH, where, text, LEX)
        assert (proposal.priority, proposal.rule_id) == (expected_priority, expected_rule), text
