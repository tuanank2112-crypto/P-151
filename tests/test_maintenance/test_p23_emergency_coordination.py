"""Plan 23 (TESTING-ACCEPTANCE §1): an emergency that is a duplicate (P01), a two-job emergency after a person clears
it (P02), and an ordinary ticket next to an open emergency of the same kind of work (P03). No test calls a network:
the Agent cases use a fake that sees danger only in a given sentence and mirrors the rules for the rest.
"""

import pytest
from fastapi.testclient import TestClient

from src.maintenance.agent.agent import ReasoningAgent
from src.maintenance.agent.client import ClientReply, MirrorClient
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import InvalidTransitionError, MaintenanceEngine
from src.maintenance.enums import ServiceCategory, TicketStatus
from src.maintenance.errors import GuardError
from tests.test_maintenance.helpers import BPTN, BQL, MONDAY_9AM, OTHER_RESIDENT, RESIDENT, Clock, decision, report

CATALOG = load_catalog()
LEXICON = load_lexicon()
FIRE = "Đèn hành lang tầng 3 tòa S1 bị chập tóe lửa, có khói."  # rule tier 1, lighting kind in its words
SMOKE = "Có mùi khét ở hành lang tầng 3 tòa S1."  # rule tier 1, no kind of work in its words
FIRE_ELSEWHERE = "Đèn hành lang tầng 4 tòa S1 bị chập tóe lửa, có khói."
LAMP = "Đèn hành lang tầng 3 tòa S1 không sáng."
TRASH = "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh."
MIXED_FIRE = "Hành lang tầng 3 tòa S1 đèn chập tóe lửa có khói, và rác thải rất nhiều cần dọn."
CRACKLE = "Trần hành lang tầng 3 tòa S1 kêu lách tách, có mùi lạ"  # the fake Agent calls this an emergency


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def engine(clock) -> MaintenanceEngine:
    e = MaintenanceEngine(clock=clock)
    e.reset(with_fixtures=False)
    return e


def later(clock: Clock, engine: MaintenanceEngine, text: str, resident: str = OTHER_RESIDENT) -> str:
    clock.advance(minutes=5)
    return report(engine, text, resident)


def state(engine: MaintenanceEngine, tid: str) -> tuple[str, str | None]:
    t = engine.get(tid).ticket
    return t.status, t.blocker.code if t.blocker else None


def suspect_of(engine: MaintenanceEngine, tid: str) -> str | None:
    blocker = engine.get(tid).ticket.blocker
    return blocker.related_ticket_id if blocker else None


def count(engine: MaintenanceEngine, tid: str) -> int:
    return engine.get(tid).ticket.duplicate_count


# ------------------------------------------------------------------ P01: emergency suspected duplicate


def test_d01_second_emergency_is_flagged_and_counted_but_stays_with_bql(clock, engine):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    assert state(engine, second) == ("VERIFYING", "EMERGENCY_PENDING_BQL")  # I-1: never hidden
    assert suspect_of(engine, second) == first and suspect_of(engine, first) is None
    assert count(engine, first) == 1 and count(engine, second) == 0
    note = [n for n in engine.get(second).notifications if n.type == "emergency.created"][-1]
    assert note.payload["suspected_duplicate_of"] == first


def test_d02_three_reports_all_point_at_the_oldest(clock, engine):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    third = later(clock, engine, SMOKE, RESIDENT)
    assert suspect_of(engine, second) == suspect_of(engine, third) == first
    assert count(engine, first) == 2 and count(engine, second) == 0


def test_d03_another_place_or_no_place_is_not_a_suspect(clock, engine):
    first = report(engine, FIRE)
    elsewhere = later(clock, engine, FIRE_ELSEWHERE)
    nowhere = later(clock, engine, "Có khói và tia lửa, cứu với")
    assert suspect_of(engine, elsewhere) is None and suspect_of(engine, nowhere) is None
    assert count(engine, first) == 0


def test_d04_bql_merges_into_the_suspected_root_without_counting_twice(clock, engine):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    merged = engine.bql_merge(second, BQL, into=first, note="Cùng một đám khói")
    assert merged.ticket.status == TicketStatus.MERGED and merged.ticket.merged_into == first
    assert count(engine, first) == 1


def test_d05_downgraded_suspect_is_released(clock, engine):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    engine.emergency_downgrade(second, BQL, note="Đèn chỉ hỏng, không cháy")
    assert engine.get(second).ticket.risk_level == "NONE"
    assert count(engine, first) == 0


@pytest.mark.parametrize("how", ["close", "cancel"])
def test_d06_closed_or_cancelled_suspect_is_released(clock, engine, how):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    if how == "close":
        engine.emergency_close(second, BQL, note="Đã xử lý cùng ca trước")
    else:
        engine.cancel(second, BQL, cancel_reason="Báo trùng")
    assert count(engine, first) == 0


def test_d07_merged_into_another_root_moves_the_count(clock, engine):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    third = later(clock, engine, FIRE, RESIDENT)
    assert count(engine, first) == 2
    engine.bql_merge(second, BQL, into=third, note="Gộp vào báo sau, nhiều chi tiết hơn")
    assert count(engine, first) == 1 and count(engine, third) == 1


def test_d08_bptn_escalation_to_emergency_is_flagged(clock, engine):
    first = report(engine, FIRE)
    tier2 = later(clock, engine, "Hành lang tầng 3 tòa S1 nghe kêu xèo xèo trên trần")
    assert state(engine, tier2) == ("VERIFYING", "SAFETY_REVIEW_REQUIRED")
    engine.safety_escalate(tier2, BPTN, note="Gọi cư dân: có khói")
    assert state(engine, tier2) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert suspect_of(engine, tier2) == first and count(engine, first) == 1


def test_d08b_guards_of_bql_merge(clock, engine):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    with pytest.raises(GuardError):
        engine.bql_merge(second, BQL, into=first, note="  ")
    lamp = later(clock, engine, LAMP.replace("tầng 3", "tầng 5"))
    with pytest.raises(InvalidTransitionError):
        engine.bql_merge(lamp, BQL, into=first, note="không phải khẩn cấp")
    assert count(engine, first) == 1


def test_d09_api_merge_route(clock, engine):
    from src.api.auth import actor_header_allowed
    from src.api.routers.maintenance import get_engine
    from src.main import app

    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    path = f"/api/v1/bql/tickets/{second}/emergency/merge"
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[actor_header_allowed] = lambda: True
    try:
        client = TestClient(app)
        denied = client.post(path, json={"into": first, "note": "trùng"}, headers={"X-Actor-Id": BPTN})
        assert denied.status_code == 403
        no_note = client.post(path, json={"into": first}, headers={"X-Actor-Id": BQL})
        assert no_note.status_code in (409, 422)
        lamp = later(clock, engine, LAMP.replace("tầng 3", "tầng 5"))
        wrong = client.post(
            f"/api/v1/bql/tickets/{lamp}/emergency/merge",
            json={"into": first, "note": "x"},
            headers={"X-Actor-Id": BQL},
        )
        assert wrong.status_code == 409
        ok = client.post(path, json={"into": first, "note": "Cùng một đám khói"}, headers={"X-Actor-Id": BQL})
        assert ok.status_code == 200 and ok.json()["ticket"]["status"] == "MERGED"
        assert count(engine, first) == 1
    finally:
        app.dependency_overrides.pop(get_engine, None)
        app.dependency_overrides.pop(actor_header_allowed, None)


# ------------------------------------------------------------------ P02: split after a person clears the emergency


def test_s01_two_job_emergency_splits_after_bql_downgrade(engine):
    root_id = report(engine, MIXED_FIRE)
    assert state(engine, root_id) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    engine.emergency_downgrade(root_id, BQL, note="Đèn chỉ hỏng, không có lửa")
    root = engine.get(root_id)
    assert len(root.ticket.split_children) == 1
    child = engine.get(root.ticket.split_children[0])
    assert (root.ticket.split_category, child.ticket.split_category) == ("VE_SINH", "KY_THUAT")
    assert child.ticket.safety_cleared_at == root.ticket.safety_cleared_at and child.ticket.safety_cleared_by == BQL
    assert child.ticket.risk_level == "NONE" and child.ticket.department_id == "DEPT_TECHNICAL"
    assert root.ticket.department_id == "DEPT_CLEANING"


def test_s01b_the_child_reads_no_cleared_words_but_reads_later_additions(engine):
    """I-4: the words BQL cleared are outside the child's 2b scope; an addition made after the clearance is inside."""
    root_id = report(engine, MIXED_FIRE)
    engine.emergency_downgrade(root_id, BQL, note="Đèn chỉ hỏng, không có lửa")
    child = engine.get(engine.get(root_id).ticket.split_children[0])
    assert engine._safety_scope_text(child) == ""
    later_word = child.model_copy(deep=True)
    later_word.additions.append(
        later_word.additions[0].model_copy(update={"content": "Lại có lửa", "submitted_at": engine.clock()})
        if later_word.additions
        else _addition(child, engine.clock())
    )
    assert engine._safety_scope_text(later_word) == "Lại có lửa"


def _addition(case, at):
    from src.maintenance.models import ResidentAddition

    return ResidentAddition(
        addition_id=f"SIM-ADD-{case.ticket.ticket_id[-4:]}-01",
        ticket_id=case.ticket.ticket_id,
        content="Lại có lửa",
        submitted_by=RESIDENT,
        submitted_at=at,
    )


def test_s03_still_an_emergency_never_splits(engine):
    root_id = report(engine, MIXED_FIRE)
    assert engine.get(root_id).ticket.split_children == [] and len(engine.repo.list()) == 1


SPILL = "Hành lang tầng 3 tòa S1 có chất lỏng lạ bốc mùi hắc gây khó thở, cần vệ sinh."  # rule tier 1


class Reader:
    """The fake Agent: a report containing a key of `kinds` is an emergency with one job of that kind (a grounded
    tier-1 signal), or with no job when the kind is None; any other report mirrors the rules. `safety` lets a test
    make the model say less than the rules did."""

    def __init__(self, kinds: dict[str, ServiceCategory | None], safety: str = "EMERGENCY"):
        self.kinds, self.safety = kinds, safety
        self.mirror = MirrorClient(CATALOG, LEXICON)
        self.calls: list[str] = []

    def __call__(self, system, user, data) -> ClientReply:
        key = next((k for k in self.kinds if k in data.report_text), None)
        if key is None:
            return self.mirror(system, user, data)
        self.calls.append(key)
        kind = self.kinds[key]
        jobs = [] if kind is None else [decision_jobs()[1 if kind == ServiceCategory.KY_THUAT else 0]]
        signals = [{"signal_id": "S-00", "status": "PRESENT", "quote": key[:20]}] if self.safety == "EMERGENCY" else []
        fields = {"safety.risk_level": self.safety, "safety.signals": signals, "jobs": jobs}
        if not jobs:  # prompt rule: a real danger with no cleaning/lamp job is out of scope for BPTN
            fields.update({"scope": "OUT_OF_SCOPE", "next_step": "TO_BPTN", "bptn_reason": "OUT_OF_SCOPE"})
        return ClientReply(text=decision(**fields), latency_ms=0.0)


def decision_jobs() -> list[dict]:
    import json

    return json.loads(decision())["jobs"]


def agent_engine(clock: Clock, kinds: dict[str, ServiceCategory | None], safety: str = "EMERGENCY"):
    client = Reader(kinds, safety)
    agent = ReasoningAgent(client, catalog=CATALOG, lexicon=LEXICON, model_label="fake", clock=clock)
    e = MaintenanceEngine(clock=clock, agent=agent)
    e.reset(with_fixtures=False)
    return e, client


def rule_emergency_read(engine: MaintenanceEngine, text: str) -> str:
    """A rule emergency: stopped without the model, then read by the Agent (what the API starts in the background)."""
    tid = report(engine, text)
    assert engine.get(tid).agent_decision.source == "SKIPPED_RULE_EMERGENCY"
    assert engine.needs_emergency_read(engine.get(tid))
    engine.read_emergency(tid)
    assert engine.get(tid).agent_decision.source == "AGENT"
    return tid


# ------------------------------------------------------------------ P03/P04: hold next to an open emergency


def test_h01_nobody_read_the_emergency_so_nothing_is_held(clock, engine):
    """No Agent: the kind of a rule emergency is unknown and is never guessed from its words (R01 F1) => link only."""
    fire = report(engine, FIRE)
    lamp = later(clock, engine, LAMP)
    assert engine.get(lamp).ticket.status == TicketStatus.ROUTED
    assert fire in engine.get(lamp).ticket.related_ticket_ids
    assert engine._emergency_kinds(engine.get(fire)) is None


def test_p04_the_agent_reads_a_rule_emergency_and_its_reading_decides_the_hold(clock):
    engine, client = agent_engine(clock, {FIRE: ServiceCategory.KY_THUAT})
    fire = report(engine, FIRE)
    assert client.calls == []  # stopping it never waits for the model
    engine.read_emergency(fire)
    assert client.calls == [FIRE]
    case = engine.get(fire)
    assert case.agent_decision.source == "AGENT" and state(engine, fire) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert engine._emergency_kinds(case) == frozenset({ServiceCategory.KY_THUAT})
    lamp = later(clock, engine, LAMP)
    trash = later(clock, engine, TRASH)
    assert state(engine, lamp) == ("ON_HOLD", "WAITING_EMERGENCY")
    assert (
        engine.get(trash).ticket.status == TicketStatus.ROUTED and fire in engine.get(trash).ticket.related_ticket_ids
    )
    assert engine.read_emergency(fire) is None and client.calls == [FIRE]  # read once


def test_p04_the_reading_never_lowers_the_level(clock):
    engine, _ = agent_engine(clock, {FIRE: ServiceCategory.KY_THUAT}, safety="NONE")
    fire = report(engine, FIRE)
    engine.read_emergency(fire)
    t = engine.get(fire).ticket
    assert (t.status, t.blocker.code, t.risk_level) == ("VERIFYING", "EMERGENCY_PENDING_BQL", "EMERGENCY")


def test_p04_a_reading_after_bql_acted_is_dropped(clock):
    engine, client = agent_engine(clock, {FIRE: ServiceCategory.KY_THUAT})
    fire = report(engine, FIRE)
    engine.emergency_close(fire, BQL, note="Đã ngắt điện")
    assert engine.read_emergency(fire) is None and client.calls == []
    assert engine.get(fire).agent_decision.source == "SKIPPED_RULE_EMERGENCY"


def test_p04_no_job_read_holds_nothing(clock):
    engine, _ = agent_engine(clock, {SMOKE: None})
    rule_emergency_read(engine, SMOKE)
    lamp = later(clock, engine, LAMP)
    assert engine.get(lamp).ticket.status == TicketStatus.ROUTED


@pytest.mark.parametrize(
    ("kind", "text", "held"),
    [
        (ServiceCategory.KY_THUAT, LAMP, True),  # H-02
        (ServiceCategory.KY_THUAT, TRASH, False),  # H-03
        (ServiceCategory.VE_SINH, TRASH, True),
        (ServiceCategory.VE_SINH, LAMP, False),
    ],
)
def test_h02_h03_agent_kind_decides_the_hold(clock, kind, text, held):
    engine, _ = agent_engine(clock, {CRACKLE: kind})
    emergency = report(engine, CRACKLE)  # raised by the Agent itself (the rules see only tier 2)
    assert state(engine, emergency) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert engine._emergency_kinds(engine.get(emergency)) == frozenset({kind})
    other = later(clock, engine, text)
    expected = ("ON_HOLD", "WAITING_EMERGENCY") if held else ("ROUTED", None)
    assert state(engine, other) == expected
    assert emergency in engine.get(other).ticket.related_ticket_ids


@pytest.mark.parametrize("how", ["downgrade", "close"])
def test_h04_the_held_ticket_goes_on_when_bql_handles_the_emergency(clock, how):
    engine, _ = agent_engine(clock, {FIRE: ServiceCategory.KY_THUAT})
    fire = rule_emergency_read(engine, FIRE)
    lamp = later(clock, engine, LAMP)
    assert state(engine, lamp) == ("ON_HOLD", "WAITING_EMERGENCY")
    if how == "downgrade":
        engine.emergency_downgrade(fire, BQL, note="Chỉ là đèn hỏng")
    else:
        engine.emergency_close(fire, BQL, note="Đã ngắt điện, gọi thợ")
    assert state(engine, lamp) == ("ROUTED", None)


def test_h05_a_second_emergency_of_another_kind_does_not_keep_the_ticket(clock):
    engine, _ = agent_engine(clock, {FIRE: ServiceCategory.KY_THUAT, SPILL: ServiceCategory.VE_SINH})
    fire = rule_emergency_read(engine, FIRE)
    lamp = later(clock, engine, LAMP)
    clock.advance(minutes=5)
    rule_emergency_read(engine, SPILL)
    engine.emergency_close(fire, BQL, note="Đã ngắt điện")
    assert state(engine, lamp) == ("ROUTED", None)  # the spill is cleaning work: the lamp may go on


def test_r_merged_emergency_keeps_its_kind_for_the_held_ticket(clock):
    """F4: the lamp waits for the lighting emergency; BQL merges that one into a cleaning emergency: still waits."""
    engine, _ = agent_engine(clock, {FIRE: ServiceCategory.KY_THUAT, SPILL: ServiceCategory.VE_SINH})
    fire = rule_emergency_read(engine, FIRE)
    lamp = later(clock, engine, LAMP)
    clock.advance(minutes=5)
    spill = rule_emergency_read(engine, SPILL)
    assert state(engine, lamp) == ("ON_HOLD", "WAITING_EMERGENCY")
    engine.bql_merge(fire, BQL, into=spill, note="Cùng một sự cố")
    assert state(engine, lamp) == ("ON_HOLD", "WAITING_EMERGENCY")
    assert spill in engine.get(lamp).ticket.blocker.internal_note  # F8: names the one it waits for now


# ------------------------------------------------------------------ regressions from the isolated review (R01)


def test_r_root_downgraded_first_the_next_emergency_points_at_one_still_open(clock, engine):
    """F2: the oldest open emergency is the root; a pointer to a ticket that is no longer an emergency is not followed."""
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    engine.emergency_downgrade(first, BQL, note="Chỉ là đèn hỏng")
    assert suspect_of(engine, second) is None  # it is the open root now (P01 §3)
    third = later(clock, engine, FIRE, RESIDENT)
    assert suspect_of(engine, third) == second and count(engine, second) == 1
    assert count(engine, first) == 0  # an ordinary ticket now: no emergency counted on it, no PRI-U1 raise from them


@pytest.mark.parametrize("how", ["close", "cancel"])
def test_r_root_closed_first_the_next_emergency_is_still_flagged(clock, engine, how):
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    if how == "close":
        engine.emergency_close(first, BQL, note="Đã ngắt điện")
    else:
        engine.cancel(first, BQL, cancel_reason="Nhầm")
    third = later(clock, engine, FIRE, RESIDENT)
    assert suspect_of(engine, second) is None and suspect_of(engine, third) == second
    assert count(engine, second) == 1


def test_r_suspects_follow_their_root_into_the_merge(clock, engine):
    """F7: BQL merges the root into its own suspect; no pointer is left to a MERGED ticket."""
    first = report(engine, FIRE)
    second = later(clock, engine, FIRE)
    third = later(clock, engine, FIRE, RESIDENT)
    engine.bql_merge(first, BQL, into=second, note="Ca sau mô tả rõ hơn")
    assert suspect_of(engine, second) is None
    assert suspect_of(engine, third) == second
    assert count(engine, second) == 2  # `first` merged in + `third` waiting


def test_r_t07_escalation_is_flagged(clock, engine):
    first = report(engine, FIRE)
    tier2 = later(clock, engine, "Hành lang tầng 3 tòa S1 nghe kêu xèo xèo trên trần")
    engine.safety_request_info(tier2, BPTN, note="Anh chị thấy khói không?")
    assert state(engine, tier2) == ("NEED_INFO", "MISSING_INFO")
    engine.safety_escalate(tier2, BQL, note="Cư dân không trả lời, nâng khẩn cấp")
    assert state(engine, tier2) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert suspect_of(engine, tier2) == first and count(engine, first) == 1


def test_r_pinned_kind_wins(engine):
    """P03 §2.1: a kind a person or a split pinned is the kind, whatever the words say."""
    smoke = report(engine, SMOKE)
    case = engine.get(smoke)
    assert engine._emergency_kinds(case) is None  # no kind in "mùi khét"
    pinned = case.model_copy(update={"ticket": case.ticket.model_copy(update={"split_category": "VE_SINH",
                                                                                "split_from": "SIM-TKT-9999"})})  # fmt: skip
    assert engine._emergency_kinds(pinned) == frozenset({ServiceCategory.VE_SINH})


def test_r_split_follow_up_never_waits_for_its_own_source(clock, engine):
    """F3: a follow-up of a two-job emergency splits; both halves are follow-ups of the source, none waits for it."""
    source = report(engine, MIXED_FIRE)
    follow = engine.create_follow_up(source, BQL, note="Sửa đèn và dọn rác sau sự cố")
    new_ids = [c.ticket.ticket_id for c in engine.repo.list() if c.ticket.follow_up_of == source]
    assert len(new_ids) == 2, (follow.ticket.ticket_id, new_ids)
    for tid in new_ids:
        assert engine.get(tid).ticket.status == TicketStatus.ROUTED


def test_s02_agent_path_splits_after_downgrade(clock):
    from src.maintenance.agent.client import ScriptedClient

    agent = ReasoningAgent(ScriptedClient({}, default=decision()), catalog=CATALOG, lexicon=LEXICON,
                           model_label="fake", clock=clock)  # fmt: skip
    e = MaintenanceEngine(clock=clock, agent=agent)
    e.reset(with_fixtures=False)
    root_id = report(e, MIXED_FIRE)
    assert state(e, root_id) == ("VERIFYING", "EMERGENCY_PENDING_BQL")  # a rule emergency skips the Agent
    e.emergency_downgrade(root_id, BQL, note="Đèn chỉ hỏng, không có lửa")
    root = e.get(root_id)
    assert root.agent_decision is not None and root.agent_decision.source == "AGENT"
    child = e.get(root.ticket.split_children[0])
    assert child.ticket.safety_cleared_at == root.ticket.safety_cleared_at and child.ticket.risk_level == "NONE"


def test_r02_merge_into_a_newer_ticket_never_makes_a_chain(clock, engine):
    """Final review F-A: T1 merged into the newer T3 leaves T2 pointing at T3; a new T4 points at T3 (the root), not at
    the older suspect T2, so every merge BQL is offered is allowed."""
    t1 = report(engine, FIRE)
    t2 = later(clock, engine, FIRE)
    t3 = later(clock, engine, FIRE, RESIDENT)
    engine.bql_merge(t1, BQL, into=t3, note="Ca sau mô tả rõ hơn")
    assert suspect_of(engine, t2) == t3 and suspect_of(engine, t3) is None
    t4 = later(clock, engine, FIRE)
    assert suspect_of(engine, t4) == t3 and count(engine, t2) == 0
    engine.bql_merge(t2, BQL, into=t3, note="Cùng đám cháy")
    engine.bql_merge(t4, BQL, into=t3, note="Cùng đám cháy")
    assert count(engine, t3) == 3  # t1, t2, t4 merged in


def test_r02_a_dropped_reading_writes_nothing(clock):
    engine, _ = agent_engine(clock, {FIRE: ServiceCategory.KY_THUAT})
    fire = report(engine, FIRE)
    engine.cancel(fire, BQL, cancel_reason="Nhầm")
    version = engine.repo.version_of(fire)
    assert engine.read_emergency(fire) is None and engine.repo.version_of(fire) == version
