"""Plan 11 WP1b (SPEC-P04): second batch of backend additions for the portal.

  §1  an Agent that concludes OUT_OF_SCOPE hands the ticket to BQL ("Viec cua BQL"); the fixed rules do not
  §2  every material request of a department needs approval from the warehouse or BQL (ON_HOLD until then)
  §3  staff assignment: `staff.yaml`, table `assignments`, `GET /mo/staff`, `POST /mo/tickets/{id}/assign`
  §4  rating with tags and a comment (table `rating_details`)
  §5  Agent fields on the staff ticket rows

Engine tests call the engine directly; every route also has a test through `TestClient` with a real login token.
The ticket document must keep the shape older code reads (Supabase is shared with an older backend): every step that
changes a ticket is followed by `assert_base_shape` from the WP1 tests.
"""

import copy
import json
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from src.api.auth import AuthService, get_auth, load_accounts
from src.api.routers import maintenance as maintenance_router
from src.api.routers.maintenance import get_engine
from src.config import get_settings
from src.main import app
from src.maintenance.agent import prompt
from src.maintenance.agent.client import FailingClient, ScriptedClient
from src.maintenance.catalog import load_staff
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import Action
from src.maintenance.errors import ActionDeniedError, InvalidRatingError, InvalidTransitionError, StockShortError
from src.maintenance.models import PlannedMaterial
from src.maintenance.store.base import Assignment, GuardError, RatingDetail
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
    agent_engine,
    decision,
    to_ready,
)
from tests.test_maintenance.test_portal_backend_ext import (
    assert_base_shape,
    audit_denials,
    in_progress_ticket,
    oos_ticket,
    routed_ticket,
)

PORTAL_PASSWORD = "123456"
FEE_TEXT = "Hóa đơn phí dịch vụ tính sai diện tích"
FEE_WITH_PLACE = "Phí dịch vụ ở hành lang tầng 3 tòa S1 tính sai diện tích"
LIGHT = "Đèn hành lang tầng 3 tòa S1 không sáng"
LAMP2 = "SIM-MAT-LAMP-02"
HALLWAY = {
    "building": "S1",
    "floor": "3",
    "area": "Hành lang",
    "quote": "hành lang tầng 3 tòa S1",
    "reason": "Cư dân nêu rõ nơi xảy ra",
}
NO_LOCATION = {"building": None, "floor": None, "area": None, "quote": None, "reason": "Cư dân chưa nêu vị trí"}
JOB_KT = copy.deepcopy(prompt.EXAMPLE["jobs"][1])
NOTE = "Ghi chú"


# ---------------------------------------------------------------------- fixtures


def make_env(engine: MaintenanceEngine, clock: Clock) -> SimpleNamespace:
    """Engine + real accounts behind the HTTP API; `tok(name)` logs in and returns the Bearer header."""
    auth = AuthService({a.username: a for a in load_accounts().accounts})
    app.dependency_overrides[get_engine] = lambda: engine
    app.dependency_overrides[get_auth] = lambda: auth
    client = TestClient(app)
    cache: dict[str, dict] = {}

    def tok(username: str) -> dict:
        if username not in cache:
            response = client.post("/api/v1/auth/login", json={"username": username, "password": PORTAL_PASSWORD})
            assert response.status_code == 200, response.text
            cache[username] = {"Authorization": f"Bearer {response.json()['access_token']}"}
        return cache[username]

    return SimpleNamespace(engine=engine, client=client, tok=tok, clock=clock)


@pytest.fixture
def clock() -> Clock:
    return Clock(MONDAY_9AM)


@pytest.fixture
def eng(clock) -> MaintenanceEngine:
    engine = MaintenanceEngine(clock=clock)
    engine.reset(with_fixtures=False)
    return engine


@pytest.fixture
def env(eng, clock):
    yield make_env(eng, clock)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(get_auth, None)


def oos_reply(**changes) -> str:
    return decision(
        **{
            "scope": "OUT_OF_SCOPE",
            "jobs": [],
            "location": NO_LOCATION,
            "next_step": "TO_BPTN",
            "ask_fields": [],
            "bptn_reason": "OUT_OF_SCOPE",
            "note_for_staff": "Hỏi về phí dịch vụ, không phải việc kỹ thuật hay vệ sinh",
            **changes,
        }
    )


def light_reply() -> str:
    job = {**copy.deepcopy(JOB_KT), "quote": "không sáng", "asset_id": "SIM-ASSET-LIGHT-001"}
    return decision(jobs=[job], location=HALLWAY)


def agent_env(clock, client):
    engine = agent_engine(clock, client)
    return make_env(engine, clock)


@pytest.fixture
def agent_cleanup():
    yield
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(get_auth, None)


def set_flag(monkeypatch, value: bool | None) -> None:
    settings = get_settings().model_copy(update={"mo_portal_extras": value})
    monkeypatch.setattr(maintenance_router, "get_settings", lambda: settings)


def waiting_ticket(engine: MaintenanceEngine, *, stock: float = 5) -> str:
    """A technical ticket in progress whose department asked for 2 tube lamps; the warehouse holds `stock`."""
    ticket_id = in_progress_ticket(engine)
    if stock:
        engine.receive_stock(WAREHOUSE, LAMP2, stock)
    case = engine.confirm_materials(
        ticket_id, TEC, lines=[PlannedMaterial(item_code=LAMP2, planned_qty=2)], note="Đèn tuýp"
    )
    assert case.ticket.status == "ON_HOLD"
    return ticket_id


# ======================================================================= §1 the Agent hands OUT_OF_SCOPE to BQL


def test_s1_agent_out_of_scope_without_a_place_goes_to_bql(clock):
    engine = agent_engine(clock, ScriptedClient({"phí dịch vụ": oos_reply()}))
    case = engine.receive(FEE_TEXT, resident_id=RESIDENT)
    ticket, blocker = case.ticket, case.ticket.blocker
    assert (ticket.status, blocker.code) == ("VERIFYING", "OUT_OF_SCOPE")
    assert blocker.resume_step == 2  # the step-2 branch (no location, nothing to ask)
    assert blocker.escalated is True and blocker.next_retry_at is None
    note = [n for n in case.notifications if n.type == "escalation"]
    assert [(n.audience, n.payload) for n in note] == [("BQL", {"reason_code": "OUT_OF_SCOPE", "by": "AGENT"})]
    audit = [a for a in case.audit if a.field_name == "blocker.escalated"]
    assert len(audit) == 1
    assert (audit[0].action, audit[0].actor_id, audit[0].old_value, audit[0].new_value) == (
        Action.TRANSITION,
        "SIM-ACTOR-AGENT",
        False,
        True,
    )
    assert_base_shape(case)


def test_s1_agent_out_of_scope_with_a_place_goes_to_bql_too(clock):
    out = oos_reply(location=HALLWAY)
    engine = agent_engine(clock, ScriptedClient({"Phí dịch vụ": out}))
    case = engine.receive(FEE_WITH_PLACE, resident_id=RESIDENT)
    blocker = case.ticket.blocker
    assert (case.ticket.status, blocker.code, blocker.resume_step) == ("VERIFYING", "OUT_OF_SCOPE", 4)  # step 3
    assert blocker.escalated is True and blocker.next_retry_at is None
    assert [n.payload["by"] for n in case.notifications if n.type == "escalation"] == ["AGENT"]
    assert_base_shape(case)


@pytest.mark.parametrize("kind", ["timeout", "http", "garbage", "schema"])
def test_s1_agent_fallback_keeps_the_ticket_with_bptn(clock, kind):  # mutation m5 target
    engine = agent_engine(clock, FailingClient(kind))
    case = engine.receive(FEE_TEXT, resident_id=RESIDENT)
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "OUT_OF_SCOPE")
    assert case.agent_decision.source == "FALLBACK_RULE"
    assert case.ticket.blocker.escalated is False and case.ticket.blocker.next_retry_at is not None
    assert [n for n in case.notifications if n.type == "escalation"] == []


def test_s1_fixed_rules_keep_the_ticket_with_bptn(eng):  # mutation m5 target
    case = eng.get(oos_ticket(eng))
    assert case.agent_decision is None
    assert case.ticket.blocker.escalated is False
    assert [n for n in case.notifications if n.type == "escalation"] == []


def test_s1_agent_out_of_scope_then_bql_closes_or_returns_it(clock):
    engine = agent_engine(clock, ScriptedClient({"phí dịch vụ": oos_reply()}))
    ticket_id = engine.receive(FEE_TEXT, resident_id=RESIDENT).ticket.ticket_id
    returned = engine.bql_return_to_bptn(ticket_id, BQL, note="BPTN liên hệ cư dân")
    assert returned.ticket.blocker.escalated is False  # the Agent's hand-over can be undone like BPTN's
    again = engine.send_to_bql(ticket_id, BPTN, note="Chuyển lại BQL")
    assert again.ticket.blocker.escalated is True
    assert engine.bql_handle_out_of_scope(ticket_id, BQL, note="Đã xử lý").ticket.status == "CLOSED"


def test_s1_safety_comes_first_over_an_agent_out_of_scope(clock):
    smoke = "Có khói bốc ra từ phòng kỹ thuật tầng 3 tòa S1"
    engine = agent_engine(clock, ScriptedClient({"khói": oos_reply()}))
    case = engine.receive(smoke, resident_id=RESIDENT)
    assert case.ticket.blocker.code != "OUT_OF_SCOPE"  # the safety stop of step 2b ran first
    assert not any(n.payload.get("by") == "AGENT" for n in case.notifications if n.type == "escalation")


def test_s1_api_agent_escalated_ticket_is_in_the_bql_list(clock, agent_cleanup):
    env = agent_env(clock, ScriptedClient({"phí dịch vụ": oos_reply()}))
    c, tok = env.client, env.tok
    created = c.post("/api/v1/resident/tickets", json={"original_description": FEE_TEXT}, headers=tok("cudan"))
    assert created.status_code == 201, created.text
    ticket_id = created.json()["ticket_id"]
    rows = c.get("/api/v1/bql/tickets?blocker_code=OUT_OF_SCOPE&escalated=true", headers=tok("quanly")).json()
    assert [r["ticket_id"] for r in rows] == [ticket_id]
    assert rows[0]["agent_source"] == "AGENT"


# ======================================================================= §2 material requests need approval


def test_s2_enough_stock_still_waits_for_approval_then_runs(eng):
    ticket_id = in_progress_ticket(eng)
    eng.receive_stock(WAREHOUSE, LAMP2, 5)
    case = eng.confirm_materials(
        ticket_id, TEC, lines=[PlannedMaterial(item_code=LAMP2, planned_qty=2)], note="Đèn tuýp"
    )
    ticket = case.ticket
    assert ticket.status == "ON_HOLD" and ticket.blocker.code == "WAITING_MATERIAL"
    assert ticket.blocker.resolved_at is None and ticket.blocker.owner_role == "WAREHOUSE"
    assert ticket.department_id == "DEPT_TECHNICAL" and ticket.accepted_at is not None
    assert [m.material_stock_status for m in case.material_lines] == ["SUFFICIENT"]
    assert_base_shape(case)

    approved = eng.approve_materials(ticket_id, WAREHOUSE, note="Đã cấp 2 đèn")
    assert approved.ticket.status == "IN_PROGRESS" and approved.ticket.blocker is None
    assert approved.ticket.accepted_at == ticket.accepted_at
    event = approved.events[-1]
    assert (event.from_status, event.to_status) == ("ON_HOLD", "IN_PROGRESS")
    audit = approved.audit[-1]
    assert (audit.action, audit.actor_id, audit.reason) == (Action.APPROVE_MATERIAL, WAREHOUSE, "Đã cấp 2 đèn")
    assert_base_shape(approved)


def test_s2_bql_can_approve_too(eng):
    ticket_id = waiting_ticket(eng)
    assert eng.approve_materials(ticket_id, BQL).ticket.status == "IN_PROGRESS"


def test_s2_short_stock_is_refused_until_the_warehouse_receives(eng):
    ticket_id = waiting_ticket(eng, stock=1)
    with pytest.raises(StockShortError) as err:
        eng.approve_materials(ticket_id, WAREHOUSE)
    assert err.value.code == "STOCK_SHORT"
    assert "Kho chưa đủ" in err.value.message and "cần 2" in err.value.message and "còn 1" in err.value.message
    assert "nhập kho trước" in err.value.message
    assert eng.get(ticket_id).ticket.status == "ON_HOLD"
    eng.receive_stock(WAREHOUSE, LAMP2, 3)
    assert eng.get(ticket_id).ticket.status == "ON_HOLD"  # enough now, but nobody approved
    assert eng.approve_materials(ticket_id, WAREHOUSE).ticket.status == "IN_PROGRESS"


def test_s2_receiving_stock_never_approves_by_itself(eng):  # mutation m4 target
    ticket_id = waiting_ticket(eng, stock=5)
    eng.receive_stock(WAREHOUSE, LAMP2, 1)
    eng.resume(ticket_id)
    case = eng.get(ticket_id)
    assert case.ticket.status == "ON_HOLD" and case.ticket.blocker.resolved_at is None


def test_s2_the_job_does_not_approve_either(eng, clock):  # mutation m4 target
    ticket_id = waiting_ticket(eng, stock=5)
    clock.advance(hours=30)
    eng.run_jobs(clock.now)
    assert eng.get(ticket_id).ticket.status == "ON_HOLD"


def test_s2_wrong_roles_are_denied_and_audited(eng):
    ticket_id = waiting_ticket(eng)
    for actor in (TEC, CLN, BPTN, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.approve_materials(ticket_id, actor)
    case = eng.get(ticket_id)
    assert len(audit_denials(case)) == 4
    assert case.ticket.status == "ON_HOLD"


def test_s2_approving_twice_or_a_ticket_not_waiting_is_invalid(eng):
    ticket_id = waiting_ticket(eng)
    eng.approve_materials(ticket_id, WAREHOUSE)
    with pytest.raises(InvalidTransitionError):
        eng.approve_materials(ticket_id, WAREHOUSE)
    routed = eng.receive(LIGHTING, resident_id=RESIDENT).ticket.ticket_id
    for other in (routed, oos_ticket(eng)):
        before = eng.get(other)
        with pytest.raises(InvalidTransitionError):
            eng.approve_materials(other, WAREHOUSE)
        assert eng.get(other) == before


def test_s2_an_empty_plan_needs_no_approval(eng):
    ticket_id = in_progress_ticket(eng)
    case = eng.confirm_materials(ticket_id, TEC, lines=[], note="Chỉ siết lại chuôi đèn")
    assert case.ticket.status == "IN_PROGRESS"


def test_s2_department_cannot_resume_a_ticket_waiting_for_approval(eng):
    ticket_id = waiting_ticket(eng)
    with pytest.raises(InvalidTransitionError):
        eng.resume_work(ticket_id, TEC)
    assert eng.get(ticket_id).ticket.status == "ON_HOLD"


def test_s2_the_automatic_stock_check_at_dispatch_is_untouched(eng):
    """Pipeline step 7 (no department yet) still waits for stock alone: no approval is asked there."""
    item = eng.create_material_item(WAREHOUSE, "Ống nước PVC 21", "cái")
    from src.maintenance.models import RawTicket

    raw = RawTicket(
        ticket_id="SIM-TKT-0900", created_at=MONDAY_9AM.isoformat(timespec="seconds"), original_description=LIGHTING
    )
    eng.ingest(raw, [PlannedMaterial(item_code=item.item_code, planned_qty=2)], resident_id=RESIDENT)
    assert eng.run_agent(raw.ticket_id).ticket.blocker.code == "WAITING_MATERIAL"
    [resumed] = eng.receive_stock(WAREHOUSE, item.item_code, 2)
    assert resumed.ticket.status == "ROUTED"


def test_s2_work_goes_on_after_approval(eng):
    ticket_id = waiting_ticket(eng, stock=5)
    eng.approve_materials(ticket_id, WAREHOUSE)
    from tests.test_maintenance.helpers import finish

    assert finish(eng, ticket_id).ticket.status == "READY_FOR_REVIEW"
    assert eng.repo.stock_of(LAMP2) == 3


def test_s2_api_flow(env):
    c, tok = env.client, env.tok
    ticket_id = in_progress_ticket(env.engine)
    plan = {"lines": [{"item_code": LAMP2, "planned_qty": 2}], "note": "Đèn tuýp"}
    sent = c.post(f"/api/v1/mo/tickets/{ticket_id}/material-plan", json=plan, headers=tok("kythuat"))
    assert sent.status_code == 200 and sent.json()["ticket"]["status"] == "ON_HOLD"
    path = f"/api/v1/mo/tickets/{ticket_id}/materials/approve"
    for who in ("kythuat", "vesinh", "tiepnhan", "cudan"):
        assert c.post(path, json={}, headers=tok(who)).status_code == 403, who
    short = c.post(path, json={"note": "Duyệt"}, headers=tok("kho"))
    assert short.status_code == 409, short.text
    detail = short.json()["detail"]
    assert detail["code"] == "STOCK_SHORT" and "Kho chưa đủ" in detail["message"]
    assert c.post(f"/api/v1/mo/warehouse/stock/{LAMP2}", json={"qty": 2}, headers=tok("kho")).status_code == 200
    assert c.get(f"/api/v1/mo/tickets/{ticket_id}", headers=tok("kho")).json()["ticket"]["status"] == "ON_HOLD"
    ok = c.post(path, json={"note": "Duyệt"}, headers=tok("quanly"))
    assert ok.status_code == 200, ok.text
    assert ok.json()["ticket"]["status"] == "IN_PROGRESS"
    again = c.post(path, json={}, headers=tok("kho"))
    assert again.status_code == 409 and again.json()["detail"]["code"] == "INVALID_TRANSITION"
    assert c.post("/api/v1/mo/tickets/SIM-TKT-9999/materials/approve", json={}, headers=tok("kho")).status_code == 404
    # the older route with an item code keeps working next to the new one
    record = c.post(
        f"/api/v1/mo/tickets/{ticket_id}/materials/{LAMP2}",
        json={"issued_qty": 2, "used_qty": 2},
        headers=tok("kythuat"),
    )
    assert record.status_code == 200, record.text
    assert_base_shape(env.engine.get(ticket_id))


# ======================================================================= §3 staff assignment


def test_s3_staff_yaml_matches_the_portal_seed():
    staff = load_staff().staff
    assert [m.staff_id for m in staff] == [
        "SIM-STAFF-CLN-A",
        "SIM-STAFF-CLN-B",
        "SIM-STAFF-CLN-C",
        "SIM-STAFF-TEC-1",
        "SIM-STAFF-TEC-2",
        "SIM-STAFF-TEC-3",
        "SIM-STAFF-TEC-4",
    ]
    assert [m.name for m in staff] == ["Tổ A", "Tổ B", "Tổ C"] + [f"Kỹ thuật viên {i}" for i in range(1, 5)]
    assert [m.department_id for m in staff] == ["DEPT_CLEANING"] * 3 + ["DEPT_TECHNICAL"] * 4
    assert [m.skill for m in staff[3:]] == ["Điện", "Cấp thoát nước", "Thang máy", "Điện"]
    assert [m.capacity for m in staff[:3]] == [4, 4, 3]
    assert staff[1].area == "Tòa S2.01 – S2.05"
    tags = load_staff().rating_tags
    assert tags.good == ("Xử lý nhanh", "Sạch sẽ, gọn gàng", "Thái độ tốt", "Giải quyết triệt để")
    assert tags.bad == ("Chậm trễ", "Chưa triệt để", "Thái độ chưa tốt", "Không báo trước")


def cleaning_routed(engine: MaintenanceEngine) -> str:
    ticket_id = engine.receive(CLEANING, resident_id=RESIDENT).ticket.ticket_id
    assert engine.get(ticket_id).ticket.status == "ROUTED"
    return ticket_id


def test_s3_assigning_a_routed_ticket_also_accepts_it(eng):
    ticket_id = cleaning_routed(eng)
    case = eng.assign_staff(ticket_id, CLN, "SIM-STAFF-CLN-B")
    ticket = case.ticket
    assert ticket.status == "IN_PROGRESS" and ticket.accepted_at == MONDAY_9AM
    assert ticket.assignee_id is None  # the document field stays unused
    assert eng.repo.assignments()[ticket_id] == Assignment(
        ticket_id=ticket_id, staff_id="SIM-STAFF-CLN-B", assigned_by=CLN, assigned_at=MONDAY_9AM
    )
    audit = [a for a in case.audit if a.field_name == "staff_id"]
    assert len(audit) == 1 and (audit[0].action, audit[0].actor_id) == (Action.TRANSITION, CLN)
    assert audit[0].new_value == "SIM-STAFF-CLN-B"
    assert case.events[-1].to_status == "IN_PROGRESS"
    assert_base_shape(case)


def test_s3_reassigning_in_progress_replaces_the_row(eng):
    ticket_id = cleaning_routed(eng)
    eng.assign_staff(ticket_id, CLN, "SIM-STAFF-CLN-B")
    case = eng.assign_staff(ticket_id, CLN, "SIM-STAFF-CLN-C")
    assert case.ticket.status == "IN_PROGRESS"
    assert eng.repo.assignments()[ticket_id].staff_id == "SIM-STAFF-CLN-C"
    audit = [a for a in case.audit if a.field_name == "staff_id"]
    assert [(a.old_value, a.new_value) for a in audit] == [
        (None, "SIM-STAFF-CLN-B"),
        ("SIM-STAFF-CLN-B", "SIM-STAFF-CLN-C"),
    ]


def test_s3_staff_of_another_department_is_refused(eng):  # mutation m6 target
    ticket_id = cleaning_routed(eng)
    before = eng.get(ticket_id)
    with pytest.raises(GuardError) as err:
        eng.assign_staff(ticket_id, CLN, "SIM-STAFF-TEC-1")
    assert not isinstance(err.value, InvalidTransitionError)
    assert eng.get(ticket_id) == before and eng.repo.assignments() == {}
    with pytest.raises(GuardError):
        eng.assign_staff(ticket_id, CLN, "SIM-STAFF-NOSUCH")


def test_s3_wrong_roles_and_other_departments_are_denied(eng):
    ticket_id = cleaning_routed(eng)
    for actor in (BPTN, BQL, WAREHOUSE, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.assign_staff(ticket_id, actor, "SIM-STAFF-CLN-A")
    with pytest.raises(ActionDeniedError):  # a technical department on a cleaning ticket
        eng.assign_staff(ticket_id, TEC, "SIM-STAFF-TEC-1")
    case = eng.get(ticket_id)
    assert len(audit_denials(case)) == 5 and case.ticket.status == "ROUTED"
    assert eng.repo.assignments() == {}


def test_s3_only_routed_or_in_progress_tickets_can_be_assigned(eng):
    ticket_id = waiting_ticket(eng)  # ON_HOLD
    with pytest.raises(InvalidTransitionError):
        eng.assign_staff(ticket_id, TEC, "SIM-STAFF-TEC-1")
    assert eng.repo.assignments() == {}
    oos = oos_ticket(eng)
    with pytest.raises(ActionDeniedError):  # no department yet: not a ticket of this department
        eng.assign_staff(oos, CLN, "SIM-STAFF-CLN-A")


def test_s3_staff_list_scopes_and_counts_open_tickets(eng):
    first = cleaning_routed(eng)
    second = eng.receive("Hành lang tầng 5 tòa S2 nhiều rác, cần vệ sinh.", resident_id=RESIDENT).ticket.ticket_id
    eng.assign_staff(first, CLN, "SIM-STAFF-CLN-A")
    eng.assign_staff(second, CLN, "SIM-STAFF-CLN-A")
    rows = {r["staff_id"]: r for r in eng.staff_list(CLN)}
    assert list(rows) == ["SIM-STAFF-CLN-A", "SIM-STAFF-CLN-B", "SIM-STAFF-CLN-C"]
    assert rows["SIM-STAFF-CLN-A"]["open_tickets"] == 2 and rows["SIM-STAFF-CLN-B"]["open_tickets"] == 0
    assert len(eng.staff_list(BQL)) == 7 and len(eng.staff_list(TEC)) == 4
    for actor in (BPTN, WAREHOUSE, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.staff_list(actor)
    third = eng.receive("Hành lang tầng 7 tòa S1 nhiều rác, cần vệ sinh.", resident_id=RESIDENT).ticket.ticket_id
    assert to_ready(eng, third).ticket.status == "READY_FOR_REVIEW"  # never assigned: counts for nobody
    assert {r["staff_id"]: r["open_tickets"] for r in eng.staff_list(CLN)}["SIM-STAFF-CLN-A"] == 2
    eng.assign_staff(first, CLN, "SIM-STAFF-CLN-B")  # moved away from A
    assert {r["staff_id"]: r["open_tickets"] for r in eng.staff_list(CLN)}["SIM-STAFF-CLN-A"] == 1


def test_s3_a_closed_ticket_is_no_longer_open_work(eng):
    ticket_id = cleaning_routed(eng)
    eng.assign_staff(ticket_id, CLN, "SIM-STAFF-CLN-A")
    from tests.test_maintenance.helpers import finish

    finish(eng, ticket_id)
    assert {r["staff_id"]: r["open_tickets"] for r in eng.staff_list(CLN)}["SIM-STAFF-CLN-A"] == 1  # waiting review
    eng.close(ticket_id, BQL, note="Đạt")
    assert {r["staff_id"]: r["open_tickets"] for r in eng.staff_list(CLN)}["SIM-STAFF-CLN-A"] == 0


def test_s3_api_assign_and_staff_fields(env):
    c, tok = env.client, env.tok
    ticket_id = cleaning_routed(env.engine)
    assert c.get("/api/v1/mo/staff", headers=tok("cudan")).status_code == 403
    assert c.get("/api/v1/mo/staff", headers=tok("tiepnhan")).status_code == 403
    mine = c.get("/api/v1/mo/staff", headers=tok("vesinh")).json()
    assert [r["staff_id"] for r in mine] == ["SIM-STAFF-CLN-A", "SIM-STAFF-CLN-B", "SIM-STAFF-CLN-C"]
    assert set(mine[0]) == {"staff_id", "department_id", "name", "skill", "area", "capacity", "open_tickets"}
    assert len(c.get("/api/v1/mo/staff", headers=tok("quanly")).json()) == 7

    path = f"/api/v1/mo/tickets/{ticket_id}/assign"
    assert c.post(path, json={"staff_id": "SIM-STAFF-CLN-B"}, headers=tok("tiepnhan")).status_code == 403
    assert c.post(path, json={"staff_id": "SIM-STAFF-CLN-B"}, headers=tok("kythuat")).status_code == 403
    assert c.post(path, json={"staff_id": "SIM-STAFF-TEC-1"}, headers=tok("vesinh")).status_code == 409
    assert c.post(path, json={}, headers=tok("vesinh")).status_code == 422
    ok = c.post(path, json={"staff_id": "SIM-STAFF-CLN-B"}, headers=tok("vesinh"))
    assert ok.status_code == 200, ok.text
    assert ok.json()["ticket"]["status"] == "IN_PROGRESS"

    summary = {r["ticket_id"]: r for r in c.get("/api/v1/mo/tickets", headers=tok("vesinh")).json()}[ticket_id]
    assert (summary["staff_id"], summary["staff_name"]) == ("SIM-STAFF-CLN-B", "Tổ B")
    row = {r["ticket_id"]: r for r in c.get("/api/v1/bql/tickets", headers=tok("quanly")).json()}[ticket_id]
    assert row["staff_name"] == "Tổ B" and row["assignee_id"] is None
    assert {r["staff_id"]: r["open_tickets"] for r in c.get("/api/v1/mo/staff", headers=tok("vesinh")).json()}[
        "SIM-STAFF-CLN-B"
    ] == 1
    resident = c.get(f"/api/v1/resident/tickets/{ticket_id}", headers=tok("cudan")).json()
    assert "staff" not in json.dumps(resident).lower()  # residents never see who works on it


def test_s3_api_flag_off_refuses_assignment(env, monkeypatch):
    set_flag(monkeypatch, False)
    ticket_id = cleaning_routed(env.engine)
    response = env.client.post(
        f"/api/v1/mo/tickets/{ticket_id}/assign", json={"staff_id": "SIM-STAFF-CLN-B"}, headers=env.tok("vesinh")
    )
    assert response.status_code == 403 and response.json()["detail"]["code"] == "FEATURE_DISABLED"
    assert env.engine.get(ticket_id).ticket.status == "ROUTED"
    catalog = env.client.get("/api/v1/mo/catalog", headers=env.tok("vesinh")).json()
    assert catalog["portal_extras_enabled"] is False


# ======================================================================= §4 rating tags and comment


def closed_cleaning(engine: MaintenanceEngine) -> str:
    ticket_id = cleaning_routed(engine)
    to_ready(engine, ticket_id)
    engine.close(ticket_id, BQL, note="Đạt")
    return ticket_id


def test_s4_rating_keeps_tags_and_comment(eng):
    ticket_id = closed_cleaning(eng)
    case = eng.rate(ticket_id, RESIDENT, 5, tags=["Xử lý nhanh", "Thái độ tốt"], comment="  Rất hài lòng  ")
    assert case.ticket.rating == 5
    detail = eng.repo.rating_details()[ticket_id]
    assert detail == RatingDetail(
        ticket_id=ticket_id, tags=("Xử lý nhanh", "Thái độ tốt"), comment="Rất hài lòng", created_at=MONDAY_9AM
    )
    assert_base_shape(case)
    with pytest.raises(GuardError):  # one rating only
        eng.rate(ticket_id, RESIDENT, 1, tags=["Chậm trễ"])
    assert eng.get(ticket_id).ticket.rating == 5 and eng.repo.rating_details()[ticket_id] == detail


def test_s4_rating_without_tags_is_still_fine(eng):
    ticket_id = closed_cleaning(eng)
    assert eng.rate(ticket_id, RESIDENT, 3).ticket.rating == 3
    assert ticket_id not in eng.repo.rating_details()  # stars alone never need the details table


@pytest.mark.parametrize(
    ("score", "tags", "comment"),
    [
        (5, ["Chậm trễ"], ""),  # a bad tag with a good score
        (4, ["Chưa triệt để"], ""),
        (3, ["Xử lý nhanh"], ""),  # a good tag with a middling score
        (1, ["Thái độ tốt"], ""),
        (5, ["Không có thẻ này"], ""),
        (5, ["Xử lý nhanh", "Xử lý nhanh"], ""),  # twice the same tag
        (5, [], "x" * 501),
    ],
)
def test_s4_wrong_tags_or_long_comment_are_refused_and_nothing_is_written(eng, score, tags, comment):
    ticket_id = closed_cleaning(eng)
    with pytest.raises(InvalidRatingError):
        eng.rate(ticket_id, RESIDENT, score, tags=tags, comment=comment)
    assert eng.get(ticket_id).ticket.rating is None and eng.repo.rating_details() == {}


def test_s4_a_failing_detail_table_leaves_no_rating(eng, monkeypatch):
    from src.maintenance.store.memory import _MemoryTx

    def boom(self, detail):
        raise RuntimeError("table unavailable")

    ticket_id = closed_cleaning(eng)
    monkeypatch.setattr(_MemoryTx, "put_rating_detail", boom)
    with pytest.raises(RuntimeError):
        eng.rate(ticket_id, RESIDENT, 5, tags=["Xử lý nhanh"])
    assert eng.get(ticket_id).ticket.rating is None and eng.repo.rating_details() == {}


def test_s4_api_rating_and_who_sees_it(env):
    c, tok = env.client, env.tok
    ticket_id = closed_cleaning(env.engine)
    path = f"/api/v1/resident/tickets/{ticket_id}/rating"
    for body in (
        {"score": 5, "tags": ["Chậm trễ"]},
        {"score": 2, "tags": ["Xử lý nhanh"]},
        {"score": 5, "tags": ["Lạ"]},
        {"score": 5, "comment": "x" * 501},
        {"score": 6},
    ):
        assert c.post(path, json=body, headers=tok("cudan")).status_code == 422, body
    assert c.post(path, json={"score": 5}, headers=tok("quanly")).status_code == 403
    ok = c.post(path, json={"score": 5, "tags": ["Xử lý nhanh"], "comment": "Gọn gàng"}, headers=tok("cudan"))
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert (body["rating"], body["rating_tags"], body["rating_comment"]) == (5, ["Xử lý nhanh"], "Gọn gàng")
    again = c.get(f"/api/v1/resident/tickets/{ticket_id}", headers=tok("cudan")).json()
    assert (again["rating_tags"], again["rating_comment"]) == (["Xử lý nhanh"], "Gọn gàng")

    row = {r["ticket_id"]: r for r in c.get("/api/v1/bql/tickets", headers=tok("quanly")).json()}[ticket_id]
    assert (row["rating"], row["rating_tags"], row["rating_comment"]) == (5, ["Xử lý nhanh"], "Gọn gàng")
    summary = {r["ticket_id"]: r for r in c.get("/api/v1/mo/tickets", headers=tok("vesinh")).json()}[ticket_id]
    assert (summary["rating"], summary["rating_tags"], summary["rating_comment"]) == (5, ["Xử lý nhanh"], "Gọn gàng")
    assert RESIDENT not in json.dumps(summary)  # the department never learns who rated
    other = {r["ticket_id"]: r for r in c.get("/api/v1/mo/tickets", headers=tok("kythuat")).json()}
    assert ticket_id not in other  # another department does not see the ticket at all


def test_s4_api_unrated_ticket_has_empty_tags(env):
    ticket_id = closed_cleaning(env.engine)
    body = env.client.get(f"/api/v1/resident/tickets/{ticket_id}", headers=env.tok("cudan")).json()
    assert (body["rating"], body["rating_tags"], body["rating_comment"]) == (None, [], "")
    row = {r["ticket_id"]: r for r in env.client.get("/api/v1/bql/tickets", headers=env.tok("quanly")).json()}[
        ticket_id
    ]
    assert (row["rating_tags"], row["rating_comment"]) == ([], "")


def test_s4_api_flag_off_keeps_the_stars_and_refuses_tags(env, monkeypatch):
    set_flag(monkeypatch, False)
    c, tok = env.client, env.tok
    ticket_id = closed_cleaning(env.engine)
    path = f"/api/v1/resident/tickets/{ticket_id}/rating"
    refused = c.post(path, json={"score": 5, "tags": ["Xử lý nhanh"]}, headers=tok("cudan"))
    assert refused.status_code == 403 and refused.json()["detail"]["code"] == "FEATURE_DISABLED"
    assert env.engine.get(ticket_id).ticket.rating is None
    assert c.post(path, json={"score": 5}, headers=tok("cudan")).status_code == 200


# ======================================================================= §5 Agent fields


def test_s5_agent_fields_on_the_ticket_rows(clock, agent_cleanup):
    client = ScriptedClient({"không sáng": light_reply(), "phí dịch vụ": oos_reply()})
    env = agent_env(clock, client)
    c, tok = env.client, env.tok
    routed = c.post("/api/v1/resident/tickets", json={"original_description": LIGHT}, headers=tok("cudan")).json()
    fee = c.post("/api/v1/resident/tickets", json={"original_description": FEE_TEXT}, headers=tok("cudan")).json()
    summary = {r["ticket_id"]: r for r in c.get("/api/v1/mo/tickets", headers=tok("quanly")).json()}
    rows = {r["ticket_id"]: r for r in c.get("/api/v1/bql/tickets", headers=tok("quanly")).json()}
    for table in (summary, rows):
        light = table[routed["ticket_id"]]
        assert (light["agent_source"], light["agent_department"], light["agent_scope"]) == (
            "AGENT",
            "DEPT_TECHNICAL",
            "IN_SCOPE",
        )
        out = table[fee["ticket_id"]]
        assert (out["agent_source"], out["agent_department"], out["agent_scope"]) == ("AGENT", None, "OUT_OF_SCOPE")
    detail = c.get(f"/api/v1/mo/tickets/{routed['ticket_id']}", headers=tok("quanly")).json()
    assert detail["agent_decision"]["source"] == "AGENT" and detail["agent_decision"]["decision"]["reasoning"]


def test_s5_agent_fields_are_empty_without_an_agent_decision(clock, agent_cleanup):
    env = agent_env(clock, FailingClient("timeout"))
    c, tok = env.client, env.tok
    created = c.post("/api/v1/resident/tickets", json={"original_description": LIGHT}, headers=tok("cudan")).json()
    row = {r["ticket_id"]: r for r in c.get("/api/v1/bql/tickets", headers=tok("quanly")).json()}[created["ticket_id"]]
    assert (row["agent_source"], row["agent_department"], row["agent_scope"]) == ("FALLBACK_RULE", None, None)


def test_s5_no_agent_means_no_fields(env):
    env.engine.receive(LIGHTING, resident_id=RESIDENT)
    rows = env.client.get("/api/v1/mo/tickets", headers=env.tok("quanly")).json()
    assert [(r["agent_source"], r["agent_department"], r["agent_scope"]) for r in rows] == [(None, None, None)]


# ======================================================================= the store contract and the flag


def test_memory_repository_assignment_and_rating_contract(eng):
    when = datetime.fromisoformat("2026-09-28T09:00:00+07:00")
    first = Assignment(ticket_id="SIM-TKT-0001", staff_id="SIM-STAFF-CLN-A", assigned_by=CLN, assigned_at=when)
    second = first.model_copy(update={"staff_id": "SIM-STAFF-CLN-B"})
    detail = RatingDetail(ticket_id="SIM-TKT-0001", tags=("Xử lý nhanh",), comment="ok", created_at=when)
    with eng.repo.transaction() as tx:
        tx.put_assignment(first)
        tx.put_rating_detail(detail)
        assert eng.repo.assignments() == {}  # nothing visible before commit
    assert eng.repo.assignments() == {first.ticket_id: first}
    with eng.repo.transaction() as tx:
        tx.put_assignment(second)
    assert eng.repo.assignments() == {first.ticket_id: second}  # replaced
    assert eng.repo.rating_details() == {detail.ticket_id: detail}
    with pytest.raises(RuntimeError), eng.repo.transaction() as tx:
        tx.put_assignment(first)
        raise RuntimeError("rollback")
    assert eng.repo.assignments() == {first.ticket_id: second}  # the rolled-back write is gone
    eng.reset(with_fixtures=False)
    assert eng.repo.assignments() == {} and eng.repo.rating_details() == {}


def test_flag_defaults_follow_the_store():
    memory = get_settings().model_copy(update={"mo_store": "memory", "mo_portal_extras": None})
    postgres = get_settings().model_copy(update={"mo_store": "postgres", "mo_portal_extras": None})
    assert memory.portal_extras_enabled() is True and postgres.portal_extras_enabled() is False
    assert postgres.model_copy(update={"mo_portal_extras": True}).portal_extras_enabled() is True
    assert memory.model_copy(update={"mo_portal_extras": False}).portal_extras_enabled() is False


def test_the_document_shape_is_unchanged_by_the_whole_batch(eng):
    """The one assertion that matters for the shared database: assignment, approval and rating add no field."""
    ticket_id = cleaning_routed(eng)
    eng.assign_staff(ticket_id, CLN, "SIM-STAFF-CLN-A")
    assert_base_shape(eng.get(ticket_id))
    waiting = waiting_ticket(eng)
    assert_base_shape(eng.get(waiting))
    assert_base_shape(eng.approve_materials(waiting, WAREHOUSE))


# ======================================================================= PostgreSQL (--pg only, local docker *_test)


@pytest.fixture
def pg_extras(pg_repo, pg_url):
    """A Postgres repository with the feature on and empty `assignments` / `rating_details` tables."""
    from sqlalchemy import text

    from src.maintenance.store.postgres import PostgresRepository

    with pg_repo._engine.begin() as conn:
        conn.execute(text("delete from maintops.assignments"))
        conn.execute(text("delete from maintops.rating_details"))
    return PostgresRepository(pg_url, portal_extras=True)


@pytest.mark.pg
def test_pg_assignment_and_rating_contract(pg_extras):
    when = datetime.fromisoformat("2026-09-28T09:00:00+07:00")
    first = Assignment(ticket_id="SIM-TKT-0001", staff_id="SIM-STAFF-CLN-A", assigned_by=CLN, assigned_at=when)
    detail = RatingDetail(ticket_id="SIM-TKT-0001", tags=("Xử lý nhanh", "Thái độ tốt"), comment="ok", created_at=when)
    assert pg_extras.assignments() == {} and pg_extras.rating_details() == {}
    with pg_extras.transaction() as tx:
        tx.put_assignment(first)
        tx.put_rating_detail(detail)
    assert pg_extras.assignments() == {first.ticket_id: first}
    assert pg_extras.rating_details() == {detail.ticket_id: detail}
    second = first.model_copy(update={"staff_id": "SIM-STAFF-CLN-B"})
    with pg_extras.transaction() as tx:
        tx.put_assignment(second)
    assert pg_extras.assignments() == {first.ticket_id: second}
    with pytest.raises(RuntimeError), pg_extras.transaction() as tx:
        tx.put_assignment(first)
        raise RuntimeError("rollback")
    assert pg_extras.assignments() == {first.ticket_id: second}


@pytest.mark.pg
def test_pg_engine_assign_and_rate_roundtrip(pg_extras):
    engine = MaintenanceEngine(repo=pg_extras, clock=Clock(MONDAY_9AM))
    ticket_id = engine.receive(CLEANING, resident_id=RESIDENT).ticket.ticket_id
    engine.assign_staff(ticket_id, CLN, "SIM-STAFF-CLN-B")
    assert pg_extras.assignments()[ticket_id].staff_id == "SIM-STAFF-CLN-B"
    from tests.test_maintenance.helpers import finish

    finish(engine, ticket_id)
    engine.close(ticket_id, BQL, note="Đạt")
    engine.rate(ticket_id, RESIDENT, 5, tags=["Xử lý nhanh"], comment="Tốt")
    assert pg_extras.rating_details()[ticket_id].tags == ("Xử lý nhanh",)


@pytest.mark.pg
def test_pg_feature_off_never_touches_the_tables(pg_repo):
    assert pg_repo.assignments() == {} and pg_repo.rating_details() == {}
    when = datetime.fromisoformat("2026-09-28T09:00:00+07:00")
    with pytest.raises(GuardError), pg_repo.transaction() as tx:
        tx.put_assignment(Assignment(ticket_id="SIM-TKT-0001", staff_id="s", assigned_by=CLN, assigned_at=when))


@pytest.mark.pg
def test_pg_check_accepts_the_previous_revision_only_while_the_feature_is_off(pg_repo, pg_url):
    from sqlalchemy import text

    from src.maintenance.store.postgres import HEAD_REVISION, PostgresRepository

    with pg_repo._engine.begin() as conn:
        conn.execute(text("update maintops.alembic_version set version_num = '0003_material_items'"))
    try:
        PostgresRepository(pg_url, custom_materials=True).check()  # extras off: a database at 0003 is fine
        with pytest.raises(RuntimeError, match="upgrade head"):
            PostgresRepository(pg_url, custom_materials=True, portal_extras=True).check()
    finally:
        with pg_repo._engine.begin() as conn:
            conn.execute(text("update maintops.alembic_version set version_num = :v"), {"v": HEAD_REVISION})
    PostgresRepository(pg_url, custom_materials=True, portal_extras=True).check()


@pytest.mark.pg
def test_pg_migration_0004_creates_and_drops_only_its_tables(pg_url):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text

    from src.maintenance.store.postgres import ALEMBIC_INI, sql_engine

    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["database_url"] = pg_url
    exists = text(
        "select to_regclass('maintops.assignments') is not null and to_regclass('maintops.rating_details') is not null"
    )
    try:
        command.downgrade(cfg, "0003_material_items")
        with sql_engine(pg_url).connect() as conn:
            assert conn.execute(exists).scalar() is False
            assert conn.execute(text("select to_regclass('maintops.material_items') is not null")).scalar() is True
            assert conn.execute(text("select to_regclass('maintops.cases') is not null")).scalar() is True
    finally:
        command.upgrade(cfg, "head")
    with sql_engine(pg_url).connect() as conn:
        assert conn.execute(exists).scalar() is True
        assert conn.execute(text("select version_num from maintops.alembic_version")).scalar() == "0004_portal_extras"


# ======================================================================= WP7 review: P5 (old backend) and P7 (reservation)


def test_wp7_p7_approval_hands_the_stock_out_so_two_tickets_cannot_share_it(eng):
    first = waiting_ticket(eng, stock=2)
    approved = eng.approve_materials(first, WAREHOUSE)
    assert [m.issued_qty for m in approved.material_lines] == [2]
    assert eng.repo.stock_of(LAMP2) == 0
    second = routed_ticket(eng, "Đèn hành lang tầng 7 tòa S2 không sáng.")  # another place: not a duplicate
    eng.accept(second, TEC)
    eng.confirm_materials(second, TEC, lines=[PlannedMaterial(item_code=LAMP2, planned_qty=2)], note="Đèn tuýp")
    with pytest.raises(StockShortError):
        eng.approve_materials(second, WAREHOUSE)
    assert eng.get(second).ticket.status == "ON_HOLD"


def test_wp7_p7_issuing_after_approval_does_not_take_the_stock_twice(eng):
    ticket_id = waiting_ticket(eng, stock=5)
    eng.approve_materials(ticket_id, WAREHOUSE)
    assert eng.repo.stock_of(LAMP2) == 3
    eng.record_material(ticket_id, TEC, LAMP2, issued_qty=2, used_qty=2)
    assert eng.repo.stock_of(LAMP2) == 3


def test_wp7_p5_flag_off_keeps_the_old_flow_for_the_shared_database(eng, monkeypatch):
    """MO_PORTAL_EXTRAS off (default on postgres): a plan never parks the ticket waiting for approval, so the old
    backend reading the same database never meets that state."""
    import src.config as config

    settings = config.get_settings().model_copy(update={"mo_portal_extras": False})
    monkeypatch.setattr(config, "get_settings", lambda: settings)
    ticket_id = in_progress_ticket(eng)
    case = eng.confirm_materials(
        ticket_id, TEC, lines=[PlannedMaterial(item_code=LAMP2, planned_qty=2)], note="Đèn tuýp"
    )
    assert case.ticket.status == "IN_PROGRESS" and case.ticket.blocker is None


# ======================================================================= WP7 review round 2: stock counts what is still to hand out

LAMP1 = "SIM-MAT-LAMP-01"  # catalog stock 5


def approved_ticket(engine: MaintenanceEngine, qty: float, stock: float) -> str:
    ticket_id = in_progress_ticket(engine)
    engine.receive_stock(WAREHOUSE, LAMP2, stock)
    engine.confirm_materials(ticket_id, TEC, lines=[PlannedMaterial(item_code=LAMP2, planned_qty=qty)], note="Đèn tuýp")
    engine.approve_materials(ticket_id, WAREHOUSE)
    return ticket_id


def test_wp7_new1b_asking_another_item_after_the_first_took_all_the_stock(eng):
    ticket_id = approved_ticket(eng, 1, stock=1)
    assert eng.repo.stock_of(LAMP2) == 0
    lines = [PlannedMaterial(item_code=LAMP2, planned_qty=1), PlannedMaterial(item_code=LAMP1, planned_qty=1)]
    eng.confirm_materials(ticket_id, TEC, lines=lines, note="Thêm bóng LED")
    case = eng.approve_materials(ticket_id, WAREHOUSE)  # LAMP2 already handed out: only LAMP1 is needed
    assert case.ticket.status == "IN_PROGRESS"
    assert {m.item_code: m.issued_qty for m in case.material_lines} == {LAMP2: 1, LAMP1: 1}
    assert (eng.repo.stock_of(LAMP2), eng.repo.stock_of(LAMP1)) == (0, 4)


def test_wp7_new1_one_more_of_the_same_item_needs_only_the_difference(eng):
    ticket_id = approved_ticket(eng, 1, stock=2)
    eng.confirm_materials(ticket_id, TEC, lines=[PlannedMaterial(item_code=LAMP2, planned_qty=2)], note="Thêm 1")
    assert eng.approve_materials(ticket_id, WAREHOUSE).ticket.status == "IN_PROGRESS"
    assert eng.repo.stock_of(LAMP2) == 0


def test_wp7_new2_fewer_than_handed_out_gives_the_rest_back(eng):
    ticket_id = approved_ticket(eng, 3, stock=3)
    case = eng.confirm_materials(
        ticket_id, TEC, lines=[PlannedMaterial(item_code=LAMP2, planned_qty=1)], note="Chỉ cần 1"
    )
    assert [m.issued_qty for m in case.material_lines] == [1]
    assert eng.repo.stock_of(LAMP2) == 2
    assert eng.approve_materials(ticket_id, WAREHOUSE).ticket.status == "IN_PROGRESS"
    assert eng.repo.stock_of(LAMP2) == 2


def test_wp7_new3_cancel_gives_unused_stock_back(eng):
    ticket_id = approved_ticket(eng, 2, stock=2)
    assert eng.repo.stock_of(LAMP2) == 0
    eng.cancel(ticket_id, BQL, cancel_reason="Cư dân tự sửa")
    assert eng.repo.stock_of(LAMP2) == 2
