"""Persistence seen from the API, without a database (plan #01, TESTING-ACCEPTANCE §3: T10, T25, T26, T29)."""

from contextlib import contextmanager
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers import maintenance
from src.config import get_settings
from src.main import app
from src.maintenance.catalog import load_catalog
from src.maintenance.engine import InvalidTransitionError, MaintenanceEngine, initial_stock
from src.maintenance.store.base import ConcurrencyError, StorePermissionError, StoreUnavailableError
from src.maintenance.store.memory import InMemoryRepository
from tests.test_maintenance.helpers import CLN, report

QA = {"X-Actor-Id": "SIM-ACTOR-QA-01"}
BQL = {"X-Actor-Id": "SIM-ACTOR-BQL-01"}
CLN_HEADER = {"X-Actor-Id": CLN}
FRESH_CLEANING = "Sảnh thang máy tầng 9 tòa S2 nhiều rác, cần vệ sinh."  # no fixture ticket like it: ROUTED


class FlakyRepository(InMemoryRepository):
    """Memory store whose DB-facing calls can be told to fail like PostgreSQL would."""

    def __init__(self):
        super().__init__(initial_stock(load_catalog()))
        self.fail_append = False
        self.fail_list = False
        self.fail_wipe = False

    @contextmanager
    def transaction(self):
        with super().transaction() as tx:
            if self.fail_append:

                def append_log(rows):
                    raise StoreUnavailableError("Không kết nối được cơ sở dữ liệu; thử lại sau")

                tx.append_log = append_log
            yield tx

    def list(self):
        if self.fail_list:
            raise StoreUnavailableError("Không kết nối được cơ sở dữ liệu; thử lại sau")
        return super().list()

    def wipe(self, stock):
        if self.fail_wipe:
            raise StorePermissionError("User DB không có quyền cho thao tác này (cần owner)")
        return super().wipe(stock)


@pytest.fixture
def flaky(clock):
    repo = FlakyRepository()
    engine = MaintenanceEngine(clock=clock, repo=repo)
    engine.reset()
    app.dependency_overrides[maintenance.get_engine] = lambda: engine
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield engine, repo, TestClient(app, headers=QA)
    app.dependency_overrides.pop(maintenance.get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def _settings(monkeypatch, **changes):
    settings = get_settings().model_copy(update=changes)
    monkeypatch.setattr(maintenance, "get_settings", lambda: settings)


def test_t10_reset_and_evaluate_are_gated_on_a_shared_database(flaky, monkeypatch):
    engine, _, api = flaky
    _settings(monkeypatch, mo_store="postgres", mo_allow_reset=False)
    for path in ("/api/v1/mo/reset", "/api/v1/mo/evaluate"):
        response = api.post(path)
        assert response.status_code == 403 and response.json()["detail"]["code"] == "RESET_DISABLED", path
        response = api.post(path, headers=BQL)  # the role is checked first
        assert response.status_code == 403 and response.json()["detail"]["code"] == "ACTION_DENIED", path
    assert len(engine.cases) == 12

    _settings(monkeypatch, mo_store="postgres", mo_allow_reset=True)
    assert api.post("/api/v1/mo/reset").status_code == 200
    assert api.post("/api/v1/mo/evaluate").status_code == 200


def test_t25_store_errors_map_to_the_right_http_status(flaky):
    engine, repo, api = flaky
    tid = report(engine, FRESH_CLEANING)

    repo.fail_append = True
    response = api.post(f"/api/v1/mo/tickets/{tid}/accept", headers=CLN_HEADER)
    assert response.status_code == 503 and response.json()["detail"]["code"] == "STORE_UNAVAILABLE"
    repo.fail_append = False
    assert engine.get(tid).ticket.status == "ROUTED"  # nothing was written

    repo.fail_list = True
    response = api.get("/api/v1/mo/tickets")
    assert response.status_code == 503 and response.json()["detail"]["code"] == "STORE_UNAVAILABLE"
    repo.fail_list = False

    repo.fail_wipe = True
    response = api.post("/api/v1/mo/reset")
    assert response.status_code == 403 and response.json()["detail"]["code"] == "STORE_PERMISSION_DENIED"


def test_t26_concurrent_update_is_409(flaky, monkeypatch):
    engine, _, api = flaky
    tid = report(engine, FRESH_CLEANING)

    def accept(ticket_id, actor_id):
        raise ConcurrencyError("Ticket vừa bị thay đổi bởi thao tác khác; tải lại rồi thử lại", {"ticket_id": tid})

    monkeypatch.setattr(engine, "accept", accept)
    response = api.post(f"/api/v1/mo/tickets/{tid}/accept", headers=CLN_HEADER)
    assert response.status_code == 409 and response.json()["detail"]["code"] == "CONCURRENT_UPDATE"


def test_t29_transition_is_checked_again_under_the_lock(fresh, clock, monkeypatch):
    tid = report(fresh, FRESH_CLEANING)
    stale = fresh.get(tid).model_copy(deep=True)  # what another backend read before the change below
    assert stale.ticket.status == "ROUTED"
    fresh.accept(tid, CLN)
    fresh.block_onsite(tid, CLN, note="Khu vực đang sơn", eta=clock.now + timedelta(hours=3))
    monkeypatch.setattr(fresh, "get", lambda ticket_id: stale)
    with pytest.raises(InvalidTransitionError):
        fresh.accept(tid, CLN)  # without the re-check this would silently become resume_work
    assert fresh.repo.get(tid).ticket.status == "ON_HOLD"
