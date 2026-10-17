"""Tests for performance report generator and endpoints."""

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine, seed_if_empty

BQL_HEADERS = {"X-Actor-Id": "SIM-ACTOR-BQL-01"}
RESIDENT_HEADERS = {"X-Actor-Id": "SIM-ACTOR-RESIDENT-01"}


@pytest.fixture
def engine():
    e = MaintenanceEngine()
    e.reset()
    seed_if_empty(e)
    app.dependency_overrides[get_engine] = lambda: e
    yield e
    app.dependency_overrides.pop(get_engine, None)


@pytest.fixture
def client(engine):
    app.dependency_overrides[actor_header_allowed] = lambda: True
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(actor_header_allowed, None)


def test_performance_report_endpoint(client):
    res = client.get("/api/v1/bql/reports/performance", headers=BQL_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert "departments" in data
    assert "all_monthly" in data
    assert len(data["departments"]) == 4
    assert len(data["all_monthly"]) == 12
    dept_keys = {d["key"] for d in data["departments"]}
    assert dept_keys == {"bql", "tiep_nhan", "ve_sinh", "ky_thuat"}

    # Internal MO endpoint
    res_mo = client.get("/api/v1/mo/reports/performance", headers=BQL_HEADERS)
    assert res_mo.status_code == 200

    # Check role protection
    res_resident = client.get("/api/v1/bql/reports/performance", headers=RESIDENT_HEADERS)
    assert res_resident.status_code == 403
