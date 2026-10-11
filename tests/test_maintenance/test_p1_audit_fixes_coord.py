"""Plan 06 WP15 (SPEC-P08 §5-§7): coordination fixes after the adversarial review R12.

F4-F7: the duplicate count of P04 §2.1 survives `undo_split` and T09; no chain merge, no second-undo 422.
F8 (plan 06 Q36): the rules and the Mirror never split a report naming two places; the Agent's decision to split
   is NOT gated by counting place words (two pinning tests, one per direction).
F9: a follow-up keeps the place BPTN locked on its source.
"""

import json

import pytest

from src.maintenance.agent.baseline import mirror_decision
from src.maintenance.agent.client import ClientReply, MirrorClient
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import TERMINAL_STATUSES, ReasonCode, TicketStatus
from src.maintenance.errors import GuardError
from tests.test_maintenance.helpers import BPTN, BQL, RESIDENT, agent_engine

CATALOG = load_catalog()
LEXICON = load_lexicon()
LAMP = "Đèn phòng rác tầng 2 tòa S2 không sáng"  # not a PRI-H1 area: MEDIUM, so PRI-U1 can show
MIXED = "Phòng rác tầng 2 tòa S2 nhiều rác, đèn cũng không sáng"


@pytest.fixture(params=["rules", "agent"])
def any_engine(request, fresh, clock) -> MaintenanceEngine:
    """The same engine API with the rules alone and with the Agent (Mirror client, decides like the rules)."""
    return fresh if request.param == "rules" else agent_engine(clock, MirrorClient(CATALOG, LEXICON))


def pointing_at(engine: MaintenanceEngine, root_id: str) -> int:
    """Open tickets waiting as a suspected duplicate of `root_id` (VERIFYING/DUPLICATE)."""
    return sum(
        1
        for c in engine.repo.list()
        if c.ticket.status == TicketStatus.VERIFYING
        and c.ticket.blocker is not None
        and c.ticket.blocker.code == ReasonCode.DUPLICATE
        and c.ticket.blocker.related_ticket_id == root_id
    )


def expected_count(engine: MaintenanceEngine, ticket_id: str) -> int:
    """P04 §2.1: suspects pointing at the ticket + tickets merged into it that are not its own split children."""
    merged = sum(
        1
        for c in engine.repo.list()
        if c.ticket.status == TicketStatus.MERGED
        and c.ticket.merged_into == ticket_id
        and c.ticket.split_from != ticket_id
    )
    return pointing_at(engine, ticket_id) + merged


def assert_counts_hold(engine: MaintenanceEngine) -> None:
    for c in engine.repo.list():
        if c.ticket.status in TERMINAL_STATUSES:
            continue
        want = expected_count(engine, c.ticket.ticket_id)
        assert c.ticket.duplicate_count == want, (c.ticket.ticket_id, c.ticket.duplicate_count, want)


# ---------------------------------------------------------------------------------------------- F4 (SPEC-P08 §5)


def test_f4_undo_split_of_a_duplicate_child_gives_the_count_back(any_engine, clock):
    engine = any_engine
    raise_at = engine.catalog.sla_config.priority.duplicate_raise_at_count
    root = engine.receive(LAMP, resident_id=RESIDENT).ticket
    for _ in range(raise_at):
        clock.advance(minutes=5)
        parent = engine.receive(MIXED, resident_id=RESIDENT).ticket
        child_id = parent.split_children[0]
        child = engine.get(child_id).ticket
        assert child.blocker is not None and child.blocker.code == ReasonCode.DUPLICATE
        assert child.blocker.related_ticket_id == root.ticket_id
        engine.undo_split(child_id, BPTN, note="tách sai")
        assert_counts_hold(engine)
    final = engine.get(root.ticket_id).ticket
    assert final.duplicate_count == 0
    assert "PRI-U1" not in (final.priority_reason or "")


# ---------------------------------------------------------------------------------------------- F5 (SPEC-P08 §5)


def test_f5_second_undo_split_after_undo_merge_is_clean(any_engine, clock):
    engine = any_engine
    clock.advance(minutes=5)
    parent = engine.receive("Hành lang tầng 7 tòa S2 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT).ticket
    child_id = parent.split_children[0]
    engine.undo_split(child_id, BPTN, note="tách sai")
    engine.undo_merge(child_id, BQL, note="tách đúng mà")
    engine.undo_split(child_id, BPTN, note="vẫn là tách sai")  # must not raise (was ValidationError / 422)
    root = engine.get(parent.ticket_id).ticket
    assert root.merged_children.count(child_id) == 1
    assert engine.get(child_id).ticket.status == TicketStatus.MERGED


# ---------------------------------------------------------------------------------------------- F6 (SPEC-P08 §5)


def test_f6_undo_split_refuses_a_child_that_has_merged_children(any_engine, clock):
    engine = any_engine
    parent = engine.receive("Sảnh thang máy tầng 5 tòa S1 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT).ticket
    child_id = parent.split_children[0]
    clock.advance(minutes=5)
    lamp = engine.receive("Đèn sảnh thang máy tầng 5 tòa S1 không sáng", resident_id=RESIDENT).ticket
    assert lamp.blocker is not None and lamp.blocker.code == ReasonCode.DUPLICATE
    assert lamp.blocker.related_ticket_id == child_id
    engine.bptn_resolve(lamp.ticket_id, BPTN, merge=True, note="trùng")  # the lamp report is MERGED into the child
    with pytest.raises(GuardError):
        engine.undo_split(child_id, BPTN, note="tách sai")
    assert engine.get(child_id).ticket.status != TicketStatus.MERGED
    assert engine.get(lamp.ticket_id).ticket.merged_into == child_id


# ---------------------------------------------------------------------------------------------- F7 (SPEC-P08 §5)


def test_f7_ticket_reopened_by_t09_recounts_its_suspects(any_engine, clock):
    engine = any_engine
    clock.advance(minutes=5)
    parent = engine.receive("Hành lang tầng 2 tòa S2 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT).ticket
    c_id = parent.split_children[0]
    clock.advance(minutes=5)
    lamp = engine.receive("Đèn hành lang tầng 2 tòa S2 không sáng", resident_id=RESIDENT).ticket
    assert lamp.blocker is not None and lamp.blocker.related_ticket_id == c_id
    assert engine.get(c_id).ticket.duplicate_count == 1
    engine.undo_split(c_id, BPTN, note="tách sai")  # the child is MERGED: its count is frozen
    engine.bptn_resolve(lamp.ticket_id, BPTN, merge=False, note="khác vụ")  # the only suspect leaves
    engine.undo_merge(c_id, BQL, note="tách đúng mà")  # T09
    got = engine.get(c_id).ticket.duplicate_count
    assert got == pointing_at(engine, c_id) == 0, got
    assert_counts_hold(engine)


# ---------------------------------------------------------------------------------------------- F8 (SPEC-P08 §6, Q36)

TWO_PLACES = [
    "Hành lang tầng 3 tòa S1 nhiều rác, còn đèn sảnh thang máy tầng 5 tòa S1 không sáng",
    "Rác ở hầm xe tầng B1 tòa S1, đèn hành lang tầng 2 tòa S2 cũng hỏng",
    "Tầng 3 tòa S1 hành lang nhiều rác; tầng 7 tòa S2 hành lang đèn không sáng",
]


def _agent_two_jobs(report: str) -> str:
    """A fake model that finds two jobs (cleaning + lamp) at a catalog place, whatever the report says."""
    job = {
        "reason": "test",
        "department_id": None,
        "priority": "MEDIUM",
        "priority_rule_id": None,
        "priority_reason": "test",
        "duplicate_of": None,
        "duplicate_reason": "test",
        "asset_id": None,
        "asset_reason": "test",
        "materials": [],
        "needs_review": False,
        "review_reason": None,
    }
    jobs = [
        {
            **job,
            "category": "VE_SINH",
            "quote": "nhiều rác",
            "department_id": "DEPT_CLEANING",
            "priority_rule_id": "PRI-M2",
        },
        {
            **job,
            "category": "KY_THUAT",
            "quote": "đèn",
            "department_id": "DEPT_TECHNICAL",
            "priority_rule_id": "PRI-M1",
        },
    ]
    return json.dumps(
        {
            "schema_version": "agent-decision/1",
            "reasoning": [{"step": "KET_LUAN", "facts": [], "conclusion": "test"}],
            "safety": {"risk_level": "NONE", "signals": [], "reason": "Không thấy nguy hiểm"},
            "location": {"building": "S1", "floor": "3", "area": "Hành lang", "quote": report[:40], "reason": "test"},
            "scope": "IN_SCOPE",
            "jobs": jobs,
            "next_step": "PROCEED",
            "ask_fields": [],
            "bptn_reason": None,
            "note_for_staff": "",
        },
        ensure_ascii=False,
    )


@pytest.mark.parametrize("text", TWO_PLACES)
@pytest.mark.parametrize("mode", ["rules", "mirror"])
def test_f8_rules_and_mirror_do_not_split_a_two_places_report(mode, text, clock):
    if mode == "rules":
        engine = MaintenanceEngine(clock=clock)
        engine.reset(with_fixtures=False)
    else:
        engine = agent_engine(clock, MirrorClient(CATALOG, LEXICON))
    ticket = engine.receive(text, resident_id=RESIDENT).ticket
    assert ticket.split_children == []
    assert ticket.split_category is None


@pytest.mark.parametrize("text", TWO_PLACES)
def test_f8_agent_decision_to_split_is_not_gated_by_place_words(text, clock):
    """Q36: the Agent decides by meaning; the code must not veto a valid two-job answer by counting place words."""

    class Fake:
        def __call__(self, system, user, data):
            return ClientReply(text=_agent_two_jobs(data.report_text), latency_ms=0.0)

    engine = agent_engine(clock, Fake())
    ticket = engine.receive(text, resident_id=RESIDENT).ticket
    assert len(ticket.split_children) == 1


# ---------------------------------------------------------------------------------------------- F9 (SPEC-P08 §7)


@pytest.mark.parametrize("mode", ["mirror", "agent-reads-text"])
def test_f9_follow_up_keeps_the_place_bptn_locked(mode, clock):
    class Fake:
        def __call__(self, system, user, data):
            if mode == "mirror" or data.follow_up_of is None:
                return ClientReply(text=mirror_decision(data, CATALOG, LEXICON).model_dump_json(), latency_ms=0.0)
            # an Agent that reads only the text (no place there) and guesses another one
            raw = json.loads(_agent_two_jobs(data.report_text))
            raw["jobs"] = [raw["jobs"][1]]
            raw["location"] = {"building": "S2", "floor": "7", "area": "Hành lang", "quote": None, "reason": "đoán"}
            return ClientReply(text=json.dumps(raw, ensure_ascii=False), latency_ms=0.0)

    engine = agent_engine(clock, Fake())
    tid = engine.receive("Đèn không sáng", resident_id=RESIDENT).ticket.ticket_id
    clock.advance(minutes=10)
    engine.bptn_resolve(
        tid, BPTN, location="Tòa S1 / Tầng 3 / Hành lang", info="có khói bốc ra từ hộp đèn", note="gọi cư dân"
    )
    clock.advance(minutes=30)
    new = engine.create_follow_up(tid, BQL, note="đã tắt điện, cần thay đèn")
    assert new.ticket.locked_fields.location == "Tòa S1 / Tầng 3 / Hành lang"
    assert engine.effective_location(new) == "Tòa S1 / Tầng 3 / Hành lang"
    assert new.ticket.blocker is None or new.ticket.blocker.code != ReasonCode.MISSING_INFO
