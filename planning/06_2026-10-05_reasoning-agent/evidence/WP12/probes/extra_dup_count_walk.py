"""Extra probe (Q27(4): "a pipeline re-run from step <= 4 on a ticket that was DUPLICATE may count +1 again").

Seeded random walks over ONE place (Tòa S1 / Tầng 3 / Hành lang): new cleaning reports, emergencies, BPTN merge/no-merge,
undo_merge by BPTN/BQL, BQL cancel, BQL merge of emergencies, BQL downgrade, set_priority. After EVERY step the
invariant of P04 §2.1 is checked on every open ticket R:
    R.duplicate_count == #(VERIFYING/DUPLICATE pointing at R) + #(MERGED into R, not a split child of R)
Run with the rules (no Agent) and with the Mirror Agent. Pass = 0 violations."""

import random

from common import BPTN, BQL, RESIDENT, engine_with, mirror, out
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import TERMINAL_STATUSES, Priority, ReasonCode, TicketStatus
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

CLEAN = ["Hành lang tầng 3 tòa S1 nhiều rác", "Hành lang tầng 3 tòa S1 bẩn quá", "Rác ở hành lang tầng 3 tòa S1",
         "Hành lang tầng 3 tòa S1 có vết bẩn"]
MIXED = ["Hành lang tầng 3 tòa S1 nhiều rác, đèn cũng không sáng"]
DANGER = ["Hành lang tầng 3 tòa S1 có khói bốc ra từ hộp điện", "Hành lang tầng 3 tòa S1 có mùi gas"]


def expected_counts(cases):
    want = {}
    for c in cases:
        t = c.ticket
        if t.status == TicketStatus.VERIFYING and t.blocker and t.blocker.code == ReasonCode.DUPLICATE:
            want[t.blocker.related_ticket_id] = want.get(t.blocker.related_ticket_id, 0) + 1
        if t.status == TicketStatus.MERGED and t.merged_into and t.split_from != t.merged_into:
            want[t.merged_into] = want.get(t.merged_into, 0) + 1
    return want


def walk(seed, with_agent, steps=250, skip_known=False):
    rng = random.Random(seed)
    clock = Clock(MONDAY_9AM)
    if with_agent:
        engine = engine_with(mirror(), clock)
    else:
        engine = MaintenanceEngine(clock=clock)
        engine.reset(with_fixtures=False)
    trace, violations = [], []
    for step in range(steps):
        clock.advance(minutes=1)
        cases = engine.repo.list()
        by = lambda pred: [c.ticket.ticket_id for c in cases if pred(c.ticket)]  # noqa: E731
        dups = by(lambda t: t.status == TicketStatus.VERIFYING and t.blocker and t.blocker.code == ReasonCode.DUPLICATE)
        merged = by(lambda t: t.status == TicketStatus.MERGED)
        emerg = by(lambda t: t.status == TicketStatus.VERIFYING and t.blocker
                   and t.blocker.code == ReasonCode.EMERGENCY_PENDING_BQL)
        openish = by(lambda t: t.status not in TERMINAL_STATUSES and t.status != TicketStatus.MERGED)
        children = by(lambda t: t.split_from is not None and t.status in (TicketStatus.ROUTED, TicketStatus.VERIFYING,
                                                                             TicketStatus.ON_HOLD))
        ops = [("receive", None)] * 3 + [("danger", None), ("mixed", None)]
        if skip_known:  # leave out the fault already found (undo_split of a DUPLICATE child) to explore further
            children = [c for c in children
                        if not (engine.get(c).ticket.blocker
                                and engine.get(c).ticket.blocker.code == ReasonCode.DUPLICATE)]
        ops += [("undo_split", c) for c in children]
        ops += [("merge", d) for d in dups] + [("nomerge", d) for d in dups] + [("undo", m) for m in merged]
        ops += [("cancel", o) for o in openish[:6]] + [("downgrade", e) for e in emerg]
        ops += [("bql_merge", (a, b)) for a in emerg for b in emerg if a != b][:4]
        ops += [("priority", o) for o in openish[:2]]
        op, arg = rng.choice(ops)
        try:
            if op == "receive":
                engine.receive(rng.choice(CLEAN), resident_id=RESIDENT)
            elif op == "mixed":
                engine.receive(rng.choice(MIXED), resident_id=RESIDENT)
            elif op == "undo_split":
                engine.undo_split(arg, rng.choice([BPTN, BQL]), note="tách sai")
            elif op == "danger":
                engine.receive(rng.choice(DANGER), resident_id=RESIDENT)
            elif op == "merge":
                engine.bptn_resolve(arg, BPTN, merge=True, note="trùng")
            elif op == "nomerge":
                engine.bptn_resolve(arg, BPTN, merge=False, note="khác vụ")
            elif op == "undo":
                engine.undo_merge(arg, rng.choice([BPTN, BQL]), note="gộp nhầm")
            elif op == "cancel":
                engine.cancel(arg, BQL, cancel_reason="hủy thử")
            elif op == "downgrade":
                engine.emergency_downgrade(arg, BQL, note="báo nhầm")
            elif op == "bql_merge":
                engine.bql_merge(arg[0], BQL, into=arg[1], note="cùng vụ")
            elif op == "priority":
                engine.set_priority(arg, BPTN, Priority.HIGH, note="gấp")
            result = "ok"
        except Exception as exc:  # noqa: BLE001 - a refused step is fine; the invariant is what is checked
            result = type(exc).__name__
        trace.append((step, op, arg, result))
        cases = engine.repo.list()
        want = expected_counts(cases)
        for c in cases:
            t = c.ticket
            if t.status in TERMINAL_STATUSES:
                continue
            if t.duplicate_count != want.get(t.ticket_id, 0):
                violations.append((step, op, arg, t.ticket_id, t.duplicate_count, want.get(t.ticket_id, 0)))
        if violations:
            break
    ops_done = {}
    for _, op, _, result in trace:
        ops_done[(op, result)] = ops_done.get((op, result), 0) + 1
    return violations, trace, ops_done


import sys  # noqa: E402

if "--mutant" in sys.argv:
    # sensitivity check of this probe: undo_merge forgets to give the root its count back
    from src.maintenance.coordination.merge import MergeMixin

    original = MergeMixin._count_if_open

    def forgetful(self, root_id, delta, other_id, actor_id, role, now, *, why):
        if why == "Hoàn tác gộp":
            return None
        return original(self, root_id, delta, other_id, actor_id, role, now, why=why)

    MergeMixin._count_if_open = forgetful
    bad = sum(bool(walk(seed, False)[0]) for seed in range(1, 9))
    out(f"RESULT mutant(undo_merge keeps the count) walks_with_violation={bad} (must be > 0)")
    raise SystemExit(0 if bad else 1)

total = 0
for skip_known, with_agent in ((False, False), (False, True), (True, False), (True, True)):
    for seed in range(1, 9):
        violations, trace, ops_done = walk(seed, with_agent, skip_known=skip_known)
        label = ("mirror-agent" if with_agent else "rules") + (" skip-known" if skip_known else "")
        out(f"[{label} seed={seed}] steps={len(trace)} violations={len(violations)} ops={sorted(ops_done.items())}")
        if violations:
            total += 1
            out("   FIRST VIOLATION (step, op, arg, ticket, duplicate_count, expected):", violations[0])
            for row in trace[-6:]:
                out("   trace", row)
out(f"RESULT walks=32 walks_with_violation={total}")
raise SystemExit(1 if total else 0)
