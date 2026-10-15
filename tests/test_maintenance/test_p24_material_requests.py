"""Plan 24: a material request for every ticket that waits for material, a department's way to report a shortage,
and a restock notice for the departments whose tickets waited.

Matrix R-01..R-12 of planning/24_2026-10-14_material-requests/specs/TESTING-ACCEPTANCE.md.
"""

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import AGENT_ID, MaintenanceEngine
from src.maintenance.enums import BlockerOwner, Department, PlaybookId, ReasonCode, TicketStatus
from src.maintenance.errors import ActionDeniedError, GuardError, InvalidTransitionError
from src.maintenance.models import PlannedMaterial
from src.maintenance.views import stock_alert_views
from tests.test_maintenance.helpers import (
    BPTN,
    BQL,
    CLEANING,
    CLN,
    LIGHTING,
    MONDAY_9AM,
    RESIDENT,
    TEC,
    WAREHOUSE,
    Clock,
    report,
)

LAMP, LAMP2, CLEAN, BAG = "SIM-MAT-LAMP-01", "SIM-MAT-LAMP-02", "SIM-MAT-CLEAN-01", "SIM-MAT-BAG-01"
CLEANING_DEPT, TECHNICAL_DEPT = Department.DEPT_CLEANING, Department.DEPT_TECHNICAL


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def eng(clock) -> MaintenanceEngine:
    engine = MaintenanceEngine(clock=clock)
    engine.reset(with_fixtures=False)
    return engine


@pytest.fixture
def api(eng):
    app.dependency_overrides[get_engine] = lambda: eng
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(actor_header_allowed, None)


def _as(actor: str) -> dict[str, str]:
    return {"X-Actor-Id": actor}


def at_work(engine: MaintenanceEngine, text: str, actor: str) -> str:
    """A reported ticket the department has accepted (IN_PROGRESS)."""
    tid = report(engine, text)
    engine.accept(tid, actor)
    return tid


def need(code: str, qty: float) -> PlannedMaterial:
    return PlannedMaterial(item_code=code, planned_qty=qty)


def state(engine: MaintenanceEngine, tid: str):
    """Everything a refused call must leave untouched."""
    repo = engine.repo
    return (
        repo.version_of(tid),
        repo.get(tid).model_dump(mode="json"),
        repo.stock(),
        len(repo.log_rows()),
        len(repo.notification_rows()),
    )


def shortage_notices(engine: MaintenanceEngine, tid: str):
    return [n for n in engine.get(tid).notifications if n.type == "material.shortage"]


# ---------------------------------------------------------------------- R-01 .. R-04: the request


def test_r01_step_7_shortage_raises_a_request_and_tells_the_warehouse(eng):
    eng.repo.set_stock(LAMP, 0)
    tid = report(eng, LIGHTING)
    ticket = eng.get(tid).ticket
    assert (ticket.status, ticket.blocker.code, ticket.blocker.owner_role) == (
        TicketStatus.ON_HOLD,
        ReasonCode.WAITING_MATERIAL,
        BlockerOwner.WAREHOUSE,
    )
    [notice] = shortage_notices(eng, tid)
    assert notice.audience == BlockerOwner.WAREHOUSE
    assert notice.payload == {"request_id": f"PVT-{tid}", "item_codes": [LAMP], "source": "AGENT"}
    [request] = eng.material_requests(WAREHOUSE)
    assert (request.request_id, request.ticket_id, request.source, request.status) == (
        f"PVT-{tid}",
        tid,
        "AGENT",
        "OPEN",
    )
    assert request.reported_by == AGENT_ID and request.department_id == TECHNICAL_DEPT
    assert request.since == ticket.blocker.since and request.location
    [line] = request.lines
    assert (line.item_code, line.needed_qty, line.stock_qty, line.shortage_qty) == (LAMP, 1, 0, 1)
    assert line.item_name and line.unit


def test_r02_department_at_work_reports_a_shortage(eng):
    tid = at_work(eng, LIGHTING, TEC)
    eng.repo.set_stock(LAMP2, 0)
    before = len(eng.get(tid).audit)
    case = eng.report_material_shortage(tid, TEC, lines=[need(LAMP2, 2)], note="Cần đèn tuýp")
    assert case.ticket.status == TicketStatus.ON_HOLD
    blocker = case.ticket.blocker
    assert (blocker.code, blocker.owner_role, blocker.internal_note) == (
        ReasonCode.WAITING_MATERIAL,
        BlockerOwner.WAREHOUSE,
        "Cần đèn tuýp",
    )
    assert blocker.resume_step == 6 and blocker.escalate_at is not None
    assert [(m.item_code, m.planned_qty) for m in case.material_lines] == [(LAMP, 1), (LAMP2, 2)]
    assert case.audit[before].field_name == "planned_materials" and case.events[-1].actor_id == TEC
    [notice] = shortage_notices(eng, tid)
    assert notice.payload == {"request_id": f"PVT-{tid}", "item_codes": [LAMP2], "source": "DEPARTMENT"}
    [request] = eng.material_requests(WAREHOUSE)
    assert (request.source, request.reported_by, request.note) == ("DEPARTMENT", TEC, "Cần đèn tuýp")
    assert [(ln.item_code, ln.needed_qty, ln.stock_qty, ln.shortage_qty) for ln in request.lines] == [(LAMP2, 2, 0, 2)]


def test_r02b_the_need_is_added_on_top_of_what_was_already_taken(eng):
    tid = at_work(eng, LIGHTING, TEC)  # plan: LAMP 1, stock 4
    eng.record_material(tid, TEC, LAMP, issued_qty=1, used_qty=1, variance_reason=None)  # stock now 3
    case = eng.report_material_shortage(tid, TEC, lines=[need(LAMP, 5)])  # 5 more: planned = 1 + 5
    [line] = case.material_lines
    assert (line.planned_qty, line.issued_qty) == (6, 1)
    [request] = eng.material_requests(BQL)
    [short] = request.lines
    assert (short.needed_qty, short.stock_qty, short.shortage_qty) == (5, 3, 2)


def test_r03_stock_is_enough_so_nothing_changes(eng):
    tid = at_work(eng, LIGHTING, TEC)
    before = state(eng, tid)
    with pytest.raises(GuardError, match="Kho đủ vật tư"):
        eng.report_material_shortage(tid, TEC, lines=[need(LAMP, 1)])
    assert state(eng, tid) == before
    case = eng.get(tid)
    assert case.ticket.status == TicketStatus.IN_PROGRESS and case.ticket.blocker is None
    assert [(m.item_code, m.planned_qty) for m in case.material_lines] == [(LAMP, 1)]
    assert eng.material_requests(WAREHOUSE) == []


def test_r04_wrong_caller_status_or_lines_are_refused(eng):
    tid = at_work(eng, LIGHTING, TEC)
    routed = report(eng, "Đèn hành lang tầng 7 tòa S2 không sáng.")  # still ROUTED: nobody is on site yet
    eng.repo.set_stock(LAMP2, 0)
    before = state(eng, tid)
    for actor in (CLN, RESIDENT, BPTN, WAREHOUSE):
        with pytest.raises(ActionDeniedError):
            eng.report_material_shortage(tid, actor, lines=[need(LAMP2, 2)])
    with pytest.raises(InvalidTransitionError):
        eng.report_material_shortage(routed, TEC, lines=[need(LAMP2, 2)])
    refused = [
        [],  # nothing named
        [need(CLEAN, 2)],  # an item of the other department
        [need("SIM-MAT-NOPE", 2)],  # not in the catalog
        [need(LAMP2, 0)],
        [need(LAMP2, 0.5)],
        [need(LAMP2, 1), need(LAMP2, 1)],  # one line per item
    ]
    for lines in refused:
        with pytest.raises(GuardError):
            eng.report_material_shortage(tid, TEC, lines=lines)
    after = state(eng, tid)
    assert after[2] == before[2] and after[4] == before[4]  # stock and outbox untouched
    case = eng.get(tid)
    assert case.ticket.status == TicketStatus.IN_PROGRESS and [m.item_code for m in case.material_lines] == [LAMP]


# ---------------------------------------------------------------------- R-05 .. R-09: the restock notice


def test_r05_full_restock_resumes_the_ticket_and_tells_its_department(eng):
    tid = at_work(eng, LIGHTING, TEC)
    eng.repo.set_stock(LAMP2, 0)
    eng.report_material_shortage(tid, TEC, lines=[need(LAMP2, 2)])
    [done] = eng.receive_stock(WAREHOUSE, LAMP2, 5)
    assert done.ticket.status == TicketStatus.IN_PROGRESS and done.ticket.blocker is None
    assert done.events[-1].internal_note == "Kho đã nhập đủ vật tư"
    assert eng.material_requests(WAREHOUSE) == []
    [alert] = eng.list_stock_alerts(TEC)
    assert (alert.department_id, alert.ticket_ids, alert.qty_before, alert.qty_after) == (
        TECHNICAL_DEPT,
        (tid,),
        0,
        5,
    )
    [view] = stock_alert_views(eng, [alert])
    assert [(t.ticket_id, t.waiting) for t in view.tickets] == [(tid, False)]


def test_r06_partial_restock_keeps_the_ticket_waiting(eng):
    tid = at_work(eng, LIGHTING, TEC)
    eng.repo.set_stock(LAMP2, 0)
    eng.report_material_shortage(tid, TEC, lines=[need(LAMP2, 5)])
    [still] = eng.receive_stock(WAREHOUSE, LAMP2, 3)
    assert still.ticket.status == TicketStatus.ON_HOLD
    [request] = eng.material_requests(WAREHOUSE)
    [line] = request.lines
    assert (line.needed_qty, line.stock_qty, line.shortage_qty) == (5, 3, 2)
    [view] = stock_alert_views(eng, eng.list_stock_alerts(TEC))
    assert [(t.ticket_id, t.waiting) for t in view.tickets] == [(tid, True)]
    eng.receive_stock(WAREHOUSE, LAMP2, 2)  # the rest arrives: the request closes by itself
    assert eng.get(tid).ticket.status == TicketStatus.IN_PROGRESS and eng.material_requests(WAREHOUSE) == []


def test_r07_two_departments_waiting_for_one_item_get_one_alert_each(eng, monkeypatch):
    # no catalog item is shared today: let Technical use bags too, so both departments can wait for BAG
    monkeypatch.setitem(eng.catalog.playbook_materials, PlaybookId.TEC, (LAMP, LAMP2, BAG))
    clean_tid, tec_tid = at_work(eng, CLEANING, CLN), at_work(eng, LIGHTING, TEC)
    eng.repo.set_stock(BAG, 5)  # positive before the receipt: only the waiting tickets can explain an alert
    eng.report_material_shortage(clean_tid, CLN, lines=[need(BAG, 8)])
    eng.report_material_shortage(tec_tid, TEC, lines=[need(BAG, 8)])
    eng.receive_stock(WAREHOUSE, BAG, 10)
    alerts = eng.list_stock_alerts(BQL)
    assert sorted((a.department_id, a.ticket_ids) for a in alerts) == [
        (CLEANING_DEPT, (clean_tid,)),
        (TECHNICAL_DEPT, (tec_tid,)),
    ]
    assert len({a.alert_id for a in alerts}) == 2
    assert [a.ticket_ids for a in eng.list_stock_alerts(CLN)] == [(clean_tid,)]
    assert [a.ticket_ids for a in eng.list_stock_alerts(TEC)] == [(tec_tid,)]


def test_r08_restock_nobody_waits_for_with_stock_left_raises_nothing(eng):
    eng.receive_stock(WAREHOUSE, LAMP, 3)  # stock was 4, nobody waits
    assert eng.list_stock_alerts(BQL) == []


def test_r09_restock_from_empty_still_alerts_the_department_that_uses_the_item(eng):
    eng.receive_stock(WAREHOUSE, LAMP2, 20)  # stock 0, no ticket waits (plan 20 behaviour kept)
    assert [(a.department_id, a.ticket_ids) for a in eng.list_stock_alerts(BQL)] == [(TECHNICAL_DEPT, ())]
    assert eng.list_stock_alerts(CLN) == []  # Cleaning does not use that item


# ---------------------------------------------------------------------- R-10, R-12: who sees what


def test_r10_alert_permissions(eng):
    tid = at_work(eng, LIGHTING, TEC)
    eng.repo.set_stock(LAMP2, 0)
    eng.report_material_shortage(tid, TEC, lines=[need(LAMP2, 2)])
    eng.receive_stock(WAREHOUSE, LAMP2, 5)
    [alert] = eng.list_stock_alerts(TEC)
    assert eng.list_stock_alerts(CLN) == []
    assert eng.list_stock_alerts(CLN, department_id=TECHNICAL_DEPT) == []  # a department ignores `department`
    assert [a.alert_id for a in eng.list_stock_alerts(TEC, department_id=CLEANING_DEPT)] == [alert.alert_id]
    for actor in (BPTN, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.list_stock_alerts(actor)
        with pytest.raises(ActionDeniedError):
            eng.acknowledge_stock_alert(actor, alert.alert_id)
    assert [a.alert_id for a in eng.list_stock_alerts(WAREHOUSE)] == [alert.alert_id]
    assert [a.alert_id for a in eng.list_stock_alerts(BQL, department_id=TECHNICAL_DEPT)] == [alert.alert_id]
    assert eng.list_stock_alerts(BQL, department_id=CLEANING_DEPT) == []
    with pytest.raises(ActionDeniedError):
        eng.acknowledge_stock_alert(CLN, alert.alert_id)  # another department's alert
    with pytest.raises(ActionDeniedError):
        eng.acknowledge_stock_alert(WAREHOUSE, alert.alert_id)  # the warehouse only reads
    assert eng.list_stock_alerts(TEC, unread_only=True)[0].acknowledged_at is None
    assert eng.acknowledge_stock_alert(TEC, alert.alert_id).acknowledged_by == TEC
    assert eng.acknowledge_stock_alert(BQL, alert.alert_id).acknowledged_by == TEC  # idempotent


def test_r12_a_department_sees_only_its_own_requests(eng):
    eng.repo.set_stock(LAMP, 0)
    eng.repo.set_stock(CLEAN, 0)
    tec_tid, clean_tid = report(eng, LIGHTING), report(eng, CLEANING)
    assert {r.ticket_id for r in eng.material_requests(WAREHOUSE)} == {tec_tid, clean_tid}
    assert {r.ticket_id for r in eng.material_requests(BQL)} == {tec_tid, clean_tid}
    assert [r.ticket_id for r in eng.material_requests(TEC)] == [tec_tid]
    assert [r.ticket_id for r in eng.material_requests(CLN)] == [clean_tid]
    for actor in (RESIDENT, BPTN):
        with pytest.raises(ActionDeniedError):
            eng.material_requests(actor)


def test_requests_are_oldest_first(eng, clock):
    eng.repo.set_stock(LAMP, 0)
    eng.repo.set_stock(CLEAN, 0)
    first = report(eng, CLEANING)
    clock.advance(minutes=5)
    second = report(eng, LIGHTING)
    assert [r.ticket_id for r in eng.material_requests(WAREHOUSE)] == [first, second]


# ---------------------------------------------------------------------- R-11: the four routes


def test_r11_api_report_read_restock_notice_ack(api, eng):
    tid = at_work(eng, LIGHTING, TEC)
    eng.repo.set_stock(LAMP2, 0)
    body = {"lines": [{"item_code": LAMP2, "planned_qty": 2}], "note": "Cần đèn tuýp"}
    url = f"/api/v1/mo/tickets/{tid}/material-shortage"
    assert api.post(url, json=body, headers=_as(CLN)).status_code == 403
    assert api.post(url, json=body, headers=_as(RESIDENT)).status_code == 403
    ok = api.post(url, json=body, headers=_as(TEC))
    assert ok.status_code == 200 and ok.json()["ticket"]["status"] == "ON_HOLD", ok.text
    again = api.post(url, json=body, headers=_as(TEC))  # no longer IN_PROGRESS
    assert again.status_code == 409 and again.json()["detail"]["code"] == "INVALID_TRANSITION"

    rows = api.get("/api/v1/mo/warehouse/requests", headers=_as(WAREHOUSE))
    assert rows.status_code == 200
    [row] = rows.json()
    assert row["request_id"] == f"PVT-{tid}" and row["source"] == "DEPARTMENT" and row["status"] == "OPEN"
    assert row["lines"][0]["shortage_qty"] == 2
    assert api.get("/api/v1/mo/warehouse/requests", headers=_as(CLN)).json() == []
    assert api.get("/api/v1/mo/warehouse/requests", headers=_as(RESIDENT)).status_code == 403

    assert api.post(f"/api/v1/mo/warehouse/stock/{LAMP2}", json={"qty": 5}, headers=_as(WAREHOUSE)).status_code == 200
    [alert] = api.get("/api/v1/mo/stock-alerts?unread=true", headers=_as(TEC)).json()
    assert alert["tickets"] == [{"ticket_id": tid, "waiting": False}]
    by_bql = api.get("/api/v1/mo/stock-alerts?department=DEPT_TECHNICAL", headers=_as(BQL)).json()
    assert [a["alert_id"] for a in by_bql] == [alert["alert_id"]]
    assert api.get("/api/v1/mo/stock-alerts", headers=_as(CLN)).json() == []
    assert api.post(f"/api/v1/mo/stock-alerts/{alert['alert_id']}/ack", headers=_as(CLN)).status_code == 403
    ack = api.post(f"/api/v1/mo/stock-alerts/{alert['alert_id']}/ack", headers=_as(TEC))
    assert ack.status_code == 200 and ack.json()["acknowledged_by"] == TEC
    assert api.get("/api/v1/mo/warehouse/requests", headers=_as(WAREHOUSE)).json() == []


def test_r11b_api_guard_and_validation(api, eng):
    tid = at_work(eng, LIGHTING, TEC)
    url = f"/api/v1/mo/tickets/{tid}/material-shortage"
    enough = api.post(url, json={"lines": [{"item_code": LAMP, "planned_qty": 1}]}, headers=_as(TEC))
    assert enough.status_code == 409 and enough.json()["detail"]["code"] == "GUARD_FAILED"
    assert api.post(url, json={"lines": []}, headers=_as(TEC)).status_code == 409
    other = api.post(url, json={"lines": [{"item_code": CLEAN, "planned_qty": 1}]}, headers=_as(TEC))
    assert other.status_code == 409
    for qty in (0, -1, 0.5, "2", True):
        bad = api.post(url, json={"lines": [{"item_code": LAMP2, "planned_qty": qty}]}, headers=_as(TEC))
        assert bad.status_code == 422, (qty, bad.text)
    assert api.post(url, json={"lines": "x"}, headers=_as(TEC)).status_code == 422
    missing = api.post("/api/v1/mo/tickets/SIM-TKT-NOPE/material-shortage", json={"lines": []}, headers=_as(TEC))
    assert missing.status_code in (403, 404)
    assert eng.get(tid).ticket.status == TicketStatus.IN_PROGRESS


def test_r03b_an_older_short_line_does_not_make_a_report_of_an_item_in_stock_true(eng):
    """Final review F-E: the report must be short on what it reports (LAMP short, LAMP2 in stock: refused)."""
    tid = at_work(eng, LIGHTING, TEC)
    eng.repo.set_stock(LAMP, 0)
    eng.repo.set_stock(LAMP2, 10)
    before = state(eng, tid)
    with pytest.raises(GuardError, match="Kho đủ vật tư"):
        eng.report_material_shortage(tid, TEC, lines=[need(LAMP2, 1)])
    assert state(eng, tid) == before
