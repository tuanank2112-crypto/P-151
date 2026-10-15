"""Plan 26: login tokens are signed, so serverless instances that share no memory agree on who is logged in.

On Vercel each concurrent request may run in another instance of the backend; with sessions kept in memory a token
from one instance was unknown to the next (production 2026-10-15: 200 and 401 interleaved right after a login).
"""

import pytest
from fastapi.testclient import TestClient

from src.api.auth import SESSION_TTL_SECONDS, AuthService, get_auth, load_accounts
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine

PASSWORD = "Demo@2026"
ACCOUNTS = {a.username: a for a in load_accounts().accounts}
KEY = b"k" * 32


def instance(secret: bytes = KEY, wall=None) -> AuthService:
    return AuthService(ACCOUNTS, secret=secret, **({"wall": wall} if wall else {}))


def test_a_token_from_one_instance_is_valid_in_another_with_the_same_key():
    first, second = instance(), instance()  # both alive: two processes at the same time
    token, account = first.login("bql01", PASSWORD)
    assert second.account_for(token) == account


def test_another_key_or_a_changed_token_is_refused():
    token, _ = instance().login("bql01", PASSWORD)
    assert instance(b"x" * 32).account_for(token) is None
    version, payload, signature = token.split(".")
    other, _ = instance().login("cudan01", PASSWORD)
    assert instance().account_for(f"{version}.{other.split('.')[1]}.{signature}") is None  # payload swapped
    for junk in ("", "forged", "v1..", "v1.abc.def", f"v2.{payload}.{signature}", "v1.ẞ.ü", token + "x"):
        assert instance().account_for(junk) is None


def test_the_token_expires_by_the_wall_clock():
    now = [1_800_000_000.0]
    service = instance(wall=lambda: now[0])
    token, _ = service.login("bql01", PASSWORD)
    now[0] += SESSION_TTL_SECONDS - 1
    assert service.account_for(token) is not None
    now[0] += 1
    assert service.account_for(token) is None


def test_logout_is_remembered_by_the_instance_that_received_it():
    first = instance()
    token, _ = first.login("bql01", PASSWORD)
    first.logout(token)
    assert first.account_for(token) is None
    first.logout("garbage")  # never raises


@pytest.fixture
def two_instances():
    """Every request goes to the next of two instances, as concurrent requests do on Vercel."""
    engine = MaintenanceEngine()
    engine.reset()
    pool, turn = [instance(), instance()], [0]

    def next_instance():
        turn[0] += 1
        return pool[turn[0] % 2]

    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[get_auth] = next_instance
    yield TestClient(app), pool
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(get_auth, None)


def test_api_requests_spread_over_instances_stay_logged_in(two_instances):
    client, _ = two_instances
    body = client.post("/api/v1/auth/login", json={"username": "quanly", "password": "123456"}).json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    codes = [
        client.get(path, headers=headers).status_code for path in ["/api/v1/bql/tickets", "/api/v1/mo/tickets"] * 3
    ]
    assert codes == [200] * 6
    assert client.get("/api/v1/auth/me", headers=headers).json()["username"] == "quanly"
