"""Plan 16 CONTRACTS §C2/§C4 through the API: one request saves the whole selection, only deltas move the stock,
and a failing save leaves the ticket, the stock, the audit and the outbox exactly as they were."""

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine
from tests.test_maintenance.helpers import CLEANING, CLN, LIGHTING, MONDAY_9AM, TEC, WAREHOUSE, Clock, report

MATERIAL_USAGE_FIELD = "material_usage"  # the audit field web/app read as "saved" (SPEC-P02 §U1): a contract
LAMP, LAMP2, STARTER, CLEAN, BAG = (
    "SIM-MAT-LAMP-01",
    "SIM-MAT-LAMP-02",
    "SIM-MAT-STARTER-01",
    "SIM-MAT-CLEAN-01",
    "SIM-MAT-BAG-01",
)


@pytest.fixture
def eng() -> MaintenanceEngine:
    e = MaintenanceEngine(clock=Clock(MONDAY_9AM))
    e.reset(with_fixtures=False)
    return e


@pytest.fixture
def api(eng):
    app.dependency_overrides[get_engine] = lambda: eng
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def started(engine: MaintenanceEngine, text: str, actor: str) -> str:
    tid = report(engine, text)
    engine.accept(tid, actor)
    return tid


def save(api, tid, actor, lines: dict):
    body = {"lines": [{"item_code": code, "used_qty": qty} for code, qty in lines.items()]}
    return api.post(f"/api/v1/mo/tickets/{tid}/material-usage", json=body, headers={"X-Actor-Id": actor})


def snapshot(engine: MaintenanceEngine, tid: str):
    repo = engine.repo
    return (
        repo.version_of(tid),
        repo.get(tid).model_dump(mode="json"),
        repo.stock(),
        len(repo.log_rows()),
        len(repo.notification_rows()),
    )


def test_one_save_issues_equal_used_and_writes_one_audit(api, eng):
    tid = started(eng, LIGHTING, TEC)
    start = eng.repo.stock_of(LAMP)
    audit_before = len(eng.get(tid).audit)
    reply = save(api, tid, TEC, {LAMP: 4, STARTER: 1})
    assert reply.status_code == 200, reply.text
    case = reply.json()
    lines = [(m["item_code"], m["planned_qty"], m["issued_qty"], m["used_qty"]) for m in case["material_lines"]]
    assert lines == [(LAMP, 4, 4, 4), (STARTER, 1, 1, 1)]
    assert [m["norm_qty"] for m in case["material_lines"]] == [1, None]  # the norm stays a reference
    assert eng.repo.stock_of(LAMP) == start - 4 and eng.repo.stock_of(STARTER) is None  # unknown stays unknown
    new_audit = case["audit"][audit_before:]
    assert [a["field_name"] for a in new_audit] == [MATERIAL_USAGE_FIELD]
    assert new_audit[0]["new_value"][0] == {"item_code": LAMP, "issued_qty": 4, "used_qty": 4, "stock_qty": start - 4}


def test_saving_the_same_selection_again_moves_no_stock(api, eng):
    tid = started(eng, LIGHTING, TEC)
    start = eng.repo.stock_of(LAMP)
    first = save(api, tid, TEC, {LAMP: 4}).json()
    second = save(api, tid, TEC, {LAMP: 4}).json()
    assert eng.repo.stock_of(LAMP) == start - 4
    assert first["material_lines"][0]["used_qty"] == second["material_lines"][0]["used_qty"] == 4
    assert first["ticket"]["status"] == second["ticket"]["status"] == "IN_PROGRESS"
    assert len(second["audit"]) == len(first["audit"]) + 1  # each save the user makes is audited


def test_up_and_down_moves_only_the_difference(api, eng):
    tid = started(eng, LIGHTING, TEC)
    start = eng.repo.stock_of(LAMP)
    for qty in (4, 2, 4, 1):
        assert save(api, tid, TEC, {LAMP: qty}).status_code == 200
        assert eng.repo.stock_of(LAMP) == start - qty


def test_dropping_or_replacing_a_line_gives_its_stock_back(api, eng):
    tid = started(eng, CLEANING, CLN)
    clean, bag = eng.repo.stock_of(CLEAN), eng.repo.stock_of(BAG)
    assert save(api, tid, CLN, {CLEAN: 3, BAG: 5}).status_code == 200
    assert (eng.repo.stock_of(CLEAN), eng.repo.stock_of(BAG)) == (clean - 3, bag - 5)
    reply = save(api, tid, CLN, {BAG: 2})
    assert [m["item_code"] for m in reply.json()["material_lines"]] == [BAG]
    assert (eng.repo.stock_of(CLEAN), eng.repo.stock_of(BAG)) == (clean, bag - 2)


def test_swap_to_an_empty_item_rolls_everything_back(api, eng):
    """The bug that started plan 16: LAMP-01 ×4 saved, then swapped to LAMP-02 with no stock. The old two-step
    flow committed the new plan and gave LAMP-01 back before the issue failed."""
    tid = started(eng, LIGHTING, TEC)
    assert eng.repo.stock_of(LAMP2) == 0
    assert save(api, tid, TEC, {LAMP: 4}).status_code == 200
    before = snapshot(eng, tid)
    reply = save(api, tid, TEC, {LAMP2: 4})
    assert reply.status_code == 409 and reply.json()["detail"]["code"] == "GUARD_FAILED"
    assert snapshot(eng, tid) == before


def test_second_line_short_keeps_the_first_line_in_stock(api, eng):
    tid = started(eng, LIGHTING, TEC)
    before = snapshot(eng, tid)
    assert save(api, tid, TEC, {LAMP: 2, LAMP2: 1}).status_code == 409
    assert snapshot(eng, tid) == before
    eng.receive_stock(WAREHOUSE, LAMP2, 1)
    lamp = eng.repo.stock_of(LAMP)
    reply = save(api, tid, TEC, {LAMP: 2, LAMP2: 1})
    assert reply.status_code == 200
    assert (eng.repo.stock_of(LAMP), eng.repo.stock_of(LAMP2)) == (lamp - 2, 0)


def test_duplicate_codes_are_refused(api, eng):
    tid = started(eng, LIGHTING, TEC)
    before = snapshot(eng, tid)
    body = {"lines": [{"item_code": LAMP, "used_qty": 1}, {"item_code": LAMP, "used_qty": 2}]}
    reply = api.post(f"/api/v1/mo/tickets/{tid}/material-usage", json=body, headers={"X-Actor-Id": TEC})
    assert reply.status_code == 409
    assert snapshot(eng, tid) == before


def test_agent_plan_is_not_a_saved_selection(eng):
    """The Agent's plan has no issued/used and no save audit: clients must not show it as saved (§U1)."""
    tid = started(eng, LIGHTING, TEC)
    case = eng.get(tid)
    assert case.material_lines and all(m.issued_qty is None for m in case.material_lines)
    assert not any(a.field_name == MATERIAL_USAGE_FIELD for a in case.audit)
