"""Plan 09: `PostgresRepository.list()` cached by row version (`xmin`) and the resident list without N+1 reads.

T1-T7 need a real PostgreSQL (`--pg`, local docker `*_test` only); T8 runs on the memory store.
"""

import pytest
from pydantic import ValidationError
from sqlalchemy import event, text

from src.api.routers.maintenance import resident_list
from src.maintenance.catalog import load_catalog
from src.maintenance.engine import MaintenanceEngine, initial_stock
from src.maintenance.models import Case
from src.maintenance.store.memory import InMemoryRepository
from src.maintenance.store.postgres import PostgresRepository, sql_engine
from src.maintenance.views import resident_view
from tests.test_maintenance.helpers import BPTN, CLEANING, CLN, OTHER_RESIDENT, RESIDENT, report

FRESH_CLEANING = "Sảnh thang máy tầng 9 tòa S2 nhiều rác, cần vệ sinh."


def _stored(url: str) -> list[Case]:
    """What `list()` returned before plan 09: every doc, validated, in `collate "C"` order."""
    with sql_engine(url).connect() as conn:
        docs = conn.execute(text('select doc from maintops.cases order by ticket_id collate "C"')).scalars().all()
    return [Case.model_validate(doc) for doc in docs]


def _dump(cases: list[Case]) -> list[dict]:
    return [case.model_dump(mode="json") for case in cases]


class _Statements:
    """Statements that touch maintops.cases on one SQLAlchemy engine."""

    def __init__(self, url: str):
        self.engine = sql_engine(url)
        self.seen: list[str] = []

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._seen)
        return self

    def __exit__(self, *exc_info):
        event.remove(self.engine, "before_cursor_execute", self._seen)

    def _seen(self, conn, cursor, statement, parameters, context, executemany):
        if "maintops.cases" in statement:
            self.seen.append(" ".join(statement.split()))

    def single_reads(self) -> int:
        return sum(1 for s in self.seen if s.startswith("select doc from maintops.cases where ticket_id"))


@pytest.fixture
def pg_engine(pg_repo, clock) -> MaintenanceEngine:
    engine = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine.reset()  # the 12 fixture tickets
    return engine


def _merged_pair(clock, engine, child_resident=RESIDENT) -> tuple[str, str]:
    root = report(engine, CLEANING)
    clock.advance(minutes=5)
    child = report(engine, CLEANING, resident=child_resident)
    engine.bptn_resolve(child, BPTN, merge=True, note="Cùng sự cố")
    assert engine.get(child).ticket.merged_into == root
    return root, child


# ---------------------------------------------------------------------- T1-T6: list cache (--pg)


@pytest.mark.pg
def test_t1_cached_list_equals_the_stored_rows(pg_engine, pg_url):
    repo = pg_engine.repo
    assert _dump(repo.list()) == _dump(_stored(pg_url))
    assert _dump(repo.list()) == _dump(_stored(pg_url))  # warm: still the same, same order


@pytest.mark.pg
def test_t2_a_second_list_without_writes_loads_no_doc(pg_engine):
    repo = pg_engine.repo
    first = repo.list()
    misses = repo.cache_stats()["misses"]
    second = repo.list()
    assert repo.cache_stats()["misses"] == misses
    assert repo.cache_stats()["size"] == len(first) == len(second)
    assert all(a is b for a, b in zip(first, second, strict=True))  # read-only shared objects, like the memory store


@pytest.mark.pg
def test_t3_one_write_reloads_exactly_that_ticket(pg_engine, pg_url, clock):
    repo = pg_engine.repo
    tid = report(pg_engine, FRESH_CLEANING)
    repo.list()
    misses = repo.cache_stats()["misses"]
    pg_engine.accept(tid, CLN)
    listed = {case.ticket.ticket_id: case for case in repo.list()}
    assert repo.cache_stats()["misses"] == misses + 1
    assert listed[tid].ticket.status == "IN_PROGRESS"
    assert _dump(list(listed.values())) == _dump(_stored(pg_url))


@pytest.mark.pg
def test_t4_a_write_by_another_process_is_seen_on_the_next_list(pg_engine, pg_url, clock):
    repo_a = pg_engine.repo
    tid = report(pg_engine, FRESH_CLEANING)
    repo_a.list()
    other = MaintenanceEngine(clock=clock, repo=PostgresRepository(pg_url))  # its own cache, same database
    other.accept(tid, CLN)
    listed = {case.ticket.ticket_id: case for case in repo_a.list()}
    assert listed[tid].ticket.status == "IN_PROGRESS"


@pytest.mark.pg
def test_t5_wipe_and_reseed_never_returns_old_tickets(pg_engine, pg_url):
    repo = pg_engine.repo
    report(pg_engine, FRESH_CLEANING)
    before = repo.list()
    pg_engine.reset()  # wipe + the 12 fixtures again, same ticket ids
    after = repo.list()
    assert len(after) == len(before) - 1
    assert _dump(after) == _dump(_stored(pg_url))


@pytest.mark.pg
def test_t6_a_broken_doc_is_never_cached(pg_engine, pg_url):
    repo = pg_engine.repo
    good = repo.list()
    tid = good[0].ticket.ticket_id
    with sql_engine(pg_url).begin() as conn:
        original = conn.execute(text("select doc from maintops.cases where ticket_id = :id"), {"id": tid}).scalar()
        conn.execute(
            text(
                # a field this code does not know (the 2026-10-07 `merged_children` outage); status must match its column
                "update maintops.cases set doc = jsonb_set(doc, '{ticket,unknown_field}', '1') where ticket_id = :id"
            ),
            {"id": tid},
        )
    with pytest.raises(ValidationError):
        repo.list()
    assert repo.cache_stats()["size"] == len(good)  # the cache was not touched
    assert repo._list_cache[tid][1] is good[0]
    with sql_engine(pg_url).begin() as conn:
        conn.execute(
            text("update maintops.cases set doc = cast(:doc as jsonb) where ticket_id = :id"),
            {"doc": Case.model_validate(original).model_dump_json(), "id": tid},
        )
    assert _dump(repo.list()) == _dump(_stored(pg_url))


@pytest.mark.pg
def test_t6b_listing_is_one_statement_cold_and_warm(pg_engine, pg_url):
    repo = pg_engine.repo
    for _ in range(2):
        with _Statements(pg_url) as statements:
            repo.list()
        assert len(statements.seen) == 1


# ---------------------------------------------------------------------- T7-T8: resident list without N+1


@pytest.mark.pg
def test_t7_resident_list_reads_no_single_ticket(pg_repo, pg_url, clock):
    engine = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine.reset(with_fixtures=False)
    _merged_pair(clock, engine)
    with _Statements(pg_url) as statements:
        views = resident_list(RESIDENT, engine)
    assert len(views) == 2
    assert statements.single_reads() == 0
    assert len(statements.seen) == 1


@pytest.mark.parametrize("child_resident", [RESIDENT, OTHER_RESIDENT])
def test_t8_lookup_gives_the_same_view_as_fresh_reads(clock, child_resident):
    engine = MaintenanceEngine(clock=clock, repo=InMemoryRepository(initial_stock(load_catalog())))
    engine.reset(with_fixtures=False)
    root, child = _merged_pair(clock, engine, child_resident)
    snapshot = list(engine.cases.values())
    lookup = {case.ticket.ticket_id: case for case in snapshot}
    for case in snapshot:
        fresh = resident_view(engine, case, clock())
        assert resident_view(engine, case, clock(), lookup).model_dump() == fresh.model_dump()
    child_view = next(v for v in resident_list(child_resident, engine) if v.ticket_id == child)
    assert child_view.merged_into is not None and child_view.merged_into.ticket_id == root
