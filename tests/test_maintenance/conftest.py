import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.store.postgres import ALEMBIC_INI, PostgresRepository, sql_engine
from tests.test_maintenance.helpers import MONDAY_9AM, Clock


@pytest.fixture
def engine() -> MaintenanceEngine:
    """Engine with the 12 fixture tickets replayed at their own created_at."""
    e = MaintenanceEngine()
    e.reset()
    return e


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def fresh(clock) -> MaintenanceEngine:
    """Empty engine on a controllable clock, so duplicate checks and SLAs only see what the test creates."""
    e = MaintenanceEngine(clock=clock)
    e.reset(with_fixtures=False)
    return e


# ---------------------------------------------------------------------- PostgreSQL (--pg, local docker *_test only)


@pytest.fixture(scope="session")
def pg_url() -> str:
    url = os.environ["MO_TEST_DATABASE_URL"]  # pytest_configure already checked host and database name
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["database_url"] = url
    command.upgrade(cfg, "head")
    return url


PG_CLEAN = [
    "truncate maintops.audit_log, maintops.notifications, maintops.cases, maintops.sessions restart identity",
    "delete from maintops.stock",
    "update maintops.meta set value = 0 where key = 'run_number'",
    "select setval('maintops.ticket_number_seq', 1, false)",
]


@pytest.fixture
def pg_repo(pg_url) -> PostgresRepository:
    """Every pg test starts from an empty store with an empty stock table."""
    with sql_engine(pg_url).begin() as conn:
        for statement in PG_CLEAN:
            conn.execute(text(statement))
    return PostgresRepository(pg_url)


def restart_pg(url: str) -> None:
    """Pretend the process restarted: drop the pool, the next sql_engine(url) builds a new one."""
    sql_engine(url).dispose()
    sql_engine.cache_clear()
