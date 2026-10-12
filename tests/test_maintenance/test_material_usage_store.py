"""Plan 16 CONTRACTS §C4 on the real transactions, memory and PostgreSQL: a failure anywhere in one material save
(second stock line, audit, save) rolls back the ticket, the stock, the audit and the outbox together; two tickets
racing for the last units never issue more than the stock holds.

The postgres cases run only with `--pg` (local docker *_test database, tests/conftest.py refuses anything else).
"""

import threading

import pytest

from src.maintenance.catalog import load_catalog
from src.maintenance.engine import AuditWriteError, GuardError, MaintenanceEngine, initial_stock
from src.maintenance.material_policy import MaterialUsageLine
from src.maintenance.store import memory, postgres
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import CLEANING, CLN, LIGHTING, TEC, WAREHOUSE, report

LAMP, LAMP2, CLEAN, BAG = "SIM-MAT-LAMP-01", "SIM-MAT-LAMP-02", "SIM-MAT-CLEAN-01", "SIM-MAT-BAG-01"
STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]


@pytest.fixture(params=STORES)
def repo(request):
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    return InMemoryRepository(initial_stock(load_catalog()))


def tx_class(repo):
    return postgres._PgTx if isinstance(repo, postgres.PostgresRepository) else memory._MemoryTx


def engine_on(repo, clock, **kwargs) -> MaintenanceEngine:
    engine = MaintenanceEngine(clock=clock, repo=repo, **kwargs)
    engine.reset(with_fixtures=False)
    return engine


def started(engine: MaintenanceEngine, text: str, actor: str) -> str:
    tid = report(engine, text)
    engine.accept(tid, actor)
    return tid


def lines(qty: dict[str, int]) -> list[MaterialUsageLine]:
    return [MaterialUsageLine(item_code=code, used_qty=q) for code, q in qty.items()]


def snapshot(repo, tid: str):
    return (
        repo.version_of(tid),
        repo.get(tid).model_dump(mode="json"),
        repo.stock(),
        len(repo.log_rows()),
        len(repo.notification_rows()),
    )


def test_second_stock_line_short_rolls_back_the_first(repo, clock):
    engine = engine_on(repo, clock)
    tid = started(engine, LIGHTING, TEC)
    before = snapshot(repo, tid)
    with pytest.raises(GuardError, match="Kho chỉ còn 0"):
        engine.save_material_usage(tid, TEC, lines=lines({LAMP: 2, LAMP2: 1}))
    assert snapshot(repo, tid) == before
    engine.receive_stock(WAREHOUSE, LAMP2, 1)
    lamp = repo.stock_of(LAMP)
    engine.save_material_usage(tid, TEC, lines=lines({LAMP: 2, LAMP2: 1}))
    assert (repo.stock_of(LAMP), repo.stock_of(LAMP2)) == (lamp - 2, 0)


def test_swap_to_an_empty_item_after_a_save_rolls_back(repo, clock):
    engine = engine_on(repo, clock)
    tid = started(engine, LIGHTING, TEC)
    engine.save_material_usage(tid, TEC, lines=lines({LAMP: 4}))
    before = snapshot(repo, tid)
    with pytest.raises(GuardError):
        engine.save_material_usage(tid, TEC, lines=lines({LAMP2: 4}))
    assert snapshot(repo, tid) == before


def test_repeat_and_delta_on_the_real_store(repo, clock):
    engine = engine_on(repo, clock)
    tid = started(engine, CLEANING, CLN)
    start = repo.stock_of(CLEAN)
    for qty in (4, 4, 2, 4):
        engine.save_material_usage(tid, CLN, lines=lines({CLEAN: qty}))
        assert repo.stock_of(CLEAN) == start - qty
    engine.save_material_usage(tid, CLN, lines=[])
    assert repo.stock_of(CLEAN) == start


def test_audit_failure_rolls_back_ticket_and_stock(repo, clock):
    fail = {"on": False}

    def sink(rows):
        if fail["on"]:
            raise RuntimeError("audit store down")

    engine = engine_on(repo, clock, audit_sink=sink)
    tid = started(engine, CLEANING, CLN)
    before = snapshot(repo, tid)
    fail["on"] = True
    with pytest.raises(AuditWriteError):
        engine.save_material_usage(tid, CLN, lines=lines({CLEAN: 2, BAG: 3}))
    assert snapshot(repo, tid) == before


def test_second_stock_write_failure_rolls_back(repo, clock, monkeypatch):
    engine = engine_on(repo, clock)
    tid = started(engine, CLEANING, CLN)
    before = snapshot(repo, tid)
    real = tx_class(repo).take_stock
    calls = {"n": 0}

    def flaky(self, item_code, qty):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("stock row lost")
        return real(self, item_code, qty)

    monkeypatch.setattr(tx_class(repo), "take_stock", flaky)
    with pytest.raises(RuntimeError, match="stock row lost"):
        engine.save_material_usage(tid, CLN, lines=lines({CLEAN: 2, BAG: 3}))
    assert calls["n"] == 2
    assert snapshot(repo, tid) == before


def test_save_failure_rolls_back_stock(repo, clock, monkeypatch):
    engine = engine_on(repo, clock)
    tid = started(engine, CLEANING, CLN)
    before = snapshot(repo, tid)

    def broken(self, case):
        raise RuntimeError("case row lost")

    monkeypatch.setattr(tx_class(repo), "save", broken)
    with pytest.raises(RuntimeError, match="case row lost"):
        engine.save_material_usage(tid, CLN, lines=lines({CLEAN: 2, BAG: 3}))
    monkeypatch.undo()
    assert snapshot(repo, tid) == before


def test_two_tickets_racing_for_the_last_units(repo, clock, request):
    """Two engines (two processes) on one store, two tickets each taking all 4 LED lamps (plan 19 seed) at the same time:
    exactly one wins, the other is refused, and the stock never goes below zero."""
    engine_a = engine_on(repo, clock)
    other = (
        postgres.PostgresRepository(request.getfixturevalue("pg_url"))
        if isinstance(repo, postgres.PostgresRepository)
        else repo
    )
    engine_b = MaintenanceEngine(clock=clock, repo=other)
    first = started(engine_a, LIGHTING, TEC)
    second = started(engine_a, "Đèn sảnh thang máy tầng 5 tòa S1 bị cháy.", TEC)
    start = repo.stock_of(LAMP)
    assert start == 4
    barrier = threading.Barrier(2)
    outcome: dict[str, BaseException | None] = {}

    def run(engine, tid):
        barrier.wait()
        try:
            engine.save_material_usage(tid, TEC, lines=lines({LAMP: 4}))
            outcome[tid] = None
        except BaseException as exc:  # collected and asserted below
            outcome[tid] = exc

    threads = [threading.Thread(target=run, args=job) for job in ((engine_a, first), (engine_b, second))]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    errors = [exc for exc in outcome.values() if exc is not None]
    assert len(outcome) == 2 and len(errors) == 1 and isinstance(errors[0], GuardError)
    assert repo.stock_of(LAMP) == start - 4
    issued = [m.issued_qty for tid in (first, second) for m in repo.get(tid).material_lines if m.issued_qty]
    assert issued == [4]
