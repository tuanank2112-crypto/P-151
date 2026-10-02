"""Login, sessions and role-scoped access with the real test accounts (header auth off, as in the running app)."""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from src.api.auth import MAX_FAILED_LOGINS, AuthService, get_auth, load_accounts, verify_password
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.catalog import load_catalog
from src.maintenance.engine import MaintenanceEngine

PASSWORD = "Demo@2026"
MORNING = "2026-09-28T09:00:00+07:00"


@pytest.fixture
def client():
    engine = MaintenanceEngine()
    engine.reset()
    auth = AuthService({a.username: a for a in load_accounts().accounts})
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[get_auth] = lambda: auth
    yield TestClient(app)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(get_auth, None)


def login(client, username):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_every_account_maps_to_a_catalog_actor():
    catalog = load_catalog()
    data = load_accounts()
    assert data.synthetic
    roles = {catalog.actor_role(a.actor_id) for a in data.accounts}
    assert None not in roles
    assert {"RESIDENT", "BPTN", "DEPARTMENT", "WAREHOUSE", "BQL", "QA_INTERNAL"} <= {r.value for r in roles}
    assert len({a.actor_id for a in data.accounts}) == len(data.accounts)  # one account per actor
    assert all(a.password_hash.startswith("pbkdf2_sha256$") for a in data.accounts)
    assert all(verify_password(PASSWORD, a.password_hash) for a in data.accounts)


def test_login_returns_the_role_and_department(client):
    body = client.post("/api/v1/auth/login", json={"username": "kythuat01", "password": PASSWORD}).json()
    assert body["user"]["role"] == "DEPARTMENT" and body["user"]["department_id"] == "DEPT_TECHNICAL"
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}).json()
    assert me["username"] == "kythuat01"


def test_wrong_password_and_unknown_user_look_the_same(client):
    wrong = client.post("/api/v1/auth/login", json={"username": "bql01", "password": "nope"})
    unknown = client.post("/api/v1/auth/login", json={"username": "ghost", "password": "nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_lockout_after_repeated_failures(client):
    for _ in range(MAX_FAILED_LOGINS):
        client.post("/api/v1/auth/login", json={"username": "bql01", "password": "nope"})
    locked = client.post("/api/v1/auth/login", json={"username": "bql01", "password": PASSWORD})
    assert locked.status_code == 429


def test_no_token_or_bare_actor_header_is_rejected(client):
    assert client.get("/api/v1/mo/tickets").status_code == 401
    assert client.get("/api/v1/mo/tickets", headers={"X-Actor-Id": "SIM-ACTOR-BQL-01"}).status_code == 401
    assert client.get("/api/v1/mo/tickets", headers={"Authorization": "Bearer forged"}).status_code == 401


def test_logout_ends_the_session(client):
    headers = login(client, "bql01")
    assert client.get("/api/v1/bql/tickets", headers=headers).status_code == 200
    client.post("/api/v1/auth/logout", headers=headers)
    assert client.get("/api/v1/bql/tickets", headers=headers).status_code == 401


def test_resident_cannot_read_internal_data(client):
    headers = login(client, "cudan01")
    assert client.get("/api/v1/mo/tickets", headers=headers).status_code == 403
    assert client.get("/api/v1/mo/tickets/SIM-TKT-CLN-001", headers=headers).status_code == 403
    assert client.get("/api/v1/bql/tickets", headers=headers).status_code == 403
    assert client.get("/api/v1/resident/tickets", headers=headers).status_code == 200


def test_residents_are_separate(client):
    first, second = login(client, "cudan01"), login(client, "cudan02")
    created = client.post(
        "/api/v1/resident/tickets",
        json={"original_description": "Hành lang tầng 7 tòa SIM-B nhiều rác", "simulated_received_at": MORNING},
        headers=first,
    ).json()
    assert created["ticket_id"] in [
        t["ticket_id"] for t in client.get("/api/v1/resident/tickets", headers=first).json()
    ]
    assert client.get("/api/v1/resident/tickets", headers=second).json() == []
    assert client.get(f"/api/v1/resident/tickets/{created['ticket_id']}", headers=second).status_code == 404


def test_department_sees_only_tickets_handed_to_it(client):
    cleaning = login(client, "vesinh01")
    rows = client.get("/api/v1/mo/tickets", headers=cleaning).json()
    assert rows and all(r["department_id"] == "DEPT_CLEANING" for r in rows)
    # A technical ticket, and a technical ticket not handed over yet, are both invisible
    assert client.get("/api/v1/mo/tickets/SIM-TKT-TEC-001", headers=cleaning).status_code == 404
    assert client.get("/api/v1/mo/tickets/SIM-TKT-TEC-002", headers=login(client, "kythuat01")).status_code == 404
    assert client.post("/api/v1/mo/tickets/SIM-TKT-TEC-004/accept", headers=cleaning).status_code == 403


def test_warehouse_sees_only_tickets_waiting_for_material(client):
    headers = login(client, "kho01")
    rows = client.get("/api/v1/mo/tickets", headers=headers).json()
    assert [r["ticket_id"] for r in rows] == ["SIM-TKT-TEC-003"]
    assert client.get("/api/v1/mo/tickets/SIM-TKT-CLN-001", headers=headers).status_code == 404


def test_only_bql_closes_and_only_qa_controls_the_demo(client):
    qa, bql, bptn = login(client, "qa01"), login(client, "bql01"), login(client, "bptn01")
    for headers in (bql, bptn):
        assert client.post("/api/v1/mo/reset", headers=headers).status_code == 403
        assert client.post("/api/v1/mo/jobs/run", json={}, headers=headers).status_code == 403
    assert client.post("/api/v1/mo/demo/SIM-TKT-CLN-001", headers=qa).status_code == 200  # → READY_FOR_REVIEW
    assert client.post("/api/v1/bql/tickets/SIM-TKT-CLN-001/close", json={}, headers=bptn).status_code == 403
    assert client.post("/api/v1/bql/tickets/SIM-TKT-CLN-001/close", json={}, headers=qa).status_code == 403
    closed = client.post("/api/v1/bql/tickets/SIM-TKT-CLN-001/close", json={}, headers=bql).json()
    assert closed["ticket"]["status"] == "CLOSED"
    assert client.post("/api/v1/mo/reset", headers=qa).status_code == 200


def test_demo_accounts_list_has_no_hashes(client):
    body = client.get("/api/v1/auth/demo-accounts").json()
    assert {a["username"] for a in body["accounts"]} >= {
        "cudan01",
        "bptn01",
        "vesinh01",
        "kythuat01",
        "kho01",
        "bql01",
        "qa01",
    }
    assert "password_hash" not in str(body)


def test_lockout_is_per_client_so_others_cannot_lock_a_user_out():
    auth = AuthService({a.username: a for a in load_accounts().accounts})
    for _ in range(MAX_FAILED_LOGINS):
        with pytest.raises(HTTPException):
            auth.login("bql01", "nope", client="10.0.0.66")
    with pytest.raises(HTTPException) as locked:
        auth.login("bql01", PASSWORD, client="10.0.0.66")
    assert locked.value.status_code == 429
    token, account = auth.login("bql01", PASSWORD, client="10.0.0.7")
    assert token and account.username == "bql01"
