"""Extra probe (handoff hints: "ticket con của tách mất mức an toàn của gốc", "follow-up né khoá").

(a) Split vs safety: the mixed report with an Agent that raises safety (S-00 PRESENT, T2-04 UNCLEAR, grounded) must
    never be split, and a child must never carry a lower level than its root (Mirror, 32 REF MUST_SPLIT sentences).
(b) Follow-up vs BPTN lock: BPTN confirmed the place on the phone (locked_fields.location) before the ticket became an
    emergency; BQL opens the follow-up (P07 §6). Is the BPTN-locked place kept, or re-decided (rules/Agent)?"""

import importlib.util
from pathlib import Path

from common import BPTN, BQL, MONDAY_9AM, ROOT, RESIDENT, Clock, FnClient, decision, engine_with, job, mirror, out
from src.maintenance.agent.baseline import mirror_decision
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.enums import RiskLevel

ORDER = {RiskLevel.NONE: 0, RiskLevel.UNCLEAR: 1, RiskLevel.EMERGENCY: 2}
CAT, LEX = load_catalog(), load_lexicon()
MIXED = "Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng"
problems = []


def expect(cond, what):
    out(("ok   " if cond else "FAIL ") + what)
    if not cond:
        problems.append(what)


# (a1) the Agent raises safety on a mixed report: no split
for signal, status, want in (("S-00", "PRESENT", "EMERGENCY"), ("T2-04", "UNCLEAR", "UNCLEAR")):
    def raising(data, user, signal=signal, status=status):
        return decision(jobs=[job("VE_SINH", "nhiều rác"), job("KY_THUAT", "đèn cũng không sáng")],
                        building="S1", floor="3", area="Hành lang", loc_quote="Hành lang tầng 3 tòa S1",
                        risk="EMERGENCY" if status == "PRESENT" else "UNCLEAR",
                        signals=[{"signal_id": signal, "status": status, "quote": "đèn cũng không sáng"}])
    e = engine_with(FnClient(raising))
    case = e.receive(MIXED, resident_id=RESIDENT)
    t = case.ticket
    out(f"(a1) Agent {signal} {status}: {t.status.value}/{t.blocker.code.value if t.blocker else None} risk={t.risk_level.value}"
        f" children={t.split_children}")
    expect(not t.split_children and t.risk_level.value == want, f"(a1) {signal} {status}: no split, root {want}")

# (a2) Mirror on the 32 REF MUST_SPLIT sentences: child level never below the root's
spec = importlib.util.spec_from_file_location(
    "ref_split", Path(ROOT) / "planning/06_2026-10-05_reasoning-agent/specs/REF-split-verdict.py")
ref = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)
splits, lower = 0, []
for text in ref.MUST_SPLIT:
    e = engine_with(mirror())
    root = e.receive(text, resident_id=RESIDENT)
    for cid in root.ticket.split_children:
        splits += 1
        child = e.get(cid)
        if ORDER[child.ticket.risk_level] < ORDER[root.ticket.risk_level]:
            lower.append((text, root.ticket.risk_level, child.ticket.risk_level))
out(f"(a2) MUST_SPLIT={len(ref.MUST_SPLIT)} split={splits} child_below_root={len(lower)}")
expect(not lower, "(a2) no split child below its root's level")

# (b) follow-up after a BPTN-locked place
for mode in ("mirror", "agent-reads-text"):
    def answer(data, user):
        if mode == "mirror" or data.follow_up_of is None:
            return mirror_decision(data, CAT, LEX).model_dump_json()
        # an Agent that reads only the text (no place written there) and guesses one: allowed by P01 §3.2
        return decision(jobs=[job("KY_THUAT", "Đèn không sáng")], building="S2", floor="7", area="Hành lang")
    clock = Clock(MONDAY_9AM)
    e = engine_with(FnClient(answer), clock)
    tid = e.receive("Đèn không sáng", resident_id=RESIDENT).ticket.ticket_id
    clock.advance(minutes=10)
    e.bptn_resolve(tid, BPTN, location="Tòa S1 / Tầng 3 / Hành lang", info="có khói bốc ra từ hộp đèn",
                   note="gọi cư dân")
    src = e.get(tid)
    out(f"(b/{mode}) source {tid}: {src.ticket.status.value}/{src.ticket.blocker.code.value} "
        f"lock={src.ticket.locked_fields.location}")
    clock.advance(minutes=30)  # BQL handles the emergency later
    new = e.create_follow_up(tid, BQL, note="đã tắt điện, cần thay đèn")
    t = new.ticket
    out(f"(b/{mode}) follow-up {t.ticket_id}: {t.status.value}/{t.blocker.code.value if t.blocker else None} "
        f"lock={t.locked_fields.location} place={e.effective_location(new)} dept={t.department_id}")
    expect(e.effective_location(new) == "Tòa S1 / Tầng 3 / Hành lang",
           f"(b/{mode}) follow-up keeps the place BPTN confirmed for the source")

out(f"RESULT problems={len(problems)}")
raise SystemExit(1 if problems else 0)
