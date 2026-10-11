"""Plan 06 WP19 - SPEC-P10: the engine checks the Agent against the catalog, never against the resident's wording.

A quote is for display and audit only (Q35). Mechanism tests use fake clients that return a fixed JSON (never the
`MirrorClient` for the Agent branch, SPEC-P10 section 6 BẮT BUỘC 6); the rules do not see the danger or the place in
the sentences used here, so a pass cannot come from the rules.
"""

import copy
import importlib.util
import json
import sys
from pathlib import Path

import pytest

from src.maintenance import safety
from src.maintenance.agent import prompt, validate
from src.maintenance.agent.baseline import mirror_decision, rule_view
from src.maintenance.agent.client import ClientReply, MirrorClient
from src.maintenance.agent.inputs import DecisionInput
from src.maintenance.agent.schema import AgentDecision
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.enums import RiskLevel, SignalStatus
from src.maintenance.models import LockedFields
from tests.test_maintenance.helpers import CLEANING, MONDAY_9AM, RESIDENT, Clock, agent_engine

CATALOG, LEXICON = load_catalog(), load_lexicon()
T1 = "Chỗ đi bộ trước thang máy tầng 3 tòa S1 có nhiều rác"
T3 = "Hành lang tầng 3 tòa S1 nhiều rác"
T5 = "Hành lang tầng 3 tòa S1 nhiều rác, nghe tiếng xì xì từ bình gas"
FULL = {"building": "S1", "floor": "3", "area": "Hành lang"}
VS = dict(copy.deepcopy(prompt.EXAMPLE["jobs"][0]), quote="nhiều rác")
MISSING = object()


def reply(jobs, location=None, safety_part=None) -> str:
    doc = copy.deepcopy(prompt.EXAMPLE)
    doc.update(jobs=jobs, scope="IN_SCOPE")
    if location is not None:
        doc["location"] = location
    if safety_part is not None:
        doc["safety"] = safety_part
    return json.dumps(doc, ensure_ascii=False)


def receive(text, answer):
    engine = agent_engine(Clock(MONDAY_9AM), lambda system, user, data: ClientReply(text=answer, latency_ms=0.0))
    return engine.get(engine.receive(text, resident_id=RESIDENT).ticket.ticket_id)


def data_for(text) -> DecisionInput:
    return DecisionInput(
        ticket_id="SIM-TKT-0001",
        created_at=MONDAY_9AM.isoformat(),
        report_text=text,
        location_text=text,
        safety_text=text,
        locks=LockedFields(),
        pinned_category=None,
        follow_up_of=None,
        duplicate_candidates=[],
        asset_candidates=[],
        fingerprint="f",
        safety_fingerprint="s",
    )


def test_p10_01_location_worded_differently_but_in_the_catalog_is_kept():
    case = receive(T1, reply([VS], {**FULL, "quote": "hành lang tầng 3 tòa S1"}))
    rec, ticket = case.agent_decision, case.ticket
    assert rec.rejected == [] and rec.agent_location == "Tòa S1 / Tầng 3 / Hành lang"
    assert [(d.field, d.severity) for d in rec.disagreements] == [("location", "MINOR")]
    assert "AGENT_FALLBACK" not in ticket.flags
    assert (ticket.status, ticket.department_id) == ("ROUTED", "DEPT_CLEANING")


@pytest.mark.parametrize(
    ("part", "value", "path"),
    [
        ("building", "S9", "location.building"),
        ("floor", "tầng cao", "location.floor"),
        ("area", "Ban công", "location.area"),
    ],
)
def test_p10_02_a_value_outside_the_catalog_is_rejected_on_its_own_field(part, value, path):
    case = receive(T1, reply([VS], {**FULL, part: value, "quote": "tầng 3 tòa S1"}))
    rec = case.agent_decision
    assert rec.rejected == [path] and rec.agent_missing_parts == [part]
    if part == "building":
        t = case.ticket
        assert (t.status, t.blocker.code) == ("NEED_INFO", "MISSING_INFO")
        assert t.blocker.internal_note == "Thiếu: location_building"


@pytest.mark.parametrize(
    ("where", "value"),
    [("location", None), ("location", ""), ("location", "   "), ("job", None), ("job", ""), ("job", MISSING)],
)
def test_p10_03_a_blank_or_missing_quote_is_still_accepted(where, value):
    if where == "location":
        case = receive(T1, reply([VS], {**FULL, "quote": value}))
        assert case.agent_decision.rejected == []
        assert case.agent_decision.agent_location == "Tòa S1 / Tầng 3 / Hành lang"
    else:
        job = {k: v for k, v in VS.items() if k != "quote"} if value is MISSING else dict(VS, quote=value)
        case = receive(T3, reply([job]))
        rec = case.agent_decision
        assert rec.source == "AGENT" and rec.valid_job_indexes == [0] and rec.decision.jobs[0].quote is None
        assert "AGENT_FALLBACK" not in case.ticket.flags
    assert case.ticket.status == "ROUTED"


@pytest.mark.parametrize("text", [T1, CLEANING, "Hình như có mùi khét ở hành lang tầng 3 tòa S1"])
def test_p10_04_mirror_writes_no_quote_of_its_own(text):
    data = data_for(text)
    decision = mirror_decision(data, CATALOG, LEXICON)
    assert all(j.quote is None for j in decision.jobs) and decision.location.quote is None
    rule = rule_view(data, CATALOG, LEXICON).safety.signals
    want = {
        (s.signal_id, s.source_quote.strip()[:300])
        for s in rule
        if s.status in (SignalStatus.PRESENT, SignalStatus.UNCLEAR)
    }
    assert {(s.signal_id, s.quote) for s in decision.safety.signals} == want


@pytest.mark.parametrize("quote", ["bình gas bị xì", None])
def test_p10_05_an_agent_raise_is_kept_whatever_its_quote(quote):
    assert rule_view(data_for(T5), CATALOG, LEXICON).safety.risk_level == RiskLevel.NONE  # the rules miss it
    gas = {
        "risk_level": "EMERGENCY",
        "reason": "Tiếng xì từ bình gas",
        "signals": [{"signal_id": "S-10", "status": "PRESENT", "quote": quote}],
    }
    case = receive(T5, reply([VS], safety_part=gas))
    t = case.ticket
    assert (t.status, t.blocker.code, t.risk_level) == ("VERIFYING", "EMERGENCY_PENDING_BQL", "EMERGENCY")
    assert [n.type for n in case.notifications].count("emergency.created") == 1
    want = ("S-10", "PRESENT", "LLM", quote) if quote else ("S-10", "PRESENT", "LLM-NOQUOTE", T5)
    assert want in {(s.signal_id, s.status.value, s.rule_id, s.source_quote) for s in t.risk_signals}


def test_p10_09_a_location_quote_sharing_no_word_with_the_text_is_kept():
    case = receive(T1, reply([VS], {**FULL, "quote": "the walkway by the lift"}))
    assert case.agent_decision.rejected == [] and case.agent_decision.agent_location == "Tòa S1 / Tầng 3 / Hành lang"
    assert case.ticket.status == "ROUTED"


def test_p10_10_a_job_quote_sharing_no_word_with_the_text_is_kept():
    case = receive(T3, reply([dict(VS, quote="rubbish everywhere")]))
    assert case.agent_decision.valid_job_indexes == [0] and case.agent_decision.rejected == []
    assert case.ticket.status == "ROUTED"


def test_p10_11_merge_llm_output_does_not_depend_on_the_wording_of_the_quote():
    rule = safety.assess(T5, LEXICON.safety)

    def merged(quote):
        judged = safety.LLMSafetyAssessment(
            judgements=[safety.SignalJudgement(signal_id="S-10", status="PRESENT", quote=quote)]
        )
        result = safety.merge_llm(rule, judged, T5, LEXICON.safety)
        return result.risk_level, result.notes, [(s.signal_id, s.status, s.rule_id) for s in result.signals]

    assert merged("tiếng xì xì từ bình gas") == merged("gas leak") == merged("bình gas bị xì")


def test_p10_06_no_text_matching_helper_is_left():
    assert not hasattr(validate, "grounded") and not hasattr(validate, "_fold")
    assert not hasattr(safety, "_grounded")


def test_p10_07_runtime_schema_is_the_reference_schema():
    root = Path(__file__).resolve().parents[2]
    path = root / "planning" / "06_2026-10-05_reasoning-agent" / "specs" / "REF-agent-contract.py"
    spec = importlib.util.spec_from_file_location("ref_agent_contract", path)
    ref = importlib.util.module_from_spec(spec)
    sys.modules["ref_agent_contract"] = ref
    spec.loader.exec_module(ref)
    assert AgentDecision.model_json_schema() == ref.AgentDecision.model_json_schema()


def test_p10_08_a_missing_job_quote_is_not_shown_as_none():
    engine = agent_engine(Clock(MONDAY_9AM), MirrorClient(CATALOG, LEXICON))
    engine._try_split = lambda work, now: False
    note = engine.get(
        engine.receive(prompt.EXAMPLE_REPORT, resident_id=RESIDENT).ticket.ticket_id
    ).ticket.blocker.internal_note
    assert "Agent thấy hai việc: VE_SINH; KY_THUAT" in note and "None" not in note
