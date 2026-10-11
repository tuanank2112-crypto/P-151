"""Plan 12 SPEC-P01 (planning/12_2026-10-09_backend-latency): reads outside a transaction use a separate AUTOCOMMIT
engine without pre-ping, and retry exactly once when the server dropped the pooled connection. Local docker only (--pg)."""

import pytest
from sqlalchemy import event, text
from sqlalchemy.exc import ProgrammingError

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.store.postgres import PostgresRepository, sql_engine, sql_read_engine

from .helpers import RESIDENT, report

pytestmark = pytest.mark.pg

FRESH = "Sảnh thang máy tầng 9 tòa S2 nhiều rác, cần vệ sinh."


def _single_connection_repo(pg_url: str) -> PostgresRepository:
    """A fresh read pool, so the next read reuses exactly the connection the test inspects."""
    sql_read_engine(pg_url).dispose()
    sql_read_engine.cache_clear()
    return PostgresRepository(pg_url)


class _Statements:
    def __init__(self, engine):
        self.engine, self.seen = engine, []

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._seen)
        return self

    def __exit__(self, *exc_info):
        event.remove(self.engine, "before_cursor_execute", self._seen)

    def _seen(self, conn, cursor, statement, parameters, context, executemany):
        if "maintops." in statement:
            self.seen.append(statement)


def test_t1_reads_go_through_the_autocommit_engine(pg_repo, pg_url, clock):
    engine = MaintenanceEngine(clock=clock, repo=pg_repo)
    tid = report(engine, FRESH, RESIDENT)
    repo = _single_connection_repo(pg_url)
    with _Statements(sql_read_engine(pg_url)) as reads, _Statements(sql_engine(pg_url)) as writes:
        assert repo.get(tid).ticket.ticket_id == tid
        assert [c.ticket.ticket_id for c in repo.list()] == [tid]
        repo.stock()
    assert len(reads.seen) == 3 and writes.seen == []
    assert repo._read(lambda conn: conn.connection.dbapi_connection.autocommit) is True
    # writes keep their transaction on the write engine
    assert sql_engine(pg_url).pool._pre_ping and not sql_read_engine(pg_url).pool._pre_ping


def test_t2_a_dropped_connection_is_retried_once(pg_repo, pg_url, clock):
    engine = MaintenanceEngine(clock=clock, repo=pg_repo)
    tid = report(engine, FRESH, RESIDENT)
    repo = _single_connection_repo(pg_url)
    pid = repo._read(lambda conn: conn.execute(text("select pg_backend_pid()")).scalar_one())
    with sql_engine(pg_url).begin() as conn:  # the server closes the pooled read connection (idle pooler timeout)
        assert conn.execute(text("select pg_terminate_backend(:p)"), {"p": pid}).scalar_one() is True
    assert repo.get(tid).ticket.ticket_id == tid
    again = repo._read(lambda conn: conn.execute(text("select pg_backend_pid()")).scalar_one())
    assert again != pid


def test_t3_other_errors_are_not_retried(pg_repo, pg_url):
    repo = _single_connection_repo(pg_url)
    calls = []

    def broken(conn):
        calls.append(1)
        return conn.execute(text("select * from maintops.no_such_table")).all()

    with pytest.raises(ProgrammingError):
        repo._read(broken)
    assert calls == [1]
