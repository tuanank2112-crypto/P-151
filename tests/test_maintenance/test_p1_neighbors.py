"""Plan 06 WP10 (SPEC-P07 sections 1-5, TESTING 3.9 E-01..E-08): an ordinary ticket next to an open emergency.

The link between the two is always written, both ways. Holding the ordinary ticket (`ON_HOLD / WAITING_EMERGENCY`)
happens only with `agent_policy.hold_near_open_emergency` on; it is off in the catalog (Q18), so the tests that need
it switch it on a copy of the catalog of their own engine, never in the YAML. The hook bodies are also checked
directly (`_open_emergencies_at`, `_hold_for_emergency`) for the shape SPEC-P07 gives them.
"""

import pytest

from src.maintenance.demo import evaluate
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import Action, TicketStatus
from src.maintenance.views import resident_view
from tests.test_maintenance.helpers import BPTN, BQL, MONDAY_9AM, RESIDENT, SYSTEM, Clock, report

SMOKE = "Có mùi khét ở hành lang tầng 3 tòa S1."  # tier 1: VERIFYING / EMERGENCY_PENDING_BQL
SMOKE_2 = "Có khói bốc ra từ hộp điện ở hành lang tầng 3 tòa S1."  # a second emergency at the same place
LAMP = "Đèn hành lang tầng 3 tòa S1 không sáng."
LAMP_ELSEWHERE = "Đèn hành lang tầng 4 tòa S1 không sáng."


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def engine(clock) -> MaintenanceEngine:
    e = MaintenanceEngine(clock=clock)
    e.reset(with_fixtures=False)
    return e


def hold_on(engine: MaintenanceEngine) -> None:
    """Q18 switched ON for this engine only (a copy of the catalog; the YAML stays false)."""
    policy = engine.catalog.agent_policy.model_copy(update={"hold_near_open_emergency": True})
    engine.catalog = engine.catalog.model_copy(update={"agent_policy": policy})


def emergency_then_lamp(engine: MaintenanceEngine, clock: Clock) -> tuple[str, str]:
    smoke = report(engine, SMOKE)
    clock.advance(minutes=10)
    return smoke, report(engine, LAMP)


def linked(engine: MaintenanceEngine, a: str, b: str) -> bool:
    return b in engine.get(a).ticket.related_ticket_ids and a in engine.get(b).ticket.related_ticket_ids


def test_e00_the_catalog_switch_is_off_and_the_hook_follows_it(engine, clock):
    assert engine.catalog.agent_policy.hold_near_open_emergency is False  # Q18: not turned on in the YAML
    smoke, lamp = emergency_then_lamp(engine, clock)
    case = engine.get(lamp)
    assert engine._open_emergencies_at("Tòa S1 / Tầng 3 / Hành lang", exclude=set()) == [smoke]
    assert engine._open_emergencies_at("Tòa S1 / Tầng 3 / Hành lang", exclude={smoke}) == []
    assert engine._open_emergencies_at(None, exclude=set()) == []
    assert case.ticket.status == TicketStatus.ROUTED
    hold_on(engine)
    assert engine.catalog.agent_policy.hold_near_open_emergency is True
    assert load_flag_from_yaml() is False  # the switch above never reached the file


def load_flag_from_yaml() -> bool:
    from src.maintenance.catalog import load_catalog

    return load_catalog().agent_policy.hold_near_open_emergency


def test_e01_a_new_emergency_is_listed_by_the_open_ticket_at_the_same_place(engine, clock):
    lamp = report(engine, LAMP)
    elsewhere = report(engine, LAMP_ELSEWHERE)
    before = engine.get(lamp).ticket.status
    clock.advance(minutes=10)
    smoke = report(engine, SMOKE)
    assert engine.get(smoke).ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    assert linked(engine, lamp, smoke)  # both ways, whatever the switch says
    assert engine.get(lamp).ticket.status == before  # a link, never a status change
    assert engine.get(elsewhere).ticket.related_ticket_ids == []  # another floor: not linked
    rows = [
        a for a in engine.get(lamp).audit if a.action == Action.LINK_TICKETS and a.field_name == "related_ticket_ids"
    ]
    assert len(rows) == 1 and rows[0].new_value == [smoke]


def test_e02_with_the_switch_off_an_ordinary_ticket_is_routed_and_linked(engine, clock):
    smoke, lamp = emergency_then_lamp(engine, clock)
    ticket = engine.get(lamp).ticket
    assert ticket.status == TicketStatus.ROUTED and ticket.blocker is None
    assert linked(engine, smoke, lamp)
    assert engine.get(smoke).ticket.status == TicketStatus.VERIFYING  # the emergency is untouched


def test_e03_with_the_switch_on_the_ticket_waits_and_the_resident_sees_a_neutral_label(engine, clock):
    hold_on(engine)
    smoke, lamp = emergency_then_lamp(engine, clock)
    ticket = engine.get(lamp).ticket
    assert (ticket.status, ticket.blocker.code, ticket.blocker.owner_role) == ("ON_HOLD", "WAITING_EMERGENCY", "SYSTEM")
    assert ticket.blocker.resume_step == 8 and ticket.department_id is None
    assert smoke in ticket.blocker.internal_note
    assert linked(engine, smoke, lamp)
    view = resident_view(engine, engine.get(lamp), engine.clock())
    assert view.status_label == "Đang được kiểm tra"
    # nobody but BQL's own action releases it: BPTN cannot (SYSTEM owns the blocker), nor the resident
    assert engine.get(lamp).ticket.blocker.owner_role == "SYSTEM"
    for actor in (BPTN, RESIDENT):
        with pytest.raises(Exception):  # noqa: B017 - any refusal; the exact type is the engine's permission rule
            engine.transition(lamp, TicketStatus.RECEIVED, actor)
    assert engine.get(lamp).ticket.status == TicketStatus.ON_HOLD


def test_e04_run_jobs_and_resume_never_release_a_waiting_ticket(engine, clock):
    hold_on(engine)
    smoke, lamp = emergency_then_lamp(engine, clock)
    clock.advance(hours=30)
    engine.run_jobs()
    engine.resume(lamp)
    clock.advance(hours=30)
    engine.run_jobs()
    ticket = engine.get(lamp).ticket
    assert (ticket.status, ticket.blocker.code) == ("ON_HOLD", "WAITING_EMERGENCY")
    assert ticket.blocker.escalated is False and ticket.blocker.next_retry_at is None  # no timer, no escalation
    assert engine.get(smoke).ticket.status == TicketStatus.VERIFYING


def test_e05_closing_the_emergency_releases_the_waiting_ticket(engine, clock):
    hold_on(engine)
    smoke, lamp = emergency_then_lamp(engine, clock)
    engine.emergency_close(smoke, BQL, note="Đã xử lý tại chỗ")
    ticket = engine.get(lamp).ticket
    assert (ticket.status, ticket.blocker) == ("ROUTED", None)
    assert ticket.department_id == "DEPT_TECHNICAL"
    released = [e for e in engine.get(lamp).events if e.from_status == "ON_HOLD"]
    assert len(released) == 1 and released[0].actor_id == SYSTEM


def test_e05b_downgrading_the_emergency_releases_the_waiting_ticket_too(engine, clock):
    hold_on(engine)
    smoke, lamp = emergency_then_lamp(engine, clock)
    assert engine.get(lamp).ticket.status == TicketStatus.ON_HOLD
    engine.emergency_downgrade(smoke, BQL, note="Báo động giả")
    assert engine.get(lamp).ticket.status == TicketStatus.ROUTED
    assert engine.get(smoke).ticket.risk_level == "NONE"


def test_e06_one_of_two_emergencies_handled_the_ticket_still_waits(engine, clock):
    hold_on(engine)
    first = report(engine, SMOKE)
    clock.advance(minutes=5)
    second = report(engine, SMOKE_2)
    assert engine.get(second).ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    clock.advance(minutes=5)
    lamp = report(engine, LAMP)
    assert engine.get(lamp).ticket.status == TicketStatus.ON_HOLD
    assert linked(engine, first, lamp) and linked(engine, second, lamp)
    engine.emergency_close(first, BQL, note="Đã xử lý điểm thứ nhất")
    ticket = engine.get(lamp).ticket
    assert (ticket.status, ticket.blocker.code) == ("ON_HOLD", "WAITING_EMERGENCY")  # the second is still open
    assert not [
        e for e in engine.get(lamp).events if e.from_status == "ON_HOLD"
    ]  # it was never released and held again
    engine.emergency_close(second, BQL, note="Đã xử lý điểm thứ hai")
    assert engine.get(lamp).ticket.status == TicketStatus.ROUTED


def test_e07_cancelling_the_emergency_releases_the_waiting_ticket(engine, clock):
    hold_on(engine)
    smoke, lamp = emergency_then_lamp(engine, clock)
    assert engine.get(lamp).ticket.status == TicketStatus.ON_HOLD
    engine.cancel(smoke, BQL, cancel_reason="Cư dân báo nhầm")
    assert engine.get(smoke).ticket.status == TicketStatus.CANCELLED
    ticket = engine.get(lamp).ticket
    assert (ticket.status, ticket.blocker) == ("ROUTED", None)


def test_e08_the_fixtures_with_the_switch_off_still_pass_12_of_12(engine):
    report_ = evaluate(engine)
    failed = {r.ticket_id: r.mismatches for r in report_.results if not r.passed}
    assert (report_.total, report_.passed, failed) == (12, 12, {})
    # SIM-TKT-TEC-006 left the car park (plan 14: it needs an asset); a new report there stands next to CLN-004
    rubbish = report(engine, "Tầng hầm B1 tòa S1 nhiều rác, cần dọn.")
    assert engine.get(rubbish).ticket.status == TicketStatus.ROUTED  # still ROUTED next to the open emergency
    assert linked(engine, rubbish, "SIM-TKT-CLN-004")  # but linked both ways
