"""WP4 adversarial probes (plan 16, H04): try to break §C1-§C4 on the real engine, memory or local PostgreSQL.

Usage: python probe_backend.py memory|pg [repo-root]
  pg needs MO_TEST_DATABASE_URL = local docker *_test database (wiped by the probes).
Each probe prints HELD (the guard resisted) or BROKEN (the attack worked) plus what was measured.
Exit 0 only when every probe HELD.
"""

import json
import math
import os
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

MODE = sys.argv[1]
ROOT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parents[4])
sys.path.insert(0, str(ROOT))
os.environ.update(LLM_MODE="mock", MO_STORE="memory", MO_PHOTO_STORE="local", MO_ALLOW_RESET="false")

from src.maintenance.engine import MaintenanceEngine  # noqa: E402
from src.maintenance.enums import ChecklistStatus, EvidenceType, ReadabilityStatus  # noqa: E402
from src.maintenance.errors import ActionDeniedError, AuditWriteError  # noqa: E402
from src.maintenance.material_policy import MaterialUsageLine  # noqa: E402
from src.maintenance.models import PlannedMaterial  # noqa: E402
from src.maintenance.store.base import ConcurrencyError, GuardError, StoreUnavailableError  # noqa: E402
from tests.test_maintenance.helpers import BQL, CLN, MONDAY_9AM, RESIDENT, TEC, WAREHOUSE, Clock  # noqa: E402

print(f"mode={MODE} root={ROOT}")
LAMP1, LAMP2, STARTER, CLEAN, BAG = (
    "SIM-MAT-LAMP-01",
    "SIM-MAT-LAMP-02",
    "SIM-MAT-STARTER-01",
    "SIM-MAT-CLEAN-01",
    "SIM-MAT-BAG-01",
)
TEXTS = {
    "t1": "Đèn hành lang tầng 3 tòa S1 không sáng.",
    "t2": "Đèn hành lang tầng 7 tòa S2 không sáng.",
    "c1": "Hành lang tầng 3 tòa S1 nhiều rác, cần vệ sinh.",
}
results: list[tuple[str, bool, str]] = []

if MODE == "pg":
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text

    from src.maintenance.store.postgres import ALEMBIC_INI, PostgresRepository, _PgTx, sql_engine

    URL = os.environ["MO_TEST_DATABASE_URL"]
    parts = urlsplit(URL)
    assert parts.hostname in {"db", "localhost", "127.0.0.1"} and parts.path.endswith("_test"), "local *_test only"
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["database_url"] = URL
    command.upgrade(cfg, "head")
    TX_CLASS = _PgTx
else:
    from src.maintenance.store.memory import _MemoryTx

    TX_CLASS = _MemoryTx


def new_engine(*, accept=("t1", "t2", "c1")) -> tuple[MaintenanceEngine, dict[str, str]]:
    clock = Clock(MONDAY_9AM)
    if MODE == "pg":
        with sql_engine(URL).begin() as conn:
            for stmt in (
                "truncate maintops.audit_log, maintops.notifications, maintops.cases, maintops.sessions restart identity",
                "delete from maintops.stock",
                "update maintops.meta set value = 0 where key = 'run_number'",
                "select setval('maintops.ticket_number_seq', 1, false)",
            ):
                conn.execute(text(stmt))
        e = MaintenanceEngine(clock=clock, repo=PostgresRepository(URL))
    else:
        e = MaintenanceEngine(clock=clock)
    e.reset(with_fixtures=False)
    ids = {}
    for key, body in TEXTS.items():
        tid = e.receive(body, resident_id=RESIDENT).ticket.ticket_id
        ids[key] = tid
        if key in accept:
            e.accept(tid, CLN if key.startswith("c") else TEC)
    return e, ids


def snap(e: MaintenanceEngine, tid: str) -> tuple:
    case = e.repo.get(tid)
    return (
        case.model_dump_json(),
        json.dumps(e.repo.stock(), sort_keys=True),
        len(e.repo.log_rows()),
        len(e.repo.notification_rows()),
        e.repo.version_of(tid),
    )


def lines(e, tid):
    return [(m.item_code, m.planned_qty, m.issued_qty, m.used_qty) for m in e.repo.get(tid).material_lines]


def record(name: str, held: bool, detail: str) -> None:
    results.append((name, held, detail))
    print(f"{'HELD  ' if held else 'BROKEN'} {name} :: {detail}")


def expect_reject(name, e, tid, fn, want=GuardError):
    """`fn` must raise `want` and leave ticket/stock/audit/outbox/version exactly as before."""
    before = snap(e, tid)
    try:
        fn()
        outcome = "accepted"
    except Exception as exc:  # noqa: BLE001 - the probe reports whatever came out
        outcome = type(exc).__name__
    after = snap(e, tid)
    same = before == after
    record(name, outcome == want.__name__ and same, f"raised={outcome} want={want.__name__} state_unchanged={same}")


def mul(code, qty):
    return MaterialUsageLine.model_construct(item_code=code, used_qty=qty)  # bypasses pydantic like a direct caller


def side_work(e, tid, actor):
    """Checklist, note and photo: everything for step 10 except the materials."""
    case = e.repo.get(tid)
    for item in case.checklist_items:
        e.update_checklist(tid, actor, item.template_item_id, status=ChecklistStatus.COMPLETED)
    req = case.draft.evidence_requirements[0]
    e.add_evidence(
        tid,
        actor,
        requirement_id=req.requirement_id,
        evidence_type=req.allowed_evidence_types[0],
        content_or_metadata="Đã xử lý (probe)",
        readability_status=ReadabilityStatus.NOT_APPLICABLE,
    )
    e.add_evidence(
        tid,
        actor,
        requirement_id=None,
        evidence_type=EvidenceType.SIMULATED_IMAGE,
        content_or_metadata="after.jpg",
        readability_status=ReadabilityStatus.READABLE,
    )


def forge(e, tid, mutate):
    """Write old/bypassed data straight into the store (what an old client or old row could have left)."""
    with e.repo.transaction() as tx:
        case = tx.get_for_update(tid).model_copy(deep=True)
        mutate(case)
        tx.save(case)


# ---------------------------------------------------------------------- 1. guard bypass (§C1/§C3)
e, ids = new_engine()
t1, c1 = ids["t1"], ids["c1"]
for code in (CLEAN, BAG):
    expect_reject(f"B1 save tech<-{code}", e, t1, lambda c=code: e.save_material_usage(t1, TEC, lines=[mul(c, 1)]))
    expect_reject(
        f"B1 confirm tech<-{code}",
        e,
        t1,
        lambda c=code: e.confirm_materials(t1, TEC, lines=[PlannedMaterial(item_code=c, planned_qty=1)]),
    )
for code in (LAMP1, STARTER):
    expect_reject(f"B1 save clean<-{code}", e, c1, lambda c=code: e.save_material_usage(c1, CLN, lines=[mul(c, 1)]))
expect_reject(
    "B1 record_material foreign code on agent line",
    e,
    c1,
    lambda: e.record_material(c1, CLN, LAMP1, issued_qty=1, used_qty=1),
)
for bad in (0, -1, 0.5, True, False, "1", math.nan, math.inf, -math.inf, None, 10**400):
    label = "10**400" if bad == 10**400 else repr(bad)
    expect_reject(f"B2 save used_qty={label}", e, t1, lambda b=bad: e.save_material_usage(t1, TEC, lines=[mul(LAMP1, b)]))
    expect_reject(
        f"B2 record issued={label}",
        e,
        t1,
        lambda b=bad: e.record_material(t1, TEC, LAMP1, issued_qty=b, used_qty=1),
    )
    expect_reject(
        f"B2 record used={label}",
        e,
        t1,
        lambda b=bad: e.record_material(t1, TEC, LAMP1, issued_qty=1, used_qty=b),
    )
    expect_reject(
        f"B2 confirm planned={label}",
        e,
        t1,
        lambda b=bad: e.confirm_materials(
            t1, TEC, lines=[PlannedMaterial.model_construct(item_code=LAMP1, planned_qty=b)]
        ),
    )
expect_reject("B3 save tech []", e, t1, lambda: e.save_material_usage(t1, TEC, lines=[]))
expect_reject("B3 confirm tech []", e, t1, lambda: e.confirm_materials(t1, TEC, lines=[]))
expect_reject("B4 save duplicate code", e, t1, lambda: e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 1), mul(LAMP1, 1)]))
expect_reject("B4 save unknown code", e, t1, lambda: e.save_material_usage(t1, TEC, lines=[mul("SIM-MAT-NOPE", 1)]))
# accepted forms: 1 and 1.0
for ok in (1, 1.0):
    try:
        e.save_material_usage(t1, TEC, lines=[mul(LAMP1, ok)])
        got = lines(e, t1)
        record(f"B5 save accepts {ok!r}", got == [(LAMP1, 1.0, 1.0, 1.0)], f"lines={got}")
    except Exception as exc:  # noqa: BLE001
        record(f"B5 save accepts {ok!r}", False, f"raised {type(exc).__name__}: {exc}")

# completion bypass with old data / N_A (§C3 bullet 4)
OLD_CASES = {
    "tech N_A empty": lambda c: (setattr(c, "material_lines", []), setattr(c.draft, "material_line_ids", []),
                                 setattr(c.draft, "material_requirement_mode", "N_A"), setattr(c.draft, "material_gate_status", "N/A")),
    "tech foreign CLEAN 2/2": lambda c: [setattr(m, k, v) for m in c.material_lines for k, v in
                                         (("item_code", CLEAN), ("issued_qty", 2.0), ("used_qty", 2.0))],
    "tech LAMP 0.5/0.5": lambda c: [setattr(m, k, v) for m in c.material_lines for k, v in
                                    (("issued_qty", 0.5), ("used_qty", 0.5))],
    "tech LAMP 0/0": lambda c: [setattr(m, k, v) for m in c.material_lines for k, v in
                                (("issued_qty", 0.0), ("used_qty", 0.0))],
    "clean foreign LAMP 1/1": lambda c: [setattr(m, k, v) for m in c.material_lines for k, v in
                                         (("item_code", LAMP1), ("issued_qty", 1.0), ("used_qty", 1.0))],
}
for name, mutate in OLD_CASES.items():
    e, ids = new_engine()
    tid = ids["c1"] if name.startswith("clean") else ids["t1"]
    actor = CLN if name.startswith("clean") else TEC
    side_work(e, tid, actor)
    forge(e, tid, mutate)
    case = e.report_complete(tid, actor)
    status, failing = case.ticket.status, case.draft.readiness_evaluation.failing_items
    blocked = status == "IN_PROGRESS" and any(f in ("material_required", "material_invalid") for f in failing)
    record(f"B6 complete old-data {name}", blocked, f"status={status} failing={failing}")

# transition endpoint cannot jump to READY_FOR_REVIEW
e, ids = new_engine()
t1 = ids["t1"]
side_work(e, t1, TEC)
forge(e, t1, OLD_CASES["tech N_A empty"])
try:
    e.transition(t1, "READY_FOR_REVIEW", TEC)
    out = "accepted"
except Exception as exc:  # noqa: BLE001
    out = type(exc).__name__
record("B7 transition IN_PROGRESS->READY by dept", e.repo.get(t1).ticket.status == "IN_PROGRESS", f"raised={out}")

# positive controls: cleaning [] completes, technical norm1 used4 completes with no warning
e, ids = new_engine()
c1, t1 = ids["c1"], ids["t1"]
side_work(e, c1, CLN)
e.save_material_usage(c1, CLN, lines=[mul(CLEAN, 2)])
s_mid = e.repo.stock()[CLEAN]
e.save_material_usage(c1, CLN, lines=[])
case = e.report_complete(c1, CLN)
record(
    "C1 cleaning [] returns stock and completes",
    s_mid == 8.0 and e.repo.stock()[CLEAN] == 10.0 and case.ticket.status == "READY_FOR_REVIEW"
    and case.draft.material_requirement_mode == "N_A",
    f"stock_mid={s_mid} stock_end={e.repo.stock()[CLEAN]} status={case.ticket.status} mode={case.draft.material_requirement_mode}",
)
side_work(e, t1, TEC)
e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 4)])
case = e.report_complete(t1, TEC)
record(
    "C2 tech norm1 used4 -> READY, no reason/warning",
    case.ticket.status == "READY_FOR_REVIEW" and not case.draft.non_blocking_warnings and lines(e, t1) == [(LAMP1, 4.0, 4.0, 4.0)],
    f"status={case.ticket.status} warnings={len(case.draft.non_blocking_warnings)} lines={lines(e, t1)} stock={e.repo.stock()[LAMP1]}",
)

# ---------------------------------------------------------------------- 2. transaction (§C2/§C4)
e, ids = new_engine()
t1 = ids["t1"]
seq = []
for payload in ([(LAMP1, 4)], [(LAMP1, 4)], [(LAMP1, 2)], [(LAMP1, 4)], [(LAMP1, 1), (STARTER, 2)], [(STARTER, 3)]):
    n0 = len(e.repo.log_rows())
    e.save_material_usage(t1, TEC, lines=[mul(c, q) for c, q in payload])
    st = e.repo.stock()
    seq.append((st[LAMP1], st[STARTER], len(e.repo.log_rows()) - n0))
want = [(1.0, None, 1), (1.0, None, 1), (3.0, None, 1), (1.0, None, 1), (4.0, None, 1), (5.0, None, 1)]
record("T1 repeat/4->2->4/replace/None stock deltas", seq == want, f"(LAMP1,STARTER,audit+)={seq} want={want}")
line = e.repo.get(t1).material_lines[0]
record(
    "T2 stock None stays None (no fake 0/negative)",
    e.repo.stock()[STARTER] is None and line.simulated_stock_qty is None and line.material_stock_status == "UNKNOWN",
    f"stock={e.repo.stock()[STARTER]} line_stock={line.simulated_stock_qty} status={line.material_stock_status}",
)

e, ids = new_engine()
t1 = ids["t1"]
e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 4)])
expect_reject("T3 shortage swap LAMP1x4 -> LAMP2x1 (stock 0)", e, t1,
              lambda: e.save_material_usage(t1, TEC, lines=[mul(LAMP2, 1)]))
expect_reject("T4 two lines, line2 short", e, t1,
              lambda: e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 5), mul(LAMP2, 1)]))
e.repo.set_stock(LAMP2, 3.0)
expect_reject("T5 legacy record over stock", e, t1, lambda: e.record_material(t1, TEC, LAMP1, issued_qty=6, used_qty=6))
expect_reject("T5b legacy used > issued", e, t1, lambda: e.record_material(t1, TEC, LAMP1, issued_qty=4, used_qty=5))


def inject(name, target, attr, exc_factory, *, on_call=1):
    """Make `target.attr` raise on its `on_call`-th call during one multi-move save; state must not move."""
    original = getattr(target, attr)
    calls = {"n": 0}

    def broken(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == on_call:
            raise exc_factory()
        return original(*args, **kwargs)

    setattr(target, attr, broken)
    try:
        # moves: LAMP1 4->2 (returns 2), LAMP2 0->2 (takes 2): two stock writes before save/audit/outbox
        expect_reject(
            name, e, t1, lambda: e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 2), mul(LAMP2, 2)]),
            want=type(exc_factory()),
        )
    finally:
        setattr(target, attr, original)
    print(f"       {name}: patched {attr} called {calls['n']}x")


inject("T6 second stock write fails", TX_CLASS, "take_stock", lambda: StoreUnavailableError("probe"), on_call=2)
inject("T7 tx.save fails", TX_CLASS, "save", lambda: StoreUnavailableError("probe"))
inject("T8 tx.append_log fails", TX_CLASS, "append_log", lambda: StoreUnavailableError("probe"))
e.audit_sink = lambda rows: (_ for _ in ()).throw(RuntimeError("probe sink"))
expect_reject("T9 audit sink fails", e, t1, lambda: e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 2), mul(LAMP2, 2)]),
              want=AuditWriteError)
e.audit_sink = lambda rows: None
n_notes = len(e.repo.notification_rows())
e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 2), mul(LAMP2, 2)])
st = e.repo.stock()
record(
    "T10 same multi-move save succeeds once faults are gone",
    (st[LAMP1], st[LAMP2]) == (3.0, 1.0) and lines(e, t1) == [(LAMP1, 2.0, 2.0, 2.0), (LAMP2, 2.0, 2.0, 2.0)],
    f"stock LAMP1={st[LAMP1]} LAMP2={st[LAMP2]} lines={lines(e, t1)} outbox_rows_added={len(e.repo.notification_rows()) - n_notes}",
)

# ---------------------------------------------------------------------- 3. permission / state
e, ids = new_engine(accept=("t1",))
t1, t2 = ids["t1"], ids["t2"]
for actor in (CLN, BQL, WAREHOUSE, RESIDENT):
    before_lines, before_stock, n0 = lines(e, t1), e.repo.stock(), len(e.repo.log_rows())
    try:
        e.save_material_usage(t1, actor, lines=[mul(LAMP1, 1)])
        out = "accepted"
    except Exception as exc:  # noqa: BLE001
        out = type(exc).__name__
    record(
        f"P1 save by {actor}",
        out == "ActionDeniedError" and lines(e, t1) == before_lines and e.repo.stock() == before_stock,
        f"raised={out} lines_same={lines(e, t1) == before_lines} stock_same={e.repo.stock() == before_stock} "
        f"denial_audit_rows_added={len(e.repo.log_rows()) - n0}",
    )
expect_reject("P2 save on ROUTED (not accepted)", e, t2, lambda: e.save_material_usage(t2, TEC, lines=[mul(LAMP1, 1)]))
side_work(e, t1, TEC)
e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 1)])
e.report_complete(t1, TEC)
expect_reject("P3 save on READY_FOR_REVIEW", e, t1, lambda: e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 2)]))
try:
    e.save_material_usage("SIM-TKT-9999", TEC, lines=[mul(LAMP1, 1)])
    out = "accepted"
except Exception as exc:  # noqa: BLE001
    out = type(exc).__name__
record("P4 save on missing ticket", out == "NotFoundError", f"raised={out}")

# ---------------------------------------------------------------------- 4. concurrency
def race(engines, jobs, slow_take: float):
    """Run jobs[i] on engines[i] at the same instant; the first stock write sleeps inside its transaction."""
    original = TX_CLASS.take_stock

    def slow(self, code, qty):
        out = original(self, code, qty)
        time.sleep(slow_take)
        return out

    TX_CLASS.take_stock = slow
    gate = threading.Barrier(len(jobs))
    outcomes = [None] * len(jobs)

    def run(i):
        gate.wait()
        try:
            jobs[i](engines[i])
            outcomes[i] = "ok"
        except Exception as exc:  # noqa: BLE001
            outcomes[i] = type(exc).__name__

    threads = [threading.Thread(target=run, args=(i,)) for i in range(len(jobs))]
    for t in threads:
        t.start()
    for t in threads:
        t.join(30)
    TX_CLASS.take_stock = original
    return outcomes


for round_no in range(5):
    e, ids = new_engine(accept=("t1", "t2"))
    t1, t2 = ids["t1"], ids["t2"]
    other = MaintenanceEngine(clock=e.clock, repo=e.repo) if MODE == "pg" else e  # pg: a second process, own lock
    outs = race([e, other], [lambda en: en.save_material_usage(t1, TEC, lines=[mul(LAMP1, 4)]),
                             lambda en: en.save_material_usage(t2, TEC, lines=[mul(LAMP1, 4)])], 0.3)
    issued = sum(m.issued_qty or 0 for tid in (t1, t2) for m in e.repo.get(tid).material_lines if m.item_code == LAMP1 and m.used_qty)
    stock = e.repo.stock()[LAMP1]
    record(
        f"R1 two tickets x4 vs stock5 round{round_no}",
        sorted(outs) == ["GuardError", "ok"] and stock + issued == 5.0 and stock >= 0,
        f"outcomes={outs} stock={stock} issued_total={issued}",
    )

for round_no in range(3):
    e, ids = new_engine(accept=("t1",))
    t1 = ids["t1"]
    other = MaintenanceEngine(clock=e.clock, repo=e.repo) if MODE == "pg" else e
    outs = race([e, other], [lambda en: en.save_material_usage(t1, TEC, lines=[mul(LAMP1, 2)]),
                             lambda en: en.save_material_usage(t1, TEC, lines=[mul(LAMP1, 3)])], 0.3)
    got = lines(e, t1)
    stock = e.repo.stock()[LAMP1]
    issued = sum(x[2] for x in got)
    record(
        f"R2 same ticket two writers round{round_no}",
        stock + issued == 5.0 and all(o in ("ok", "ConcurrencyError") for o in outs) and "ok" in outs,
        f"outcomes={outs} lines={got} stock={stock} version={e.repo.version_of(t1)}",
    )

# ---------------------------------------------------------------------- 5. old line with a code no longer in catalog
e, ids = new_engine()
t1 = ids["t1"]
forge(e, t1, lambda c: [setattr(m, k, v) for m in c.material_lines for k, v in
                        (("item_code", "SIM-MAT-OLD-99"), ("issued_qty", 2.0), ("used_qty", 2.0))])
try:
    e.save_material_usage(t1, TEC, lines=[mul(LAMP1, 1)])
    out = "ok"
except Exception as exc:  # noqa: BLE001
    out = f"{type(exc).__name__}: {exc}"
record("X1 replace old unknown-code line", out == "ok" and lines(e, t1) == [(LAMP1, 1.0, 1.0, 1.0)],
       f"result={out} lines={lines(e, t1)} stock_old={e.repo.stock().get('SIM-MAT-OLD-99')}")

broken = [r for r in results if not r[1]]
print(f"SUMMARY mode={MODE} probes={len(results)} held={len(results) - len(broken)} broken={len(broken)}")
for name, _, detail in broken:
    print(f"  BROKEN {name} :: {detail}")
sys.exit(1 if broken else 0)
