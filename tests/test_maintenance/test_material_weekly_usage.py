"""Plan 19 D11: GET /warehouse/usage sums what the departments used in the last 7 days (finished tickets only)."""

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine
from tests.test_maintenance.helpers import BQL, CLN, LIGHTING, MONDAY_9AM, TEC, WAREHOUSE, Clock, report, to_ready

LAMP = "SIM-MAT-LAMP-01"


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def eng(clock) -> MaintenanceEngine:
    e = MaintenanceEngine(clock=clock)
    e.reset(with_fixtures=False)
    return e


@pytest.fixture
def api(eng):
    app.dependency_overrides[get_engine] = lambda: eng
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def usage(api, actor, **params):
    return api.get("/api/v1/mo/warehouse/usage", params=params, headers={"X-Actor-Id": actor})


def finished_with_lamps(eng) -> str:
    tid = report(eng, LIGHTING)
    to_ready(eng, tid)
    return tid


def test_finished_ticket_counts_once_with_its_used_quantity(api, eng):
    tid = finished_with_lamps(eng)
    used = [m.used_qty for m in eng.get(tid).material_lines if m.item_code == LAMP]
    reply = usage(api, WAREHOUSE)
    assert reply.status_code == 200, reply.text
    rows = {r["item_code"]: r for r in reply.json()}
    assert used and used[0] > 0 and rows[LAMP]["used_qty"] == used[0] and rows[LAMP]["tickets"] == 1


def test_ticket_older_than_the_window_is_left_out(api, eng, clock):
    finished_with_lamps(eng)
    clock.advance(days=8)  # the finish was 8 days ago
    assert usage(api, WAREHOUSE).json() == []
    assert usage(api, WAREHOUSE, days=31).json() != []


def test_unfinished_work_is_not_counted(api, eng):
    tid = report(eng, LIGHTING)
    eng.accept(tid, TEC)  # accepted, nothing finished yet
    assert usage(api, WAREHOUSE).json() == []


def test_only_warehouse_and_bql_may_read(api, eng):
    finished_with_lamps(eng)
    assert usage(api, BQL).status_code == 200
    assert usage(api, CLN).status_code == 403
    assert usage(api, TEC).status_code == 403
    assert usage(api, WAREHOUSE, days=0).status_code == 422
