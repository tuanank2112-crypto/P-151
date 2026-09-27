import os

# Tests never touch Postgres or OpenAI: env vars override anything in .env
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["LLM_MODE"] = "mock"

from datetime import datetime  # noqa: E402
from unittest.mock import AsyncMock  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlmodel import Session  # noqa: E402

from src.config import get_settings  # noqa: E402
from src.db import get_session, init_db, make_engine  # noqa: E402
from src.main import app  # noqa: E402
from src.services import clock  # noqa: E402
from src.services.seed import seed_if_empty  # noqa: E402


@pytest_asyncio.fixture
async def client():
    """Async HTTP client for testing API endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_llm():
    """Mock LLM to avoid calling OpenAI during tests.

    Usage in test:
        def test_something(mock_llm):
            # LLM calls will return mock response instead of hitting OpenAI
            ...
    """
    mock = AsyncMock()
    mock.ainvoke.return_value = AsyncMock(content="Mocked LLM response")
    return mock


class FrozenClock:
    """Controllable time: tests set `.now` and move it forward to simulate deadlines."""

    def __init__(self, start: datetime):
        self.now = start

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def frozen_clock(monkeypatch) -> FrozenClock:
    # Monday 09:00, inside the seeded day shifts
    fake = FrozenClock(datetime(2026, 9, 28, 9, 0))
    monkeypatch.setattr(clock, "now", fake)
    return fake


@pytest.fixture
def api(tmp_path, monkeypatch, frozen_clock) -> TestClient:
    """TestClient on a fresh in-memory DB with seed data; uploads go to a temp folder."""
    engine = make_engine("sqlite://")
    init_db(engine)
    with Session(engine) as session:
        seed_if_empty(session)

    def override_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path / "uploads"))
    yield TestClient(app)
    app.dependency_overrides.clear()
