"""Plan 20: the Technical department is alerted when the warehouse restocks a material it uses after it ran out.

Matrix A01-A10 of planning/20_2026-10-13_stock-restock-alert/specs/TESTING-ACCEPTANCE.md.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import Department
from src.maintenance.errors import ActionDeniedError
from src.maintenance.store.base import NotFoundError
from tests.test_maintenance.helpers import BPTN, BQL, CLN, MONDAY_9AM, RESIDENT, TEC, WAREHOUSE, Clock

LAMP2 = "SIM-MAT-LAMP-02"  # Technical uses it; seeded with stock 0
CLEAN = "SIM-MAT-CLEAN-01"  # Cleaning only


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def eng(clock) -> MaintenanceEngine:
    engine = MaintenanceEngine(clock=clock)
    engine.reset(with_fixtures=False)
    return engine


def test_a01_restock_from_zero_raises_one_alert(eng, clock):
    assert eng.repo.stock_of(LAMP2) == 0
    eng.receive_stock(WAREHOUSE, LAMP2, 20)
    [alert] = eng.list_stock_alerts(TEC)
    assert (alert.item_code, alert.qty_before, alert.qty_added, alert.qty_after) == (LAMP2, 0, 20, 20)
    assert alert.department_id == Department.DEPT_TECHNICAL
    assert alert.received_by == WAREHOUSE and alert.created_at == clock.now
    assert alert.item_name and alert.unit and alert.acknowledged_at is None
    assert alert.alert_id.startswith("SIM-SAL-MAT-LAMP-02-")


def test_a02_restock_when_stock_is_positive_adds_nothing(eng):
    eng.receive_stock(WAREHOUSE, LAMP2, 20)
    eng.receive_stock(WAREHOUSE, LAMP2, 5)
    assert len(eng.list_stock_alerts(TEC)) == 1


def test_a02b_second_empty_cycle_raises_a_second_alert(eng, clock):
    eng.receive_stock(WAREHOUSE, LAMP2, 3)
    eng.repo.set_stock(LAMP2, 0)
    clock.advance(minutes=1)
    eng.receive_stock(WAREHOUSE, LAMP2, 4)
    assert len(eng.list_stock_alerts(TEC)) == 2


def test_a03_cleaning_only_material_raises_nothing(eng):
    eng.repo.set_stock(CLEAN, 0)
    eng.receive_stock(WAREHOUSE, CLEAN, 10)
    assert eng.list_stock_alerts(TEC) == []


def test_a04_untracked_stock_raises_nothing(eng):
    eng.repo.set_stock(LAMP2, None)
    eng.receive_stock(WAREHOUSE, LAMP2, 10)
    assert eng.list_stock_alerts(TEC) == []


def test_a05_flag_off_behaves_as_before(clock):
    engine = MaintenanceEngine(clock=clock, stock_alerts=False)
    engine.reset(with_fixtures=False)
    assert engine.receive_stock(WAREHOUSE, LAMP2, 20) == []
    assert engine.repo.stock_of(LAMP2) == 20
    assert engine.list_stock_alerts(TEC) == []
    with pytest.raises(NotFoundError):
        engine.acknowledge_stock_alert(TEC, "SIM-SAL-X")


def test_a06_failure_after_the_alert_rolls_back_stock_and_alert(eng, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("simulated failure")

    # the engine writes the alert inside the transaction; a failure after it must undo the stock too
    original = eng._raise_stock_alerts

    def alert_then_fail(*args, **kwargs):
        original(*args, **kwargs)
        boom()

    monkeypatch.setattr(eng, "_raise_stock_alerts", alert_then_fail)
    with pytest.raises(RuntimeError):
        eng.receive_stock(WAREHOUSE, LAMP2, 20)
    assert eng.repo.stock_of(LAMP2) == 0
    assert eng.list_stock_alerts(TEC) == []


def test_a07_only_technical_bql_and_warehouse_read_and_only_technical_bql_ack(eng):
    eng.receive_stock(WAREHOUSE, LAMP2, 20)
    for actor in (CLN, BPTN, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.list_stock_alerts(actor)
        with pytest.raises(ActionDeniedError):
            eng.acknowledge_stock_alert(actor, "SIM-SAL-X")
    assert len(eng.list_stock_alerts(BQL)) == 1 and len(eng.list_stock_alerts(WAREHOUSE)) == 1
    [alert] = eng.list_stock_alerts(TEC)
    with pytest.raises(ActionDeniedError):
        eng.acknowledge_stock_alert(WAREHOUSE, alert.alert_id)


def test_a08_ack_is_once_and_idempotent(eng, clock):
    eng.receive_stock(WAREHOUSE, LAMP2, 20)
    [alert] = eng.list_stock_alerts(TEC)
    first = eng.acknowledge_stock_alert(TEC, alert.alert_id)
    assert first.acknowledged_by == TEC and first.acknowledged_at == clock.now
    clock.advance(hours=1)
    second = eng.acknowledge_stock_alert(BQL, alert.alert_id)
    assert (second.acknowledged_by, second.acknowledged_at) == (TEC, first.acknowledged_at)
    assert eng.list_stock_alerts(TEC, unread_only=True) == []
    assert len(eng.list_stock_alerts(TEC)) == 1
    with pytest.raises(NotFoundError):
        eng.acknowledge_stock_alert(TEC, "SIM-SAL-NOPE")


def test_a09_waiting_ticket_still_resumes_and_alert_is_raised():
    engine = MaintenanceEngine(clock=Clock(MONDAY_9AM))  # the 12 fixture tickets: SIM-TKT-TEC-003 waits for LAMP-02
    engine.reset()
    engine.clock = Clock(MONDAY_9AM)
    tid = "SIM-TKT-TEC-003"
    assert engine.get(tid).ticket.blocker.code == "WAITING_MATERIAL"
    [case] = engine.receive_stock(WAREHOUSE, LAMP2, 2)
    assert case.ticket.status == "ROUTED" and case.ticket.blocker is None
    [alert] = engine.list_stock_alerts(TEC)
    assert alert.ticket_ids == (tid,)  # the alert names the ticket the restock lets continue


def test_alerts_are_newest_first(eng, clock):
    eng.receive_stock(WAREHOUSE, LAMP2, 1)
    eng.repo.set_stock(LAMP2, 0)
    clock.advance(minutes=5)
    eng.receive_stock(WAREHOUSE, LAMP2, 2)
    created = [a.created_at for a in eng.list_stock_alerts(TEC)]
    assert created == sorted(created, reverse=True)


# ---------------------------------------------------------------------- HTTP


@pytest.fixture
def api(eng):
    app.dependency_overrides[get_engine] = lambda: eng
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def _as(actor: str) -> dict[str, str]:
    return {"X-Actor-Id": actor}


def test_api_receive_then_read_then_ack(api):
    r = api.post(f"/api/v1/mo/warehouse/stock/{LAMP2}", json={"qty": 20}, headers=_as(WAREHOUSE))
    assert r.status_code == 200, r.text
    rows = api.get("/api/v1/mo/stock-alerts?unread=true", headers=_as(TEC)).json()
    assert len(rows) == 1 and rows[0]["qty_after"] == 20 and rows[0]["acknowledged_at"] is None
    ack = api.post(f"/api/v1/mo/stock-alerts/{rows[0]['alert_id']}/ack", headers=_as(TEC))
    assert ack.status_code == 200 and ack.json()["acknowledged_by"] == TEC
    assert api.get("/api/v1/mo/stock-alerts?unread=true", headers=_as(TEC)).json() == []
    assert len(api.get("/api/v1/mo/stock-alerts", headers=_as(TEC)).json()) == 1


def test_api_denials_and_unknown_alert(api):
    assert api.get("/api/v1/mo/stock-alerts", headers=_as(CLN)).status_code == 403
    assert api.post("/api/v1/mo/stock-alerts/SIM-SAL-X/ack", headers=_as(RESIDENT)).status_code == 403
    assert api.post("/api/v1/mo/stock-alerts/SIM-SAL-NOPE/ack", headers=_as(TEC)).status_code == 404


# ---------------------------------------------------------------------- PostgreSQL (--pg, local docker *_test only)


@pytest.mark.pg
def test_a10_postgres_alert_rollback_and_ack(pg_url, clock):
    from src.maintenance.store.postgres import PostgresRepository, sql_engine

    with sql_engine(pg_url).begin() as conn:
        conn.execute(text("delete from maintops.stock_alerts"))
        conn.execute(text("delete from maintops.stock"))
    repo = PostgresRepository(pg_url, stock_alerts=True)
    engine = MaintenanceEngine(repo=repo, clock=clock)
    repo.set_stock(LAMP2, 0)
    engine.receive_stock(WAREHOUSE, LAMP2, 20)
    engine.receive_stock(WAREHOUSE, LAMP2, 5)
    [alert] = engine.list_stock_alerts(TEC)
    assert (alert.qty_before, alert.qty_after) == (0, 20)

    first = engine.acknowledge_stock_alert(TEC, alert.alert_id)
    clock.advance(hours=1)
    again = engine.acknowledge_stock_alert(BQL, alert.alert_id)
    assert (again.acknowledged_by, again.acknowledged_at) == (first.acknowledged_by, first.acknowledged_at)

    repo.set_stock(LAMP2, 0)
    original = engine._raise_stock_alerts

    def alert_then_fail(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("simulated failure")

    engine._raise_stock_alerts = alert_then_fail
    with pytest.raises(RuntimeError):
        engine.receive_stock(WAREHOUSE, LAMP2, 9)
    assert repo.stock_of(LAMP2) == 0
    assert len(engine.list_stock_alerts(TEC)) == 1


@pytest.mark.pg
def test_postgres_flag_off_never_touches_the_table(pg_url, clock):
    from src.maintenance.store.postgres import PostgresRepository

    repo = PostgresRepository(pg_url)  # stock_alerts=False: a database still at 0004 would work too
    engine = MaintenanceEngine(repo=repo, clock=clock, stock_alerts=False)
    repo.set_stock(LAMP2, 0)
    engine.receive_stock(WAREHOUSE, LAMP2, 3)
    assert engine.list_stock_alerts(TEC) == []
    assert repo.stock_alerts("DEPT_TECHNICAL", unread_only=False) == []
