"""H19 probes (b) (c) (e) + the two changed assertions. Fake clients only, no network, no LLM.

Run from a copy of the working tree: PYTHONPATH=. LLM_MODE=mock MO_STORE=memory PYTHONUTF8=1 python probe_bce.py
Each line: PROBE <id> <case> -> <measured> => OK|BREAK
"""

import copy
import json

from src.maintenance.agent import prompt
from src.maintenance.agent.baseline import rule_view
from src.maintenance.agent.client import ClientReply
from src.maintenance.agent.inputs import DecisionInput
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import Action
from src.maintenance.models import LockedFields
from src.maintenance.safety import LLMSafetyAssessment, SignalJudgement, assess
from tests.test_maintenance.helpers import MONDAY_9AM, RESIDENT, Clock, agent_engine, decision

CATALOG, LEXICON = load_catalog(), load_lexicon()
VS = dict(copy.deepcopy(prompt.EXAMPLE["jobs"][0]), quote="nhiều rác")
BREAKS = 0


def check(pid, case, measured, ok):
    global BREAKS
    BREAKS += 0 if ok else 1
    print(f"PROBE {pid} {case} -> {measured} => {'OK' if ok else 'BREAK'}")


def reply(jobs, location=None, safety_part=None, **extra) -> str:
    doc = copy.deepcopy(prompt.EXAMPLE)
    doc.update(jobs=jobs, scope="IN_SCOPE", **extra)
    if location is not None:
        doc["location"] = location
    if safety_part is not None:
        doc["safety"] = safety_part
    return json.dumps(doc, ensure_ascii=False)


def fixed(answer):
    return lambda system, user, data: ClientReply(text=answer, latency_ms=0.0)


def receive(text, answer):
    engine = agent_engine(Clock(MONDAY_9AM), fixed(answer))
    return engine, engine.get(engine.receive(text, resident_id=RESIDENT).ticket.ticket_id)


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


# --------------------------------------------------------------------------------- (b) Agent raise through the engine
T5 = "Hành lang tầng 3 tòa S1 nhiều rác, nghe tiếng xì xì từ bình gas"
check("b0", "rules alone on T5", rule_view(data_for(T5), CATALOG, LEXICON).safety.risk_level.value, True)
quotes = {
    "verbatim": "nghe tiếng xì xì từ bình gas",
    "reworded": "bình gas bị xì",
    "unrelated": "trời hôm nay rất đẹp",
    "punct": "..",
    "one-char": "x",
    "blank": "   ",
    "empty": "",
    "null": None,
    "400-chars": "gas " * 100,
}
for name, q in quotes.items():
    gas = {"risk_level": "EMERGENCY", "reason": "gas", "signals": [{"signal_id": "S-10", "status": "PRESENT", "quote": q}]}
    _, case = receive(T5, reply([VS], safety_part=gas))
    t = case.ticket
    n = [x.type for x in case.notifications].count("emergency.created")
    sig = [(s.signal_id, s.status.value, s.rule_id) for s in t.risk_signals if s.detected_by.value == "LLM"]
    got = (t.status, t.blocker.code if t.blocker else None, t.risk_level, n)
    check("b1", f"S-10 PRESENT quote={name}", f"{got} llm={sig}", got == ("VERIFYING", "EMERGENCY_PENDING_BQL", "EMERGENCY", 1))
# Tier-1 UNCLEAR with an unrelated quote -> tier 2 review (raise to UNCLEAR, not dropped)
gas = {"risk_level": "UNCLEAR", "reason": "gas?", "signals": [{"signal_id": "S-10", "status": "UNCLEAR", "quote": "zzz"}]}
_, case = receive(T5, reply([VS], safety_part=gas))
t = case.ticket
check("b2", "S-10 UNCLEAR unrelated quote", (t.status, t.blocker.code, t.risk_level), (t.blocker.code, t.risk_level) == ("SAFETY_REVIEW_REQUIRED", "UNCLEAR"))

# resident addition path (_addition_raises_safety / rerun of 2b) with a non-verbatim quote
class SeesGas:
    def __init__(self, quote):
        self.quote = quote

    def __call__(self, system, user, data):
        seen = "gas" in data.safety_text
        signals = [{"signal_id": "S-10", "status": "PRESENT", "quote": self.quote}] if seen else []
        return ClientReply(
            text=decision(
                **{
                    "safety.risk_level": "EMERGENCY" if seen else "NONE",
                    "safety.signals": signals,
                    "location": {"building": None, "floor": None, "area": None, "quote": None},
                    "scope": "UNCLEAR",
                    "jobs": [],
                    "next_step": "ASK_RESIDENT",
                    "ask_fields": ["location"],
                }
            ),
            latency_ms=0.0,
        )


for name, q in {"reworded": "bình ga đang rò", "null": None, "punct": "--"}.items():
    engine = agent_engine(Clock(MONDAY_9AM), SeesGas(q))
    tid = engine.receive("Đèn hành lang không sáng", resident_id=RESIDENT).ticket.ticket_id
    before = engine.get(tid).ticket
    add = "nghe tiếng xì xì từ bình gas"
    assert assess(f"Đèn hành lang không sáng. {add}", LEXICON.safety).risk_level.value == "NONE"
    after = engine.add_resident_info(tid, RESIDENT, add).ticket
    n = [x.type for x in engine.get(tid).notifications].count("emergency.created")
    got = (before.status, after.status, after.blocker.code, after.risk_level, n)
    check("b3", f"addition path quote={name}", got, got[1:] == ("VERIFYING", "EMERGENCY_PENDING_BQL", "EMERGENCY", 1))

# --------------------------------------------------------------------------------- (c) can the AI lower or erase now?
HEDGE = "Hình như có mùi khét ở hành lang tầng 3 tòa S1"
rv = rule_view(data_for(HEDGE), CATALOG, LEXICON).safety
rule_sigs = {(s.signal_id, s.status.value, s.rule_id) for s in rv.signals}
lowering_safety = {
    "risk_level": "NONE",
    "reason": "không sao",
    "signals": [
        {"signal_id": s.signal_id, "status": "ABSENT", "quote": "không có gì"} for s in rv.signals
    ]
    + [{"signal_id": s.signal_id, "status": "UNCLEAR", "quote": "x" * 299} for s in rv.signals],
}
_, case = receive(HEDGE, reply([VS], location={"building": "S1", "floor": "3", "area": "Hành lang", "quote": None}, safety_part=lowering_safety))
t = case.ticket
kept = {(s.signal_id, s.status.value, s.rule_id) for s in t.risk_signals}
check("c1", f"rule={rv.risk_level.value} sigs={sorted(rule_sigs)}; Agent ABSENT+UNCLEAR long quote", (t.risk_level, t.blocker.code if t.blocker else None, sorted(kept)), t.risk_level == "UNCLEAR" and rule_sigs <= kept)

# Agent claims NONE with no signals while rules say UNCLEAR
_, case = receive(HEDGE, reply([VS], safety_part={"risk_level": "NONE", "reason": "ok", "signals": []}))
t = case.ticket
check("c2", "rules UNCLEAR, Agent NONE no signals", (t.risk_level, t.blocker.code if t.blocker else None), t.risk_level == "UNCLEAR")

# merge_llm unit: same sid, rule PRESENT, LLM UNCLEAR/ABSENT/PRESENT longer quote -> rule record unchanged
TXT = "Có khói bốc ra từ hộp điện hành lang tầng 3 tòa S1"
rule = assess(TXT, LEXICON.safety)
from src.maintenance.safety import merge_llm  # noqa: E402

for sid in {s.signal_id for s in rule.signals}:
    for status in ("UNCLEAR", "ABSENT", "PRESENT"):
        merged = merge_llm(rule, LLMSafetyAssessment(judgements=[SignalJudgement(signal_id=sid, status=status, quote="q" * 250)]), TXT, LEXICON.safety)
        ok = set(rule.signals) <= set(merged.signals) and merged.risk_level == rule.risk_level
        check("c3", f"rule {sid} {rule.risk_level.value}; LLM {status} long quote", (merged.risk_level.value, len(merged.signals)), ok)

# rule EMERGENCY: Agent not consulted (P08 / _after_rules), an Agent that would say NONE cannot lower it
calls = []


def spy(system, user, data):
    calls.append(1)
    return ClientReply(text=reply([VS], safety_part={"risk_level": "NONE", "reason": "ok", "signals": []}), latency_ms=0.0)


engine = agent_engine(Clock(MONDAY_9AM), spy)
t = engine.get(engine.receive(TXT, resident_id=RESIDENT).ticket.ticket_id).ticket
check("c4", "rules EMERGENCY + Agent NONE", (t.risk_level, t.blocker.code, len(calls)), t.risk_level == "EMERGENCY" and t.blocker.code == "EMERGENCY_PENDING_BQL")

# --------------------------------------------------------------------------------- (e) location: wording vs catalog
T1 = "Chỗ đi bộ trước thang máy tầng 3 tòa S1 có nhiều rác"
for name, loc, want in [
    ("lowercase/prefixed", {"building": "tòa s1", "floor": "Tầng 3", "area": "hành lang", "quote": "khu đi bộ trước thang máy"}, "Tòa S1 / Tầng 3 / Hành lang"),
    ("quote from another building", {"building": "S1", "floor": "3", "area": "Hành lang", "quote": "tầng 9 tòa S3"}, "Tòa S1 / Tầng 3 / Hành lang"),
    ("quote 400 chars", {"building": "S1", "floor": "3", "area": "Hành lang", "quote": "a" * 400}, "Tòa S1 / Tầng 3 / Hành lang"),
    ("quote missing key", {"building": "S1", "floor": "3", "area": "Hành lang"}, "Tòa S1 / Tầng 3 / Hành lang"),
]:
    _, case = receive(T1, reply([VS], loc))
    r, t = case.agent_decision, case.ticket
    got = (r.rejected, r.agent_location, t.status, t.department_id, "AGENT_FALLBACK" in t.flags)
    check("e1", name, got, got == ([], want, "ROUTED", "DEPT_CLEANING", False))

for name, loc, path, part in [
    ("building S9", {"building": "S9", "floor": "3", "area": "Hành lang", "quote": "tầng 3 tòa S1"}, "location.building", "building"),
    ("floor 'tầng cao'", {"building": "S1", "floor": "tầng cao", "area": "Hành lang", "quote": None}, "location.floor", "floor"),
    ("area 'Ban công'", {"building": "S1", "floor": "3", "area": "Ban công", "quote": "đúng nguyên văn"}, "location.area", "area"),
    ("area 'Ban công' + building S9", {"building": "S9", "floor": "3", "area": "Ban công", "quote": None}, None, None),
]:
    _, case = receive(T1, reply([VS], loc))
    r, t = case.agent_decision, case.ticket
    got = (r.rejected, r.agent_missing_parts, t.status, t.blocker.code if t.blocker else None, t.blocker.internal_note if t.blocker else None)
    if path is None:
        ok = r.rejected == ["location.building", "location.area"] and r.agent_missing_parts == ["building", "area"]
    else:
        ok = r.rejected == [path] and r.agent_missing_parts == [part] and t.status == "NEED_INFO"
    check("e2", name, got, ok)

# observation (block kept char-for-char by SPEC §3.2): the other Vietnamese accent placement of "tòa"
_, case = receive(T1, reply([VS], {"building": "Toà S1", "floor": "3", "area": "Hành lang", "quote": None}))
print(f"OBSERVE e3 building 'Toà S1' (accent on a) -> rejected={case.agent_decision.rejected} location={case.agent_decision.agent_location}")

# --------------------------------------------------------------------------------- changed assertions (H19 §3 last item)
from src.maintenance.agent.client import ClientReply as CR  # noqa: E402

eng = agent_engine(Clock(MONDAY_9AM), lambda s, u, d: CR(text=decision(**{"location.building": "S2", "location.floor": "7", "location.quote": ".."}), latency_ms=0.0))
case = eng.receive("Hành lang nhiều rác, đèn cũng không sáng", resident_id=RESIDENT)
print(f"MEASURE x1 test_p10_an_invented_place...: rejected={case.agent_decision.rejected} agent_location={case.agent_decision.agent_location}")
print(f"MEASURE x1 asset candidates={[(a.asset_id, a.location) for a in case.agent_decision.input.asset_candidates] if hasattr(case.agent_decision, 'input') else 'n/a'} job1.asset_id={case.agent_decision.decision.jobs[1].asset_id}")


def judged(sid, status, quote=None):
    return LLMSafetyAssessment(judgements=[SignalJudgement(signal_id=sid, status=status, quote=quote)])


TEXT_NONE = None
import tests.test_maintenance.test_safety as ts  # noqa: E402

inventing = MaintenanceEngine(clock=Clock(MONDAY_9AM), safety_llm=lambda text: judged("S-01", "PRESENT", "có khói đen"))
inventing.reset(with_fixtures=False)
from tests.test_maintenance.helpers import report as rep  # noqa: E402

c = inventing.get(rep(inventing, ts.TEXT_NONE))
audit = next(e for e in c.audit if e.action == Action.ASSESS_SAFETY)
print(f"MEASURE x2 test_engine_with_safety_llm_never_lowers: risk={c.ticket.risk_level} blocker={c.ticket.blocker.code} notes={audit.new_value['notes']!r} signals={[(s['signal_id'], s['status'], s['rule_id']) for s in audit.new_value.get('signals', [])] if isinstance(audit.new_value.get('signals'), list) else audit.new_value.get('signals')}")

print(f"BREAKS={BREAKS}")
