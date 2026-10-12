"""P1 safety floor (plan 06 SPEC-P03, WP2): tier-1 signals S-06, S-07, S-08, S-10, S-11, S-12, S-13 as lexicon data.

Gates C4 (labelled P1 sentences + engine cases, SPEC-P03 §3.1 and §7) and C6 (the classification corpus changes level
only through S-11 on a falling lamp or S-08 water in electrics, SPEC-P03 §6 / plan Q22). The sentences live in data/safety_cases_p1.yaml; the first 68 are the
architect's REF lists copied verbatim.
"""

from pathlib import Path

import pytest
import yaml

from src.maintenance.catalog import load_lexicon
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import RiskLevel, SignalStatus
from src.maintenance.safety import assess
from tests.test_maintenance import test_classify_metamorphic as cm
from tests.test_maintenance.helpers import report

DATA = yaml.safe_load((Path(__file__).parent / "data" / "safety_cases_p1.yaml").read_text(encoding="utf-8"))
MUST_CATCH = DATA["must_catch"]
MUST_NOT_RAISE = DATA["must_not_raise"]
LEXICON = load_lexicon()
LEX = LEXICON.safety
P0_LEX = LEX.model_copy(update={"active_phases": ("P0",)})  # the same vocabulary with P1 switched off
P1_SIGNALS = ("S-06", "S-07", "S-08", "S-10", "S-11", "S-12", "S-13")
LAMP_FALL_WORDS = ("rơi", "rớt", "roi", "rot")
LAMP_NOUNS = ("đèn", "den", "bóng", "bong", "tuýp", "tuyp")


def accepted(case) -> list[str]:
    return case.get("expect_any") or [case["expect"]]


def quotes_verbatim(result, text) -> bool:
    return all(part in text for s in result.signals for part in s.source_quote.split(" | "))


# ---------------------------------------------------------------- the data file itself


def test_p1_cases_file_shape_and_coverage():
    """§3.1: at least the 68 REF sentences; per P1 signal >= 6 EMERGENCY catches, >= 1 unaccented, >= 1 negation."""
    ids = [c["id"] for c in MUST_CATCH + MUST_NOT_RAISE]
    assert len(ids) == len(set(ids)) and len(MUST_CATCH) >= 47 and len(MUST_NOT_RAISE) >= 21
    for signal_id in P1_SIGNALS:
        caught = [c for c in MUST_CATCH if signal_id in c.get("signals", []) and c.get("expect") == "EMERGENCY"]
        assert len(caught) >= 6, (signal_id, len(caught))
        assert any(c["text"].isascii() for c in caught), signal_id
        assert any(c.get("negates") == signal_id and c["expect"] == "NONE" for c in MUST_CATCH), signal_id


def test_p1_phase_is_active():
    """§2: the shipped lexicon runs P0 and P1 (switching P1 off is a data change: I-29)."""
    assert LEX.active_phases == ("P0", "P1")
    assert {s.signal_id for s in LEX.signals if s.phase == "P1" and s.tier == 1} >= set(P1_SIGNALS)


def test_p1_s00_is_the_only_agent_signal():
    """§2 / 01 §4.2 (Q11): exactly one agent-only signal, S-00, tier 1, phase P1, without patterns; rules never write it."""
    agent_only = [s for s in LEX.signals if s.agent_only]
    assert [(s.signal_id, s.tier, s.phase, s.patterns) for s in agent_only] == [("S-00", 1, "P1", ())]
    assert all(s.signal_id != "S-00" for c in MUST_CATCH + MUST_NOT_RAISE for s in assess(c["text"], LEX).signals)


# ---------------------------------------------------------------- C4: labelled P1 sentences


@pytest.mark.parametrize("case", MUST_CATCH, ids=[c["id"] for c in MUST_CATCH])
def test_p1_must_catch(case):
    """§3.1: level as labelled; the named signal recorded (PRESENT or UNCLEAR); a negated signal is not raised."""
    result = assess(case["text"], LEX)
    assert result.risk_level in accepted(case), (result.risk_level, [(s.signal_id, s.status) for s in result.signals])
    seen = {s.signal_id for s in result.signals if s.status != SignalStatus.ABSENT}
    assert set(case.get("signals", [])) <= seen, seen
    if "negates" in case:
        assert case["negates"] not in seen
    assert quotes_verbatim(result, case["text"])


@pytest.mark.parametrize("case", MUST_NOT_RAISE, ids=[c["id"] for c in MUST_NOT_RAISE])
def test_p1_must_not_raise(case):
    """§3: words that collide with a P1 signal (mau/màu, rồi/rơi, gà/gas, đồ/đổ, nóng trời) keep their level."""
    result = assess(case["text"], LEX)
    assert result.risk_level in accepted(case), (result.risk_level, [(s.signal_id, s.status) for s in result.signals])
    assert quotes_verbatim(result, case["text"])


# ---------------------------------------------------------------- C6: the classification corpus


def test_p1_corpus_changes_only_through_a_falling_lamp_or_water_in_electrics():
    """C6 (plan 06 Q22): every corpus text (and its 18 x 2 location variants) whose level differs from the P0-only
    lexicon carries S-11 PRESENT and a lamp noun plus rơi/rớt, or S-08 PRESENT (water reaching electrical equipment)."""
    changed, bad = 0, []
    for sentence, _kind in cm.CORPUS:
        for text, _loc in [(sentence, None)] + cm.variants(sentence):
            before, after = assess(text, P0_LEX).risk_level, assess(text, LEX)
            if after.risk_level == before:
                continue
            changed += 1
            low = text.lower()
            lamp_fall = any(w in low for w in LAMP_NOUNS) and any(w in low for w in LAMP_FALL_WORDS)
            s11 = any(s.signal_id == "S-11" and s.status == SignalStatus.PRESENT for s in after.signals)
            s08 = any(s.signal_id == "S-08" and s.status == SignalStatus.PRESENT for s in after.signals)
            if not ((lamp_fall and s11) or s08):
                bad.append(f"{before}->{after.risk_level} | {text}")
    print(f"corpus texts changed by P1: {changed}, neither a falling lamp nor water in electrics: {len(bad)}")
    assert not bad, "\n".join(bad[:40])


# ---------------------------------------------------------------- §7: engine cases


def test_p1_ac02_gas_without_location_is_an_emergency(fresh):
    """AC-02: 'Có mùi gas' (out of scope, no location) stops at BQL with no draft or department; S-10 is notified."""
    case = fresh.get(report(fresh, "Có mùi gas"))
    ticket = case.ticket
    assert (ticket.status, ticket.blocker.code) == ("VERIFYING", "EMERGENCY_PENDING_BQL")
    assert case.draft is None and ticket.department_id is None
    created = [n for n in case.notifications if n.type == "emergency.created"]
    assert created and "S-10" in created[0].payload["signal_ids"]


@pytest.mark.parametrize(
    "text,signal_id",
    [
        ("Có kim tiêm vứt bừa ở cầu thang bộ tầng 4 tòa S1", "S-13"),
        ("Nước tràn vào tủ điện ở hầm B1 tòa S1", "S-08"),
        ("Đèn hành lang tầng 3 tòa S1 nóng ran, chạm vào bỏng tay", "S-07"),
    ],
)
def test_p1_engine_emergencies(fresh, text, signal_id):
    """§7: P1 tier-1 reports stop in VERIFYING / EMERGENCY_PENDING_BQL (before P1 the water one stopped OUT_OF_SCOPE)."""
    ticket = fresh.get(report(fresh, text)).ticket
    assert (ticket.status, ticket.blocker.code, ticket.risk_level) == (
        "VERIFYING",
        "EMERGENCY_PENDING_BQL",
        RiskLevel.EMERGENCY,
    )
    assert signal_id in {s.signal_id for s in ticket.risk_signals if s.status == SignalStatus.PRESENT}


@pytest.mark.parametrize("case_id", ["P1-FP-01", "P1-FP-03", "P1-FP-06", "P1-FP-11"])
def test_p1_engine_ordinary_reports_route_as_before(clock, case_id):
    """§7: ordinary reports holding a colliding word end exactly as with P1 switched off (measured on base 76d05af:
    FP-01 and FP-11 are ROUTED; FP-03 stops at ASSET_UNCLEAR and FP-06 at OUT_OF_SCOPE already without P1)."""
    text = next(c["text"] for c in MUST_NOT_RAISE if c["id"] == case_id)
    outcomes = []
    for lexicon in (LEXICON, LEXICON.model_copy(update={"safety": P0_LEX})):
        engine = MaintenanceEngine(clock=clock, lexicon=lexicon)
        engine.reset(with_fixtures=False)
        ticket = engine.get(report(engine, text)).ticket
        outcomes.append((ticket.status, ticket.blocker.code if ticket.blocker else None, ticket.department_id))
    assert outcomes[0] == outcomes[1], outcomes
    assert outcomes[0][1] not in ("EMERGENCY_PENDING_BQL", "SAFETY_REVIEW_REQUIRED"), outcomes
