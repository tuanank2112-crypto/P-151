"""Alembic environment for the `maintops` schema (plan #01, 01-CONTRACTS §7.2). Online mode only."""

import sys
from pathlib import Path

import sqlalchemy as sa
from alembic import context
from sqlalchemy import text
from sqlalchemy.engine import make_url

REPO_ROOT = Path(__file__).resolve().parents[4]  # env.py → migrations → store → maintenance → src → root
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.config import get_settings  # noqa: E402
from src.maintenance.store.postgres import SCHEMA, connect_args_for  # noqa: E402

config = context.config


def run_migrations_online() -> None:
    url = config.attributes.get("database_url") or get_settings().database_url
    target = make_url(url)
    print(f"alembic -> host={target.host} db={target.database} user={target.username}")  # never the password
    engine = sa.create_engine(url, connect_args=connect_args_for(url))
    try:
        with engine.connect() as connection:
            # alembic_version lives in this schema, so it must exist before Alembic starts
            connection.execute(text(f"create schema if not exists {SCHEMA}"))
            connection.commit()
            context.configure(
                connection=connection,
                version_table_schema=SCHEMA,
                transaction_per_migration=True,
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    raise RuntimeError("maintops migrations chỉ chạy online")
run_migrations_online()
