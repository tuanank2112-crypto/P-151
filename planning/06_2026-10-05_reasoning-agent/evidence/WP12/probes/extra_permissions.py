"""Extra probe (handoff hint: merge / split / wrong department beyond one's authority).

Every Wave-4 action is tried by EVERY actor (residents, BPTN, both departments, warehouse, BQL, the Agent and System
ids, an unknown id) on a fresh ticket in the right state, with the Mirror Agent on. Expected (01 §5.3, §6; P04 §9,
P05 §9, P06 §8, P07 §8): only the named roles succeed; everyone else is refused WITHOUT any change to the ticket.
Pass = 0 accepted-but-forbidden. Also reported: refusals that are not 403 + ACTION_DENIED audit."""

from common import BPTN, BQL, CLN, OTHER_RESIDENT, RESIDENT, TEC, WAREHOUSE, engine_with, mirror, out
from src.maintenance.errors import ActionDeniedError
from tests.test_maintenance.helpers import MONDAY_9AM, Clock

ACTORS = {"RESIDENT": RESIDENT, "OTHER_RESIDENT": OTHER_RESIDENT, "BPTN": BPTN, "CLN": CLN, "TEC": TEC,
          "WAREHOUSE": WAREHOUSE, "BQL": BQL, "AGENT": "SIM-ACTOR-AGENT", "SYSTEM": "SIM-ACTOR-SYSTEM",
          "UNKNOWN": "SIM-ACTOR-NOBODY"}
EMERG = "Hầm xe tầng B1 tòa S1 có lửa ở thùng rác"


def fresh():
    clock = Clock(MONDAY_9AM)
    return engine_with(mirror(), clock), clock


def st_emergency_pair():
    e, c = fresh()
    a = e.receive(EMERG, resident_id=RESIDENT).ticket.ticket_id
    c.advance(minutes=1)
    b = e.receive(EMERG + " cháy to", resident_id=RESIDENT).ticket.ticket_id
    return e, b, {"into": a, "note": "cùng vụ"}


def st_merged_ordinary():
    e, c = fresh()
    e.receive("Hành lang tầng 3 tòa S1 nhiều rác", resident_id=RESIDENT)
    c.advance(minutes=1)
    t = e.receive("Hành lang tầng 3 tòa S1 nhiều rác quá", resident_id=RESIDENT).ticket.ticket_id
    e.bptn_resolve(t, BPTN, merge=True, note="trùng")
    return e, t, {"note": "gộp nhầm"}


def st_merged_emergency():
    e, t, kw = st_emergency_pair()
    e.bql_merge(t, BQL, **kw)
    return e, t, {"note": "khác vụ"}


def st_split_child():
    e, _ = fresh()
    p = e.receive("Hành lang tầng 7 tòa S2 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT).ticket
    return e, p.split_children[0], {"note": "tách sai"}


def st_in_progress_cln():
    e, _ = fresh()
    t = e.receive("Hành lang tầng 3 tòa S1 nhiều rác", resident_id=RESIDENT).ticket.ticket_id
    e.accept(t, CLN)
    return e, t, {"note": "không phải việc phòng mình"}


def st_wrong_dept_after_start():
    e, t, kw = st_in_progress_cln()
    e.report_wrong_department(t, CLN, **kw)
    return e, t, {"note": "BQL quyết"}


def st_emergency():
    e, _ = fresh()
    return e, e.receive(EMERG, resident_id=RESIDENT).ticket.ticket_id, {"note": "đã dập lửa, cần dọn"}


def st_routed_cln():
    e, _ = fresh()
    return e, e.receive("Hành lang tầng 3 tòa S1 nhiều rác", resident_id=RESIDENT).ticket.ticket_id, {"note": "sai"}


CASES = [
    ("bql_merge", st_emergency_pair, lambda e: e.bql_merge, {"BQL"}),
    ("undo_merge(ordinary)", st_merged_ordinary, lambda e: e.undo_merge, {"BPTN", "BQL"}),
    ("undo_merge(emergency)", st_merged_emergency, lambda e: e.undo_merge, {"BQL"}),
    ("undo_split", st_split_child, lambda e: e.undo_split, {"BPTN", "BQL"}),
    ("report_wrong_department", st_in_progress_cln, lambda e: e.report_wrong_department, {"CLN"}),
    ("bql_wrong_department(KEEP)", st_wrong_dept_after_start,
     lambda e: (lambda t, a, **kw: e.bql_wrong_department(t, a, decision="KEEP", **kw)), {"BQL"}),
    ("bql_wrong_department(TO_BPTN)", st_wrong_dept_after_start,
     lambda e: (lambda t, a, **kw: e.bql_wrong_department(t, a, decision="TO_BPTN", **kw)), {"BQL"}),
    ("create_follow_up", st_emergency, lambda e: e.create_follow_up, {"BQL"}),
    ("return_wrong_department", st_routed_cln, lambda e: e.return_wrong_department, {"CLN"}),
]

accepted_forbidden, refused_allowed, not_403 = [], [], []
for name, setup, method, allowed in CASES:
    row = []
    for label, actor in ACTORS.items():
        e, t, kw = setup()
        before = e.get(t)
        denied_before = sum(1 for a in before.audit if a.action.value == "ACTION_DENIED")
        try:
            method(e)(t, actor, **kw)
            outcome = "OK"
        except ActionDeniedError:
            outcome = "403"
        except Exception as exc:  # noqa: BLE001
            outcome = type(exc).__name__
        after = e.get(t)
        denied_after = sum(1 for a in after.audit if a.action.value == "ACTION_DENIED")
        changed = (after.ticket.status, after.ticket.blocker, after.ticket.merged_into) != (
            before.ticket.status, before.ticket.blocker, before.ticket.merged_into)
        if label in allowed:
            if outcome != "OK":
                refused_allowed.append((name, label, outcome))
        else:
            if outcome == "OK" or changed:
                accepted_forbidden.append((name, label, outcome, changed))
            elif outcome != "403" or denied_after != denied_before + 1:
                not_403.append((name, label, outcome, denied_after - denied_before))
        row.append(f"{label}={outcome}{'*' if changed else ''}")
    out(f"{name:31} allowed={sorted(allowed)}")
    out("     " + " ".join(row))

out("refused although allowed:", refused_allowed)
for r in not_403:
    out("  REFUSED-NOT-403 (case, actor, outcome, ACTION_DENIED rows added)", r)
for r in accepted_forbidden:
    out("  ACCEPTED-FORBIDDEN", r)
out(f"RESULT cases={len(CASES)} actors={len(ACTORS)} accepted_forbidden={len(accepted_forbidden)}"
    f" refused_allowed={len(refused_allowed)} refused_not_403={len(not_403)}")
raise SystemExit(1 if accepted_forbidden or refused_allowed else 0)
