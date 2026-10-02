import os

# Tests never call a real LLM: env vars override anything in .env
os.environ["LLM_MODE"] = "mock"
os.environ["MO_STORE"] = "memory"  # .env on the owner's machine says MO_STORE=postgres (Supabase): tests never read it
os.environ["MO_PHOTO_STORE"] = "local"
os.environ["MO_ALLOW_RESET"] = "false"

from unittest.mock import AsyncMock  # noqa: E402
from urllib.parse import urlsplit  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from src.main import app  # noqa: E402

LOCAL_TEST_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "db"})


def pytest_addoption(parser):
    parser.addoption(
        "--pg", action="store_true", default=False, help="Run PostgreSQL tests (local docker *_test DB only)"
    )


def pytest_configure(config):
    config.addinivalue_line("markers", "pg: needs a real PostgreSQL; runs only with --pg on local docker")
    if not config.getoption("--pg"):
        return
    url = os.environ.get("MO_TEST_DATABASE_URL", "")
    parts = urlsplit(url)
    host, database = (parts.hostname or "").lower(), parts.path.lstrip("/")
    if not url:
        pytest.exit("--pg needs MO_TEST_DATABASE_URL (local docker *_test database)", returncode=4)
    if host not in LOCAL_TEST_HOSTS or not database.endswith("_test"):
        pytest.exit(
            f"MO_TEST_DATABASE_URL must be local docker and a *_test database (host={host!r}, db={database!r})",
            returncode=4,
        )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--pg"):
        return
    dropped = [item for item in items if item.get_closest_marker("pg") is not None]
    if dropped:
        config.hook.pytest_deselected(items=dropped)
        items[:] = [item for item in items if item.get_closest_marker("pg") is None]


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
