"""Guards around persistence that need no database (plan #01, TESTING-ACCEPTANCE §3: T12b, T14, T14b, T27)."""

import os
import subprocess
import sys

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

from src.config import get_settings
from src.maintenance.store.postgres import ALEMBIC_INI, HEAD_REVISION, connect_args_for

SUPABASE_POOLER = "aws-0-ap-southeast-1.pooler.supabase.com"


def test_t12b_head_revision_matches_alembic_head():
    assert HEAD_REVISION == ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg2://u:p@aws-0-ap-southeast-1.pooler.supabase.invalid:5432/postgres_test",
        "postgresql+psycopg2://u:p@localhost:5432/p151",
    ],
)
def test_t14_pg_tests_refuse_anything_but_a_local_test_database(url):
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--pg", "-q", "-p", "no:cacheprovider", "tests/test_api/test_routes.py"],
        env={**os.environ, "MO_TEST_DATABASE_URL": url, "PYTHONIOENCODING": "utf-8"},
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )
    assert result.returncode == 4
    assert "MO_TEST_DATABASE_URL" in result.stdout + result.stderr


def test_t14b_test_environment_is_forced_to_memory():
    settings = get_settings()
    assert settings.mo_store == "memory"
    assert settings.mo_photo_store == "local"
    assert settings.mo_allow_reset is False


def test_t27_database_url_checks_never_leak_the_password():
    with pytest.raises(RuntimeError, match="DATABASE_URL") as wrong_driver:
        connect_args_for("postgres://u:secretpw@h/db")
    assert "secretpw" not in str(wrong_driver.value)

    with pytest.raises(RuntimeError, match="DATABASE_URL") as unparsable:
        connect_args_for("not a url at all ://")
    # `from None`: the parser's own error (older SQLAlchemy put the whole URL in it) is not chained into tracebacks
    assert unparsable.value.__cause__ is None and unparsable.value.__suppress_context__ is True

    with pytest.raises(RuntimeError, match="6543"):
        connect_args_for(f"postgresql://u:p@{SUPABASE_POOLER}:6543/postgres")
    with pytest.raises(RuntimeError, match="sslmode=require"):
        connect_args_for(f"postgresql://u:p@{SUPABASE_POOLER}:5432/postgres?sslmode=disable")
    assert connect_args_for(f"postgresql://u:p@{SUPABASE_POOLER}:5432/postgres") == {
        "connect_timeout": 10,
        "sslmode": "require",
    }
    assert connect_args_for(f"postgresql://u:p@{SUPABASE_POOLER}:5432/postgres?sslmode=verify-full") == {
        "connect_timeout": 10
    }
    assert connect_args_for("postgresql+psycopg2://p151:p151@localhost:5432/p151") == {"connect_timeout": 10}
