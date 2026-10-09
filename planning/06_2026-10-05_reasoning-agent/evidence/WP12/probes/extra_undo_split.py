"""Extra probe (found by the random walk of extra-5): two faults of `undo_split` (SPEC-P05 §5), minimal repro.

(a) A split child that step 4 flagged as DUPLICATE of an earlier ticket R is taken back by undo_split: the child no
    longer points at R, but R.duplicate_count keeps the +1 (P04 §2.1 definition broken). Three rounds push R over
    PRI-U1 (`duplicate_raise_at_count`) with ZERO real duplicates left.
(b) "Undo of the undo" (P05 §5: undo_merge on the child) then undo_split again: the child id is appended a second time
    to the root's `merged_children` -> pydantic ValidationError (V-T5) instead of a clean merge or a 409.
Run with the rules (no Agent) and with the Mirror Agent."""

from common import BPTN, BQL, MONDAY_9AM, RESIDENT, Clock, engine_with, mirror, out
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import ReasonCode, TicketStatus

LAMP = "Đèn phòng rác tầng 2 tòa S2 không sáng"  # not a PRI-H1 area: MEDIUM, so PRI-U1 can show
MIXED = "Phòng rác tầng 2 tòa S2 nhiều rác, đèn cũng không sáng"
problems = []


def expect(cond, what):
    out(("ok   " if cond else "FAIL ") + what)
    if not cond:
        problems.append(what)


for mode in ("rules", "mirror"):
    out(f"=== {mode}")
    clock = Clock(MONDAY_9AM)
    if mode == "rules":
        engine = MaintenanceEngine(clock=clock)
        engine.reset(with_fixtures=False)
    else:
        engine = engine_with(mirror(), clock)
    raise_at = engine.catalog.sla_config.priority.duplicate_raise_at_count
    root = engine.receive(LAMP, resident_id=RESIDENT).ticket
    out("R", root.ticket_id, root.status.value, "priority", root.priority.value, "dup_count", root.duplicate_count,
        "raise_at", raise_at)
    for round_ in range(1, raise_at + 1):
        clock.advance(minutes=5)
        parent = engine.receive(MIXED, resident_id=RESIDENT).ticket
        child_id = parent.split_children[0]
        child = engine.get(child_id).ticket
        out(f" round {round_}: split {parent.ticket_id} -> child {child_id} {child.status.value}/"
            f"{child.blocker.code.value if child.blocker else None} -> {child.blocker.related_ticket_id if child.blocker else None}"
            f"; R.dup_count={engine.get(root.ticket_id).ticket.duplicate_count}")
        engine.undo_split(child_id, BPTN, note="tách sai")
        after = engine.get(root.ticket_id).ticket
        suspects = sum(
            1 for c in engine.repo.list()
            if c.ticket.status == TicketStatus.VERIFYING and c.ticket.blocker
            and c.ticket.blocker.code == ReasonCode.DUPLICATE and c.ticket.blocker.related_ticket_id == root.ticket_id
        )
        out(f"   after undo_split: child {engine.get(child_id).ticket.status.value}; R.dup_count={after.duplicate_count}"
            f" (real suspects pointing at R: {suspects}); R.priority={after.priority.value} reason={after.priority_reason!r}")
    final = engine.get(root.ticket_id).ticket
    expect(final.duplicate_count == 0, f"[{mode}] (a) R.duplicate_count back to 0 after every child was taken back "
                                       f"(got {final.duplicate_count})")
    expect("PRI-U1" not in (final.priority_reason or ""), f"[{mode}] (a) no PRI-U1 raise with zero duplicates")

    # (b) undo of the undo, then undo_split again
    clock.advance(minutes=5)
    parent = engine.receive("Hành lang tầng 7 tòa S2 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT).ticket
    child_id = parent.split_children[0]
    engine.undo_split(child_id, BPTN, note="tách sai")
    engine.undo_merge(child_id, BQL, note="tách đúng mà")
    c = engine.get(child_id).ticket
    out(f" (b) child after undo_merge: {c.status.value}/{c.blocker.code.value if c.blocker else None}"
        f" root.merged_children={engine.get(parent.ticket_id).ticket.merged_children}")
    try:
        engine.undo_split(child_id, BPTN, note="vẫn là tách sai")
        outcome = engine.get(child_id).ticket.status.value
    except Exception as exc:  # noqa: BLE001
        outcome = f"{type(exc).__name__}: {str(exc).splitlines()[0][:120]}"
    out(" (b) second undo_split ->", outcome)
    expect(not outcome.startswith("ValidationError"), f"[{mode}] (b) second undo_split is not a ValidationError")

    # (c) a count frozen while its root is MERGED (I-26 skips it) comes back stale after T09
    clock.advance(minutes=5)
    parent = engine.receive("Hành lang tầng 2 tòa S2 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT).ticket
    c_id = parent.split_children[0]  # the lamp child, routed: the first lamp report at this place
    clock.advance(minutes=5)
    lamp = engine.receive("Đèn hành lang tầng 2 tòa S2 không sáng", resident_id=RESIDENT).ticket
    out(f" (c) {lamp.ticket_id} {lamp.status.value}/{lamp.blocker.code.value if lamp.blocker else None} -> "
        f"{lamp.blocker.related_ticket_id if lamp.blocker else None}; child {c_id} count="
        f"{engine.get(c_id).ticket.duplicate_count}")
    engine.undo_split(c_id, BPTN, note="tách sai")  # child MERGED (terminal): its count is no longer written
    engine.bptn_resolve(lamp.ticket_id, BPTN, merge=False, note="khác vụ")  # the only suspect leaves
    engine.undo_merge(c_id, BQL, note="tách đúng mà")  # T09: the child is open again
    pointing = sum(1 for x in engine.repo.list() if x.ticket.blocker and x.ticket.blocker.code == ReasonCode.DUPLICATE
                   and x.ticket.blocker.related_ticket_id == c_id and x.ticket.status == TicketStatus.VERIFYING)
    got = engine.get(c_id).ticket.duplicate_count
    out(f" (c) child {c_id} back to {engine.get(c_id).ticket.status.value}: duplicate_count={got}, suspects={pointing}")
    expect(got == pointing, f"[{mode}] (c) count of a ticket re-opened by T09 matches its suspects ({got} vs {pointing})")

    # (d) chain merge through undo_split (P04 §8 CẤM "gộp dây chuyền"; `_merge_into` and `bql_merge` refuse it)
    clock.advance(minutes=5)
    parent = engine.receive("Sảnh thang máy tầng 5 tòa S1 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT).ticket
    c_id = parent.split_children[0]
    clock.advance(minutes=5)
    lamp = engine.receive("Đèn sảnh thang máy tầng 5 tòa S1 không sáng", resident_id=RESIDENT).ticket
    if lamp.blocker and lamp.blocker.code == ReasonCode.DUPLICATE and lamp.blocker.related_ticket_id == c_id:
        engine.bptn_resolve(lamp.ticket_id, BPTN, merge=True, note="trùng")  # lamp MERGED into the child
        try:
            engine.undo_split(c_id, BPTN, note="tách sai")
            res = "accepted"
        except Exception as exc:  # noqa: BLE001
            res = f"refused {type(exc).__name__}"
        l2, c2 = engine.get(lamp.ticket_id).ticket, engine.get(c_id).ticket
        out(f" (d) {lamp.ticket_id} {l2.status.value} into {l2.merged_into}; undo_split({c_id}) {res}: "
            f"{c2.status.value} into {c2.merged_into}")
        expect(res.startswith("refused"), f"[{mode}] (d) undo_split refuses a child that has open merged children")
    else:
        out(f" (d) setup not reached: {lamp.ticket_id} {lamp.status.value}/{lamp.blocker}")

out(f"RESULT problems={len(problems)}")
raise SystemExit(1 if problems else 0)
