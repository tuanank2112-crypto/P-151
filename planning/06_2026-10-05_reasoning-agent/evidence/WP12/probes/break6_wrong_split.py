"""TESTING §8.6 — wrong splits. 18 REF MUST_NOT_SPLIT + 10 own sentences (cause/effect, two places, missing place,
tier-2 danger), each on a FRESH engine, in three modes: rules only, Mirror Agent, and an Agent that "splits everything"
(two grounded jobs on every report, the rules' location). Pass (§8.6) = no split when a P05 §3 condition is missing
(incomplete place, safety level, already split); every split the reckless Agent forces is reported with its G-1 flags."""

import importlib.util
from pathlib import Path

from common import ROOT, RESIDENT, FnClient, decision, engine_with, job, mirror, out
from src.maintenance import rules
from src.maintenance.catalog import load_catalog
from src.maintenance.engine import MaintenanceEngine
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

spec = importlib.util.spec_from_file_location(
    "ref_split", Path(ROOT) / "planning/06_2026-10-05_reasoning-agent/specs/REF-split-verdict.py")
ref = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)
OWN = [
    ("cause", "Hành lang tầng 3 tòa S1 tối om vì đèn hỏng nên không thấy rác để dọn"),
    ("cause", "Đèn hành lang tầng 3 tòa S1 không sáng nên rác đổ ra không ai thấy"),
    ("cause", "Bóng đèn sảnh thang máy tầng 5 tòa S1 vỡ, mảnh vỡ vương vãi khắp sàn"),
    ("cause", "Do đèn cầu thang bộ tầng 4 tòa S2 hỏng nên cư dân vứt rác bừa"),
    ("cause", "Hành lang tầng 2 tòa S2 bẩn do đèn tắt cả tuần, lao công không dọn"),
    ("two-places", "Hành lang tầng 3 tòa S1 nhiều rác, còn đèn sảnh thang máy tầng 5 tòa S1 không sáng"),
    ("two-places", "Rác ở hầm xe tầng B1 tòa S1, đèn hành lang tầng 2 tòa S2 cũng hỏng"),
    ("two-places", "Tầng 3 tòa S1 hành lang nhiều rác; tầng 7 tòa S2 hành lang đèn không sáng"),
    ("no-place", "Hành lang nhiều rác, đèn cũng không sáng"),
    ("danger", "Hành lang tầng 3 tòa S1 nhiều rác, đèn không sáng và hình như có mùi khét"),
]
SENTENCES = [("REF-MUST_NOT_SPLIT", s) for s in ref.MUST_NOT_SPLIT] + OWN
BUILDINGS = load_catalog().site.buildings


def reckless(data, user):
    loc = rules.extract_location(data.location_text, BUILDINGS)
    b = f = a = None
    if loc:
        b, f, a = loc.replace("Tòa ", "").replace("Tầng ", "").split(" / ")
    q = data.report_text[:300]
    return decision(jobs=[job("VE_SINH", q), job("KY_THUAT", q)], building=b, floor=f, area=a,
                    next_step="PROCEED" if loc else "ASK_RESIDENT",
                    ask_fields=None if loc else ["location"])


def run(mode, text):
    if mode == "rules":
        engine = MaintenanceEngine(clock=Clock(MONDAY_9AM))
        engine.reset(with_fixtures=False)
    else:
        engine = engine_with(mirror() if mode == "mirror" else FnClient(reckless))
    case = engine.receive(text, resident_id=RESIDENT)
    children = [engine.get(c) for c in case.ticket.split_children]
    run.where = [engine.effective_location(c) for c in children]
    return case, children


split_counts = {"rules": 0, "mirror": 0, "reckless": 0}
blocked_violations = []
for kind, text in SENTENCES:
    line = []
    for mode in ("rules", "mirror", "reckless"):
        case, children = run(mode, text)
        t = case.ticket
        if children:
            split_counts[mode] += 1
            c = children[0].ticket
            serious = [d.field for d in (case.agent_decision.disagreements if case.agent_decision else [])
                       if d.severity == "SERIOUS"]
            line.append(f"{mode}=SPLIT root {t.status.value}/{t.blocker.code.value if t.blocker else '-'} child "
                        f"{c.status.value}/{c.blocker.code.value if c.blocker else '-'} @ {run.where[0]} dept={c.department_id}"
                        f" G1/2/3={serious}")
            if kind in ("no-place", "danger"):
                blocked_violations.append((mode, kind, text))
            if mode != "reckless":
                blocked_violations.append((mode, kind, text))
        else:
            line.append(f"{mode}=no-split {t.status.value}/{t.blocker.code.value if t.blocker else '-'}")
    out(f"[{kind}] {text}")
    out("     " + " | ".join(line))

out("splits per mode:", split_counts, "of", len(SENTENCES))
for v in blocked_violations:
    out("  VIOLATION", v)
out(f"RESULT sentences={len(SENTENCES)} splits_rules={split_counts['rules']} splits_mirror={split_counts['mirror']}"
    f" splits_reckless={split_counts['reckless']} violations={len(blocked_violations)}")
raise SystemExit(1 if blocked_violations else 0)
