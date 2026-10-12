"""Extra probe: the model INVENTS a location the resident never wrote (no quote, or a quote that only covers the area).

SPEC-P01 §3.2 checks the location quote only "if there is one" and the building/floor/area only against the catalog;
SPEC-P02 §6.2 says the engine NEVER goes on with a missing location. Compared with the same reports on a rules-only
engine (which asks the resident). Pass = no report without a written place is routed."""

from common import RESIDENT, FnClient, decision, engine_with, job, out
from src.maintenance.engine import MaintenanceEngine
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

CASES = [
    # (report, jobs, location (building, floor, area, quote))
    ("Đèn hành lang không sáng", [("KY_THUAT", "không sáng")], ("S2", "7", "Hành lang", None)),
    ("Đèn không sáng, tối quá", [("KY_THUAT", "không sáng")], ("S1", "3", "Hành lang", None)),
    ("Hành lang nhiều rác", [("VE_SINH", "nhiều rác")], ("S2", "2", "Hành lang", "Hành lang")),
    ("Nhiều rác, đèn cũng không sáng", [("VE_SINH", "Nhiều rác"), ("KY_THUAT", "đèn cũng không sáng")],
     ("S1", "3", "Hành lang", None)),
]
script = {text: (jobs, loc) for text, jobs, loc in CASES}


def answer(data, user):
    jobs, (b, f, a, q) = script[data.report_text]
    return decision(jobs=[job(c, qt) for c, qt in jobs], building=b, floor=f, area=a, loc_quote=q)


engine = engine_with(FnClient(answer))
rules = MaintenanceEngine(clock=Clock(MONDAY_9AM))
rules.reset(with_fixtures=False)
routed_invented = 0
for text, _, loc in CASES:
    case = engine.receive(text, resident_id=RESIDENT)
    base = rules.receive(text, resident_id=RESIDENT)
    t = case.ticket
    tickets = [case] + [engine.get(c) for c in t.split_children]
    for c in tickets:
        ct = c.ticket
        out(f"{ct.ticket_id} {text!r} agent_location={c.agent_decision.agent_location if c.agent_decision else None}"
            f" -> {ct.status.value}/{ct.blocker.code.value if ct.blocker else None} dept={ct.department_id}"
            f" asset={c.proposal.asset_id if c.proposal else None}"
            f" disagreements={[(d.field, d.severity) for d in (c.agent_decision.disagreements if c.agent_decision else [])]}")
        if ct.status.value == "ROUTED":
            routed_invented += 1
    out(f"    rules-only engine: {base.ticket.status.value}/{base.ticket.blocker.code.value if base.ticket.blocker else None}")
out(f"RESULT reports={len(CASES)} tickets_routed_to_invented_place={routed_invented}")
raise SystemExit(1 if routed_invented else 0)
