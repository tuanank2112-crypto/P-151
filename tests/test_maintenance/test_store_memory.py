"""Repository contract, memory and PostgreSQL (plan #01, TESTING-ACCEPTANCE §3: T01, T02, T03, T05, T09, T23).

The `repo` fixture is parametrised by store kind; the postgres case runs only with `--pg` (local docker *_test DB).
"""

from datetime import timedelta

import pytest
from sqlalchemy import text

from src.maintenance.catalog import load_catalog
from src.maintenance.engine import (
    ActionDeniedError,
    AuditWriteError,
    GuardError,
    MaintenanceEngine,
    initial_stock,
    seed_if_empty,
)
from src.maintenance.enums import Action
from src.maintenance.models import AuditEvent, Case, StatusEvent
from src.maintenance.store.base import ConcurrencyError
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import BQL, CLEANING, CLN, LIGHTING, SYSTEM, WAREHOUSE, report

STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]

# Ledger rows per ticket must match the doc (TESTING-ACCEPTANCE §5.2): the query returns the tickets that do not.
LEDGER_SQL = """
select c.ticket_id
from maintops.cases c
left join (select ticket_id,
                  count(*) filter (where kind = 'audit')  as audit_rows,
                  count(*) filter (where kind = 'status') as status_rows
           from maintops.audit_log group by ticket_id) l using (ticket_id)
left join (select ticket_id, count(*) as notification_rows
           from maintops.notifications group by ticket_id) n using (ticket_id)
where coalesce(l.audit_rows, 0)        <> jsonb_array_length(c.doc->'audit')
   or coalesce(l.status_rows, 0)       <> jsonb_array_length(c.doc->'events')
   or coalesce(n.notification_rows, 0) <> jsonb_array_length(c.doc->'notifications')
order by c.ticket_id
"""


@pytest.fixture(params=STORES)
def repo(request):
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    return InMemoryRepository(initial_stock(load_catalog()))


@pytest.fixture(params=STORES)
def empty_repo(request):
    """No ticket and no stock row at all: what a brand-new database looks like."""
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")
    return InMemoryRepository()


@pytest.fixture(params=["memory"])
def memory_repo(request) -> InMemoryRepository:
    """Nested transactions on one thread: memory only (Postgres refuses them, see T05-pg)."""
    return InMemoryRepository(initial_stock(load_catalog()))


def _snapshot(repo, ticket_id: str) -> tuple[int, dict, int, int]:
    return (
        repo.version_of(ticket_id),
        repo.get(ticket_id).model_dump(mode="json"),
        len(repo.log_rows()),
        len(repo.notification_rows()),
    )


def test_t01_case_round_trip_after_reset(repo):
    engine = MaintenanceEngine(repo=repo)
    engine.reset()
    cases = repo.list()
    assert len(cases) == 12 and repo.count() == 12
    for case in cases:
        ticket_id = case.ticket.ticket_id
        assert repo.get(ticket_id) == case
        assert Case.model_validate(case.model_dump(mode="json")) == case
    assert [c.ticket.ticket_id for c in cases] == sorted(c.ticket.ticket_id for c in cases)


def test_t02_audit_sink_failure_changes_nothing(repo, clock):
    fail = {"on": False}

    def sink(rows):
        if fail["on"]:
            raise RuntimeError("audit store down")

    engine = MaintenanceEngine(clock=clock, audit_sink=sink, repo=repo)
    engine.reset(with_fixtures=False)
    tid = report(engine, CLEANING)
    before = _snapshot(repo, tid)
    fail["on"] = True
    with pytest.raises(AuditWriteError):
        engine.accept(tid, CLN)
    assert _snapshot(repo, tid) == before


def test_t03_guard_error_in_op_changes_nothing(repo, clock):
    engine = MaintenanceEngine(clock=clock, repo=repo)
    engine.reset(with_fixtures=False)
    tid = report(engine, CLEANING)
    assert engine.get(tid).ticket.status == "ROUTED"
    before = _snapshot(repo, tid)
    with pytest.raises(GuardError):
        engine.run_agent(tid)  # the pipeline only runs on RECEIVED: the op raises inside the transaction
    assert _snapshot(repo, tid) == before

    def half_done(work: Case, now) -> None:  # changes the case, then a guard fails
        work.ticket.assignee_id = "SIM-HALF-DONE"
        work.audit.append(work.audit[-1].model_copy(update={"event_id": "SIM-AUD-HALF"}))
        raise GuardError("Điều kiện nghiệp vụ không đạt")

    with pytest.raises(GuardError):
        engine._mutate(tid, SYSTEM, Action.RUN_PIPELINE, half_done)
    assert _snapshot(repo, tid) == before
    assert repo.get(tid).ticket.assignee_id is None


def test_t05_stale_save_raises_concurrency_error(memory_repo, clock):
    repo = memory_repo
    engine = MaintenanceEngine(clock=clock, repo=repo)
    engine.reset(with_fixtures=False)
    tid = report(engine, CLEANING)
    with repo.transaction() as first:
        stale = first.get_for_update(tid).model_copy(deep=True)
        with repo.transaction() as second:
            winner = second.get_for_update(tid).model_copy(deep=True)
            winner.ticket.assignee_id = "SIM-WINNER"
            second.save(winner)
        after_winner = _snapshot(repo, tid)
        stale.ticket.assignee_id = "SIM-LOSER"
        with pytest.raises(ConcurrencyError):
            first.save(stale)
    assert _snapshot(repo, tid) == after_winner
    assert repo.get(tid).ticket.assignee_id == "SIM-WINNER"


def test_engine_cases_is_read_only(repo, clock):
    engine = MaintenanceEngine(clock=clock, repo=repo)
    engine.reset(with_fixtures=False)
    tid = report(engine, CLEANING)
    with pytest.raises(TypeError):
        engine.cases[tid] = engine.get(tid)
    with pytest.raises(TypeError):
        engine.cases["SIM-TKT-9999"] = engine.get(tid)
    assert repo.count() == 1


def test_next_ticket_number_never_hands_out_a_number_twice(repo, clock):
    fail = {"on": False}

    def sink(rows):
        if fail["on"]:
            raise RuntimeError("audit store down")

    engine = MaintenanceEngine(clock=clock, audit_sink=sink, repo=repo)
    engine.reset(with_fixtures=False)
    first = report(engine, CLEANING)
    fail["on"] = True
    with pytest.raises(AuditWriteError):  # the ingest rolls back, its number is spent anyway
        report(engine, CLEANING)
    fail["on"] = False
    third = report(engine, CLEANING)
    assert repo.count() == 2
    assert (first, third) == ("SIM-TKT-0001", "SIM-TKT-0003")
    numbers = [repo.next_ticket_number() for _ in range(5)]
    assert len(set(numbers)) == 5 and min(numbers) > 3


def test_t09_seed_only_when_empty_and_tops_up_stock(empty_repo):
    catalog = load_catalog()
    engine = MaintenanceEngine(repo=empty_repo)
    assert seed_if_empty(engine) is True
    assert empty_repo.count() == 12
    assert empty_repo.stock() == initial_stock(catalog)
    blocker = empty_repo.get("SIM-TKT-TEC-003").ticket.blocker
    assert blocker is not None and blocker.code == "WAITING_MATERIAL"
    assert seed_if_empty(engine) is False
    assert empty_repo.count() == 12


def test_seed_never_overwrites_existing_stock(empty_repo):
    empty_repo.set_stock("SIM-MAT-LAMP-01", 42)
    seed_if_empty(MaintenanceEngine(repo=empty_repo))
    assert empty_repo.stock_of("SIM-MAT-LAMP-01") == 42


def test_t23_ledger_matches_every_doc(repo, clock):
    engine = MaintenanceEngine(clock=clock, repo=repo)
    engine.reset()
    tid = report(engine, LIGHTING)
    with pytest.raises(ActionDeniedError):
        engine.attempt(tid, BQL, Action.EDIT_RAW, field_name="original_description", new_value="x", reason="t23")
    engine.receive_stock(WAREHOUSE, "SIM-MAT-LAMP-02", 5)
    engine.run_jobs(clock.now + timedelta(days=2))
    log, notifications = repo.log_rows(), repo.notification_rows()
    for case in repo.list():
        ticket_id = case.ticket.ticket_id
        audit = [r for r in log if isinstance(r, AuditEvent) and r.ticket_id == ticket_id]
        events = [r for r in log if isinstance(r, StatusEvent) and r.ticket_id == ticket_id]
        assert len(audit) == len(case.audit), ticket_id
        assert len(events) == len(case.events), ticket_id
        assert len([n for n in notifications if n.ticket_id == ticket_id]) == len(case.notifications), ticket_id
    if not isinstance(repo, InMemoryRepository):
        with repo._engine.connect() as conn:
            assert conn.execute(text(LEDGER_SQL)).all() == []
