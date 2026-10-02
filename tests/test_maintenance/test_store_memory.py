"""Repository contract on the in-memory store (plan #01, TESTING-ACCEPTANCE §2: T01, T02, T03, T05).

The `repo` fixture is parametrised by store kind so the Postgres repository can join the same tests later.
"""

import pytest

from src.maintenance.catalog import load_catalog
from src.maintenance.engine import (
    AuditWriteError,
    GuardError,
    MaintenanceEngine,
    initial_stock,
)
from src.maintenance.enums import Action
from src.maintenance.models import Case
from src.maintenance.store.base import ConcurrencyError
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import CLEANING, CLN, SYSTEM, report


@pytest.fixture(params=["memory"])
def repo(request) -> InMemoryRepository:
    return InMemoryRepository(initial_stock(load_catalog()))


def _snapshot(repo: InMemoryRepository, ticket_id: str) -> tuple[int, dict, int, int]:
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


def test_t05_stale_save_raises_concurrency_error(repo, clock):
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
