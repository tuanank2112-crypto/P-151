from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from src.config import get_settings


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        # In-memory SQLite must share one connection across threads (tests)
        return create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    return create_engine(url, pool_pre_ping=True)


@lru_cache
def get_engine() -> Engine:
    return make_engine(get_settings().database_url)


def init_db(engine: Engine) -> None:
    # Import tables so they register on SQLModel.metadata
    import src.models.entities  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
