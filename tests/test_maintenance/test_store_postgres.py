"""PostgreSQL-only behaviour (plan #01, TESTING-ACCEPTANCE §3): locks, sequence, restart, startup, leases, ledgers.

Runs only with `--pg` against a local docker `*_test` database (tests/conftest.py refuses anything else).
"""

import threading
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.exc import InternalError

from src.api.auth import actor_header_allowed
from src.api.routers import maintenance
from src.config import get_settings
from src.main import app
from src.maintenance.engine import ActionDeniedError, MaintenanceEngine, build_engine
from src.maintenance.enums import Action
from src.maintenance.store.base import ConcurrencyError, GuardError, UnstorableTextError
from src.maintenance.store.postgres import HEAD_REVISION, PostgresRepository, sql_engine, sql_read_engine
from tests.test_maintenance.conftest import restart_pg
from tests.test_maintenance.helpers import BQL, CLEANING, CLN, RESIDENT, WAREHOUSE, report

pytestmark = pytest.mark.pg

NEEDS_INFO = "Tầng 3 ở S4 quá nhiều rác"  # no building, no area: the ticket stops at NEED_INFO
PNG_REF = "0123456789abcdef0123456789abcdef.png"
FRESH_CLEANING = "Sảnh thang máy tầng 9 tòa S2 nhiều rác, cần vệ sinh."  # no fixture ticket like it: ROUTED


def _pg_settings(url: str, **changes):
    return get_settings().model_copy(update={"mo_store": "postgres", "database_url": url, **changes})


def _run_parallel(*jobs) -> list[BaseException]:
    """Start the jobs together; return what they raised."""
    barrier = threading.Barrier(len(jobs))
    errors: list[BaseException] = []

    def runner(job):
        barrier.wait()
        try:
            job()
        except BaseException as exc:  # collected and asserted by the test
            errors.append(exc)

    threads = [threading.Thread(target=runner, args=(job,)) for job in jobs]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    return errors


class _SqlCounter:
    """Counts statements that touch the maintops schema on one SQLAlchemy engine."""

    def __init__(self, url: str):
        self.engines = (sql_engine(url), sql_read_engine(url))  # plan 12: reads use the AUTOCOMMIT engine
        self.count = 0

    def __enter__(self):
        for engine in self.engines:
            event.listen(engine, "before_cursor_execute", self._seen)
        return self

    def __exit__(self, *exc_info):
        for engine in self.engines:
            event.remove(engine, "before_cursor_execute", self._seen)

    def _seen(self, conn, cursor, statement, parameters, context, executemany):
        if "maintops." in statement:
            self.count += 1


# ---------------------------------------------------------------------- transactions and concurrency


def test_t04_two_processes_editing_one_ticket_both_land(pg_repo, pg_url, clock):
    engine_a = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine_a.reset(with_fixtures=False)
    tid = report(engine_a, NEEDS_INFO)
    assert pg_repo.get(tid).ticket.status == "NEED_INFO"
    engine_b = MaintenanceEngine(clock=clock, repo=PostgresRepository(pg_url))
    before = pg_repo.version_of(tid)

    errors = _run_parallel(
        lambda: engine_a.add_resident_info(tid, RESIDENT, "Bổ sung A: có mùi hôi"),
        lambda: engine_b.add_resident_info(tid, RESIDENT, "Bổ sung B: rác tràn ra lối đi"),
    )

    assert errors == []
    contents = {a.content for a in pg_repo.get(tid).additions}
    assert {"Bổ sung A: có mùi hôi", "Bổ sung B: rác tràn ra lối đi"} <= contents
    assert pg_repo.version_of(tid) == before + 2


def test_t05_pg_stale_save_raises_concurrency_error(pg_repo, clock):
    engine = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine.reset(with_fixtures=False)
    tid = report(engine, CLEANING)
    before = pg_repo.version_of(tid)
    with pytest.raises(ConcurrencyError):
        with pg_repo.transaction() as tx:
            stale = tx.get_for_update(tid).model_copy(deep=True)
            tx.conn.execute(text("update maintops.cases set version = version + 1 where ticket_id = :id"), {"id": tid})
            stale.ticket.cancel_reason = "SIM-LOSER"
            tx.save(stale)
    assert pg_repo.version_of(tid) == before
    assert pg_repo.get(tid).ticket.cancel_reason is None


def test_two_processes_cannot_both_issue_the_last_stock(pg_repo, pg_url):
    """`take_stock` is one conditional UPDATE: of two takes of the last 3 units, exactly one lands."""
    pg_repo.set_stock("SIM-MAT-LAMP-01", 3)
    pg_repo.set_stock("SIM-MAT-LAMP-02", None)
    other = PostgresRepository(pg_url)

    def take(repo):
        with repo.transaction() as tx:
            tx.take_stock("SIM-MAT-LAMP-01", 3)

    errors = _run_parallel(lambda: take(pg_repo), lambda: take(other))

    assert [type(e) for e in errors] == [GuardError]
    assert pg_repo.stock_of("SIM-MAT-LAMP-01") == 0
    with pg_repo.transaction() as tx:
        assert tx.take_stock("SIM-MAT-LAMP-02", 5) is None  # unknown stock stays unknown (D-05)
        assert tx.take_stock("SIM-MAT-LAMP-01", -2) == 2  # a return puts it back
    assert pg_repo.stock_of("SIM-MAT-LAMP-02") is None


def test_nested_transaction_on_one_thread_is_refused(pg_repo):
    with pg_repo.transaction():
        with pytest.raises(RuntimeError, match="lồng nhau"):
            with pg_repo.transaction():
                pass


def test_t06_ticket_numbers_never_collide_across_processes(pg_repo, pg_url, clock):
    engine_a = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine_a.reset(with_fixtures=False)
    engine_b = MaintenanceEngine(clock=clock, repo=PostgresRepository(pg_url))
    ids: list[str] = []

    def ten(engine):
        for _ in range(10):
            ids.append(report(engine, CLEANING))

    assert _run_parallel(lambda: ten(engine_a), lambda: ten(engine_b)) == []
    assert len(ids) == 20 and len(set(ids)) == 20
    assert all(tid.startswith("SIM-TKT-") and len(tid) == 12 and tid[8:].isdigit() for tid in ids)


# ---------------------------------------------------------------------- restart


def _state(repo) -> tuple:
    return (
        {case.ticket.ticket_id: case.model_dump(mode="json") for case in repo.list()},
        repo.stock(),
        [row.model_dump(mode="json") for row in repo.log_rows()],
        [row.model_dump(mode="json") for row in repo.notification_rows()],
    )


def test_t07_restart_keeps_everything(pg_repo, pg_url, clock):
    engine_a = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine_a.reset()
    tid = report(engine_a, CLEANING)
    engine_a.add_resident_photo(tid, RESIDENT, PNG_REF)
    engine_a.receive_stock(WAREHOUSE, "SIM-MAT-LAMP-02", 5)
    with pytest.raises(ActionDeniedError):
        engine_a.attempt(tid, BQL, Action.EDIT_RAW, field_name="original_description", new_value="x", reason="t07")
    before, run_id = _state(pg_repo), engine_a.run_id

    restart_pg(pg_url)
    repo_b = PostgresRepository(pg_url)
    engine_b = MaintenanceEngine(clock=clock, repo=repo_b)

    assert _state(repo_b) == before
    assert engine_b.run_id == run_id == "SIM-RUN-001"
    case = repo_b.get(tid)
    assert case.audit[-1].action == "ACTION_DENIED"
    assert case.evidence[-1].content_or_metadata == PNG_REF
    assert repo_b.stock_of("SIM-MAT-LAMP-02") == 5


def test_t08_startup_never_resets(pg_repo, pg_url, monkeypatch):
    monkeypatch.setattr(maintenance, "get_settings", lambda: _pg_settings(pg_url, mo_seed_on_empty=True))
    monkeypatch.setattr(maintenance, "_engine", None)
    engine = maintenance.get_engine()
    assert engine.repo.count() == 12
    tid = report(engine, CLEANING)
    assert engine.repo.count() == 13

    monkeypatch.setattr(maintenance, "_engine", None)  # a new process starts
    restart_pg(pg_url)
    engine = maintenance.get_engine()
    assert engine.repo.count() == 13
    assert engine.get(tid).ticket.raw.original_description == CLEANING


def test_t12_wrong_schema_revision_stops_startup(pg_repo, pg_url):
    with sql_engine(pg_url).begin() as conn:
        conn.execute(text("update maintops.alembic_version set version_num = 'x'"))
    try:
        with pytest.raises(RuntimeError, match="alembic -c src/maintenance/store/alembic.ini upgrade head"):
            build_engine(_pg_settings(pg_url))
    finally:
        with sql_engine(pg_url).begin() as conn:
            conn.execute(text("update maintops.alembic_version set version_num = :v"), {"v": HEAD_REVISION})
    build_engine(_pg_settings(pg_url))  # back to head: starts again


def test_unreachable_database_stops_startup_without_leaking_the_password():
    url = "postgresql+psycopg2://p151:topsecretpw@localhost:1/p151_test"
    with pytest.raises(RuntimeError, match="không kết nối được DATABASE_URL") as caught:
        build_engine(_pg_settings(url))
    assert "topsecretpw" not in str(caught.value)


# ---------------------------------------------------------------------- one leader, append-only ledgers


def test_t11_only_the_lease_holder_runs_the_job(pg_repo, pg_url, clock):
    engine_a = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine_a.reset()
    repo_b = PostgresRepository(pg_url)
    engine_b = MaintenanceEngine(clock=clock, repo=repo_b)
    far_future = clock.now + timedelta(days=30)

    def versions() -> int:
        return sum(repo_b.version_of(case.ticket.ticket_id) for case in repo_b.list())

    before = versions()
    with pg_repo.job_lease() as leader:
        assert leader is True
        assert engine_b.run_jobs(far_future) == []
        assert versions() == before
    assert engine_b.run_jobs(far_future) != []
    assert versions() > before


def test_t13_ledgers_are_append_only(pg_repo, pg_url, clock):
    MaintenanceEngine(clock=clock, repo=pg_repo).reset()
    for statement in ("update maintops.audit_log set run_id = 'x'", "delete from maintops.notifications"):
        with pytest.raises(InternalError) as caught:
            with sql_engine(pg_url).begin() as conn:
                conn.execute(text(statement))
        assert caught.value.orig.pgcode == "P0001"


# ---------------------------------------------------------------------- SQL budget, NUL text


@pytest.fixture
def pg_api(pg_repo, clock):
    engine = MaintenanceEngine(clock=clock, repo=pg_repo)
    engine.reset()
    app.dependency_overrides[maintenance.get_engine] = lambda: engine
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield engine, TestClient(app, headers={"X-Actor-Id": "SIM-ACTOR-QA-01"})
    app.dependency_overrides.pop(maintenance.get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def test_t24_sql_budget(pg_api, pg_url):
    engine, api = pg_api
    with _SqlCounter(pg_url) as listing:
        assert len(api.get("/api/v1/mo/tickets").json()) == 12
    assert listing.count == 1
    tid = report(engine, FRESH_CLEANING)
    with _SqlCounter(pg_url) as accepting:
        engine.accept(tid, CLN)
    assert accepting.count <= 6


def test_t28_nul_text_is_refused_and_nothing_is_written(pg_api):
    engine, api = pg_api
    before = engine.repo.count()
    with pytest.raises(UnstorableTextError):
        engine.receive("abc\x00def", resident_id=RESIDENT)
    response = api.post(
        "/api/v1/resident/tickets", json={"original_description": "abc\x00def"}, headers={"X-Actor-Id": RESIDENT}
    )
    assert response.status_code == 409 and response.json()["detail"]["code"] == "UNSTORABLE_TEXT"
    assert engine.repo.count() == before
