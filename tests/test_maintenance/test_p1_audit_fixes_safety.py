"""Plan 06 WP14 (SPEC-P08 §1–§3): fixes after the adversarial review R12.

F1: a resident's addition while the ticket waits for its location always reruns 2b (rules and Agent paths).
F3: replaced by SPEC-P10 (plan 06 Q35): an Agent location is checked against the catalog, not by its quote.
F10: a role the CR §3 row does not name gets 403 + ACTION_DENIED, not 409.
"""

import pytest

from src.maintenance.agent.client import ClientReply, MirrorClient
from src.maintenance.agent.schema import LocationDecision
from src.maintenance.agent.validate import _check_location
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.errors import ActionDeniedError, InvalidTransitionError
from src.maintenance.safety import assess
from tests.test_maintenance.helpers import BPTN, BQL, CLEANING, RESIDENT, SYSTEM, agent_engine, decision

CATALOG = load_catalog()
LEXICON = load_lexicon()


@pytest.fixture(params=["rules", "agent"])
def any_engine(request, fresh, clock) -> MaintenanceEngine:
    """The same engine API with the rules alone and with the Agent (Mirror client, decides like the rules)."""
    return fresh if request.param == "rules" else agent_engine(clock, MirrorClient(CATALOG, LEXICON))


def denied_count(engine: MaintenanceEngine, ticket_id: str) -> int:
    return sum(1 for a in engine.get(ticket_id).audit if a.action_result == "ACTION_DENIED")


def emergencies(engine: MaintenanceEngine, ticket_id: str) -> int:
    return [n.type for n in engine.get(ticket_id).notifications].count("emergency.created")


# ---------------------------------------------------------------------------------------------- F1 (SPEC-P08 §1)

# Tier-1 dangers a resident adds while the place is still incomplete: (first report, addition)
F1_CASES = [
    ("Đèn hành lang không sáng", "Có mùi gas nồng nặc, sợ quá"),
    ("Đèn hành lang không sáng", "Có khói bốc ra từ hộp điện"),
    ("Đèn hành lang không sáng", "Hộp đèn đang cháy, có lửa!"),
    ("Đèn hành lang không sáng", "Có người bị điện giật ngất ở đây"),
    ("Đèn hành lang không sáng", "Ở tầng 3, có mùi khét và tia lửa"),  # floor given, building still missing
    ("Hành lang nhiều rác", "Có kim tiêm vứt bừa ở đó"),
]


@pytest.mark.parametrize(("report", "addition"), F1_CASES, ids=[c[1] for c in F1_CASES])
def test_f1_addition_with_danger_reruns_2b(any_engine, report, addition):
    tid = any_engine.receive(report, resident_id=RESIDENT).ticket.ticket_id
    before = any_engine.get(tid).ticket
    assert (before.status, before.blocker.code, before.risk_level) == ("NEED_INFO", "MISSING_INFO", "NONE")

    after = any_engine.add_resident_info(tid, RESIDENT, addition).ticket

    assert (after.status, after.blocker.code, after.risk_level) == ("VERIFYING", "EMERGENCY_PENDING_BQL", "EMERGENCY")
    assert emergencies(any_engine, tid) == 1


class SeesDanger:
    """A fake model that names a grounded tier-1 signal once `danger` is in the safety text, and nothing before."""

    def __init__(self, danger: str):
        self.danger = danger

    def __call__(self, system, user, data) -> ClientReply:
        seen = self.danger in data.safety_text
        signals = [{"signal_id": "S-00", "status": "PRESENT", "quote": self.danger}] if seen else []
        reply = decision(
            **{
                "safety.risk_level": "EMERGENCY" if seen else "NONE",
                "safety.signals": signals,
                "location": {"building": None, "floor": None, "area": None, "quote": None},
                "scope": "UNCLEAR",
                "jobs": [],
                "next_step": "ASK_RESIDENT",
                "ask_fields": ["location"],
            }
        )
        return ClientReply(text=reply, latency_ms=0.0)


@pytest.mark.parametrize("danger", ["Cháu bé trèo ra ngoài lan can", "Nước ngập lên tới ổ cắm điện"])
def test_f1_addition_reruns_2b_with_the_agent_signals(clock, danger):
    """SPEC-P08 §1: the rerun uses the same 2b as the pipeline, so a grounded signal only the Agent saw raises it."""
    report = "Đèn hành lang không sáng"
    assert assess(f"{report}. {danger}", LEXICON.safety).risk_level == "NONE"  # the rules alone see nothing
    engine = agent_engine(clock, SeesDanger(danger))
    tid = engine.receive(report, resident_id=RESIDENT).ticket.ticket_id
    assert (engine.get(tid).ticket.status, engine.get(tid).ticket.risk_level) == ("NEED_INFO", "NONE")

    after = engine.add_resident_info(tid, RESIDENT, danger).ticket

    assert (after.status, after.blocker.code, after.risk_level) == ("VERIFYING", "EMERGENCY_PENDING_BQL", "EMERGENCY")
    assert emergencies(engine, tid) == 1


def test_f1_t06_answer_with_fire_becomes_emergency(any_engine):
    """CR §6.4 T06: BPTN asked for safety details; the answer is a tier-1 danger while the place is still vague."""
    tid = any_engine.receive("Hình như có mùi khét ở hành lang", resident_id=RESIDENT).ticket.ticket_id
    assert any_engine.get(tid).ticket.blocker.code == "SAFETY_REVIEW_REQUIRED"
    any_engine.safety_request_info(tid, BPTN, note="Mô tả rõ hơn giúp")
    assert any_engine.get(tid).ticket.status == "NEED_INFO"

    after = any_engine.add_resident_info(tid, RESIDENT, "Giờ có lửa bốc lên rồi!").ticket

    assert (after.status, after.blocker.code, after.risk_level) == ("VERIFYING", "EMERGENCY_PENDING_BQL", "EMERGENCY")
    assert emergencies(any_engine, tid) == 1


def test_f1_harmless_addition_keeps_waiting_for_the_location(any_engine, clock):
    tid = any_engine.receive("Đèn hành lang không sáng", resident_id=RESIDENT).ticket.ticket_id

    after = any_engine.add_resident_info(tid, RESIDENT, "Ở tầng 3 ạ").ticket
    assert (after.status, after.blocker.code) == ("NEED_INFO", "MISSING_INFO")
    any_engine.run_jobs(after.blocker.next_retry_at)  # the job retry is due: the tick path runs `_resume` too

    ticket = any_engine.get(tid).ticket
    assert ticket.blocker.auto_retry_count == after.blocker.auto_retry_count + 1
    assert (ticket.status, ticket.blocker.code, ticket.risk_level) == ("NEED_INFO", "MISSING_INFO", "NONE")
    assert emergencies(any_engine, tid) == 0


# ---------------------------------------------------------------------------------------------- F3 (SPEC-P08 §2)


@pytest.mark.parametrize(
    ("parts", "expected"),
    [
        ({"building": "S1", "floor": "1", "area": "Hành lang"}, ("Tòa S1 / Tầng 1 / Hành lang", (), [])),
        ({"building": "S1"}, (None, ("floor", "area"), [])),
        ({"area": "Hành lang"}, (None, ("building", "floor"), [])),
    ],
)
@pytest.mark.parametrize("quote", [None, "..", "--", "! "])  # whatever the quote, only the catalog decides
def test_p10_location_is_kept_whatever_its_quote(parts, expected, quote):
    loc = LocationDecision(**parts, quote=quote, reason="test")
    assert _check_location(loc, CATALOG) == expected


def test_p10_an_invented_place_in_the_catalog_is_kept_and_audited(clock):
    def invented(system, user, data):
        return ClientReply(
            text=decision(**{"location.building": "S2", "location.floor": "7", "location.quote": ".."}), latency_ms=0.0
        )

    engine = agent_engine(clock, invented)
    case = engine.receive("Hành lang nhiều rác, đèn cũng không sáng", resident_id=RESIDENT)
    record = case.agent_decision
    # plan 14: the example asset belongs to the AREA (Hành lang), not to a floor, so S2/7 rejects nothing
    assert record.rejected == []
    assert record.agent_location == "Tòa S2 / Tầng 7 / Hành lang"
    assert record.decision.location.quote == ".."  # risk accepted on purpose (SPEC-P10 section 5)


def test_f3_no_location_and_no_quote_is_not_a_rejection():
    loc = LocationDecision(quote=None, reason="test")
    assert _check_location(loc, CATALOG)[2] == []


def test_p10_mirror_location_has_no_quote_and_is_kept(clock):
    """The Mirror Agent (rules as a decision) writes no quote of its own; its location is kept all the same."""
    engine = agent_engine(clock, MirrorClient(CATALOG, LEXICON))
    tid = engine.receive(CLEANING, resident_id=RESIDENT).ticket.ticket_id
    record = engine.get(tid).agent_decision
    assert record.source == "AGENT" and "location" not in record.rejected
    assert record.decision.location.quote is None
    assert record.agent_location == "Tòa S1 / Tầng 3 / Hành lang"


# --------------------------------------------------------------------------------------------- F10 (SPEC-P08 §3)


def routed(engine: MaintenanceEngine) -> str:
    tid = engine.receive(CLEANING, resident_id=RESIDENT).ticket.ticket_id
    assert engine.get(tid).ticket.status == "ROUTED"
    return tid


def test_f10_role_not_named_on_the_row_gets_403_and_audit(fresh):
    """BQL may reach IN_PROGRESS (T17, rework) but ROUTED → IN_PROGRESS names only the department."""
    tid = routed(fresh)
    denied = denied_count(fresh, tid)
    with pytest.raises(ActionDeniedError) as err:
        fresh.transition(tid, "IN_PROGRESS", BQL)
    assert "không được duyệt bước từ ROUTED sang IN_PROGRESS" in str(err.value)
    assert fresh.get(tid).ticket.status == "ROUTED"
    assert denied_count(fresh, tid) == denied + 1


def test_f10_wrong_state_or_pinned_source_stays_409(fresh):
    tid = routed(fresh)
    denied = denied_count(fresh, tid)
    with pytest.raises(InvalidTransitionError):
        fresh.transition(tid, "CLOSED", BQL, note="x")  # BQL may close, but not from ROUTED: no such row
    with pytest.raises(InvalidTransitionError):
        fresh.transition(tid, "IN_PROGRESS", "SIM-ACTOR-DEPT-CLN-01", expected_from="ON_HOLD")
    assert fresh.get(tid).ticket.status == "ROUTED"
    assert denied_count(fresh, tid) == denied


def test_f10_system_cannot_undo_a_merge_from_outside(fresh, clock):
    """SYSTEM is a T09 actor only for a cancelled root; through `undo_merge` it is a role without authority."""
    fresh.receive("Hành lang tầng 3 tòa S1 nhiều rác", resident_id=RESIDENT)
    clock.advance(minutes=1)
    tid = fresh.receive("Hành lang tầng 3 tòa S1 nhiều rác quá", resident_id=RESIDENT).ticket.ticket_id
    fresh.bptn_resolve(tid, BPTN, merge=True, note="trùng")
    assert fresh.get(tid).ticket.status == "MERGED"
    denied = denied_count(fresh, tid)

    with pytest.raises(ActionDeniedError):
        fresh.undo_merge(tid, SYSTEM, note="gộp nhầm")

    ticket = fresh.get(tid).ticket
    assert ticket.status == "MERGED" and ticket.merged_into is not None
    assert denied_count(fresh, tid) == denied + 1
    assert fresh.undo_merge(tid, BPTN, note="gộp nhầm").ticket.status != "MERGED"  # the named role still can
