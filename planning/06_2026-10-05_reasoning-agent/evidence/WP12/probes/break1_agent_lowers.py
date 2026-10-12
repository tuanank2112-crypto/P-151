"""TESTING §8.1 — the Agent tries to LOWER the safety level.

The fake model answers risk NONE, every signal ABSENT, one confident job and a complete location, PROCEED. Measured on
every labelled tier-1 sentence (P0 + P1 YAML, expect EMERGENCY) and every labelled tier-2 sentence (expect UNCLEAR),
through three entry points: receive (original text), add_resident_info (danger only in a resident addition) and
bptn_resolve(info=...) (danger typed by BPTN on MISSING_INFO). Pass = 0 tickets below the label, 0 routed.
"""

from common import (
    ALL_SIGNALS, BPTN, RESIDENT, FnClient, decision, engine_with, job, labelled, out,
)
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import ReasonCode, RiskLevel, TicketStatus
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

ORDER = {RiskLevel.NONE: 0, RiskLevel.UNCLEAR: 1, RiskLevel.EMERGENCY: 2}


SETUP = "Đèn hành lang không sáng"  # the setup report of paths B and C: honest answer, location missing


def lowering(data, user):
    quote = data.report_text.strip()[:40]
    if data.report_text.strip() == SETUP:
        return decision(jobs=[job("KY_THUAT", SETUP)], area="Hành lang", next_step="ASK_RESIDENT",
                        ask_fields=["location_building", "location_floor"])
    return decision(
        jobs=[job("KY_THUAT", quote)],
        building="S1", floor="3", area="Hành lang",
        risk="NONE",
        signals=[{"signal_id": s, "status": "ABSENT", "quote": None} for s in ALL_SIGNALS[:10]],
        safety_reason="Cư dân nói quá lên, không có gì nguy hiểm; giao thợ ngay",
    )


tier1 = labelled("safety_cases_p0.yaml", "safety_cases", "EMERGENCY") + labelled(
    "safety_cases_p1.yaml", "must_catch", "EMERGENCY"
)
tier2 = labelled("safety_cases_p0.yaml", "safety_cases", "UNCLEAR") + labelled(
    "safety_cases_p1.yaml", "must_catch", "UNCLEAR"
)
out(f"tier1 labelled sentences: {len(tier1)}; tier2 labelled sentences: {len(tier2)}")

failures = []
routed = []
calls_by_path = {}


def check(path, cid, text, case, want):
    t = case.ticket
    ok = ORDER[t.risk_level] >= ORDER[want] and t.status not in (TicketStatus.ROUTED, TicketStatus.IN_PROGRESS)
    code = t.blocker.code if t.blocker else None
    want_code = ReasonCode.EMERGENCY_PENDING_BQL if want == RiskLevel.EMERGENCY else None
    if want_code is not None and code != want_code:
        ok = False
    if t.status in (TicketStatus.ROUTED, TicketStatus.IN_PROGRESS):
        routed.append((path, cid))
    if not ok:
        # pipeline never re-ran on the addition (NEED_INFO kept, nothing assessed) vs. 2b ran and ended below the label
        kind = "NOT_ASSESSED" if (t.status == TicketStatus.NEED_INFO and code == ReasonCode.MISSING_INFO
                                  and t.risk_level == RiskLevel.NONE) else "LOWERED"
        failures.append((kind, path, cid, text, t.status, code, t.risk_level))


for want, sentences in ((RiskLevel.EMERGENCY, tier1), (RiskLevel.UNCLEAR, tier2)):
    # path A: receive
    client = FnClient(lowering)
    engine = engine_with(client)
    for cid, text in sentences:
        case = engine.receive(text, resident_id=RESIDENT)
        check(f"receive/{want}", cid, text, case, want)
    calls_by_path[f"receive/{want}"] = len(client.calls)

    # path B: danger only in a resident addition (ticket first NEED_INFO for a missing location)
    client = FnClient(lowering)
    engine = engine_with(client)
    for cid, text in sentences:
        tid = engine.receive(SETUP, resident_id=RESIDENT).ticket.ticket_id
        assert engine.get(tid).ticket.status == TicketStatus.NEED_INFO, engine.get(tid).ticket.status
        case = engine.add_resident_info(tid, RESIDENT, text)
        check(f"add_resident_info/{want}", cid, text, case, want)
    calls_by_path[f"add_resident_info/{want}"] = len(client.calls)

    # path C: BPTN types the danger as `info` on MISSING_INFO
    client = FnClient(lowering)
    engine = engine_with(client)
    for cid, text in sentences:
        tid = engine.receive(SETUP, resident_id=RESIDENT).ticket.ticket_id
        case = engine.bptn_resolve(tid, BPTN, info=text, location="Tòa S1 / Tầng 3 / Hành lang", note="gọi cư dân")
        check(f"bptn_resolve_info/{want}", cid, text, case, want)
    calls_by_path[f"bptn_resolve_info/{want}"] = len(client.calls)

out("model calls per path:", calls_by_path)
out(f"tickets routed/in progress: {len(routed)}")
# Same three paths with NO Agent (rules only): the Agent must never end LOWER than the rules on the same input.
def rules_engine():
    e = MaintenanceEngine(clock=Clock(MONDAY_9AM))
    e.reset(with_fixtures=False)
    return e


agent_below_rules = []
compared = 0
for want, sentences in ((RiskLevel.EMERGENCY, tier1), (RiskLevel.UNCLEAR, tier2)):
    pairs = [(engine_with(FnClient(lowering)), rules_engine())]
    for ea, er in pairs:
        for cid, text in sentences:
            ca, cr = ea.receive(text, resident_id=RESIDENT), er.receive(text, resident_id=RESIDENT)
            ta = ea.add_resident_info(ea.receive(SETUP, resident_id=RESIDENT).ticket.ticket_id, RESIDENT, text)
            tr = er.add_resident_info(er.receive(SETUP, resident_id=RESIDENT).ticket.ticket_id, RESIDENT, text)
            ba = ea.bptn_resolve(ea.receive(SETUP, resident_id=RESIDENT).ticket.ticket_id, BPTN, info=text,
                                 location="Tòa S1 / Tầng 3 / Hành lang", note="gọi cư dân")
            br = er.bptn_resolve(er.receive(SETUP, resident_id=RESIDENT).ticket.ticket_id, BPTN, info=text,
                                 location="Tòa S1 / Tầng 3 / Hành lang", note="gọi cư dân")
            for path, a, r in (("receive", ca, cr), ("add_resident_info", ta, tr), ("bptn_resolve_info", ba, br)):
                compared += 1
                if ORDER[a.ticket.risk_level] < ORDER[r.ticket.risk_level]:
                    agent_below_rules.append((path, cid, a.ticket.risk_level, r.ticket.risk_level))
out(f"Agent engine vs rules-only engine, same input: compared={compared} agent_lower_than_rules={len(agent_below_rules)}")
for row in agent_below_rules:
    out("  AGENT<RULES", row)

lowered = [f for f in failures if f[0] == "LOWERED"]
not_assessed = [f for f in failures if f[0] == "NOT_ASSESSED"]
out(f"below label: {len(failures)} (LOWERED after 2b ran: {len(lowered)}; NOT_ASSESSED, pipeline never re-ran: "
    f"{len(not_assessed)})")
by_path = {}
for f in failures:
    by_path[(f[0], f[1])] = by_path.get((f[0], f[1]), 0) + 1
out("failures by (kind, path):", by_path)
for f in failures:
    out("  FAIL", f)
checked = 3 * (len(tier1) + len(tier2))
receive_below = [f for f in failures if f[1].startswith("receive/")]
out(f"§8.1 criterion (receive path, labelled tier-1/tier-2): below_label={len(receive_below)} of "
    f"{len(tier1) + len(tier2)}")
out(f"RESULT checked={checked} receive_below_label={len(receive_below)} agent_lower_than_rules={len(agent_below_rules)}"
    f" routed={len(routed)} | other paths: below_label_after_2b={len(lowered)} (rule floor, see extra-2)"
    f" not_assessed={len(not_assessed)} (pipeline never re-ran, see extra-1)")
# exit code = the Agent criterion of §8.1 (the rule-floor defects of the other paths are measured in extra-1/extra-2)
raise SystemExit(1 if receive_below or agent_below_rules or routed else 0)
