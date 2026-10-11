"""Plan 11 WP1 (SPEC-P01): backend additions for the portal.

  §1  six portal accounts (password 123456) + resident profile on /auth/login and /auth/me
  §2  "Viec cua BQL": BPTN to-bql, BQL handled / return-to-bptn on an OUT_OF_SCOPE ticket
  §3  materials outside the catalog (engine, repository, routes, flag)
  §4  two routes over existing engine methods: wrong department (department) and BQL decision

Engine tests call the engine directly; every route also has a test through `TestClient` with a real login token.
The ticket document must keep the shape older code reads (Supabase is shared with an older backend): the
"compatibility" tests list the fields and enum values of the base commit statically.
"""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from src.api import auth as auth_module
from src.api.auth import Account, AuthService, get_auth, load_accounts
from src.api.routers import maintenance as maintenance_router
from src.api.routers.maintenance import get_engine
from src.config import get_settings
from src.main import app
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.enums import Action, ClosureKind, ReasonCode, TicketStatus
from src.maintenance.errors import ActionDeniedError, InvalidTransitionError
from src.maintenance.models import Blocker, Case, PlannedMaterial, RawTicket, Ticket
from src.maintenance.store.base import GuardError, NotFoundError
from tests.test_maintenance.helpers import (
    BPTN,
    BQL,
    CLN,
    LIGHTING,
    MONDAY_9AM,
    RESIDENT,
    TEC,
    WAREHOUSE,
    Clock,
)

FEE_REPORT = "Hóa đơn phí dịch vụ tháng này tính sai, nhờ kiểm tra lại"
SMOKE_REPORT = "Có khói bốc ra từ phòng kỹ thuật tầng 3 tòa S1"
PORTAL_PASSWORD = "123456"
LEGACY_PASSWORD = "Demo@2026"
NOTE = "Ghi chú xử lý"
PVC = "Ống nước PVC 21"

# ---------------------------------------------------------------------- the base commit's document shape (static)

BASE_CASE_FIELDS = frozenset(
    "additions agent_decision audit checklist_items classification draft events evidence evidence_round_start "
    "execution_snapshots material_lines not_duplicate_of notifications planned_for_playbook planned_materials "
    "proposal ticket".split()
)
BASE_TICKET_FIELDS = frozenset(
    "accepted_at asset_resolution assignee_id blocker cancel_reason closed_at closed_by closure_kind dataset_version "
    "department_id dispatched_at duplicate_count flags follow_up_of locked_fields merged_children merged_into "
    "priority priority_reason priority_rule_id priority_source proposed_department_id rating raw "
    "raw_integrity_marker related_ticket_ids resident_id review_status rework_count risk_level risk_signals "
    "safety_clear_reason safety_cleared_at safety_cleared_by safety_context source_revision split_category "
    "split_children split_from status synthetic ticket_id wrong_department_return_count".split()
)
BASE_BLOCKER_FIELDS = frozenset(
    "auto_retry_count code escalate_at escalated eta internal_note next_retry_at owner_role public_message "
    "related_ticket_id resolved_at resolved_by resume_step since".split()
)
BASE_ACTIONS = frozenset(
    "ACTION_DENIED ADD_EVIDENCE ADD_RESIDENT_INFO ADD_RESIDENT_PHOTO ADJUST_INVENTORY AGENT_DECISION APPROVE_MATERIAL "
    "ASSESS_SAFETY BPTN_RESOLVE BQL_KEEP_DEPARTMENT BQL_MERGE BQL_REASSIGN_TO_BPTN CHECK_MATERIAL_STOCK CREATE_DRAFT "
    "CREATE_FOLLOW_UP CREATE_PROPOSAL EDIT_CATALOG EDIT_RAW EMERGENCY_CLOSE EMERGENCY_DOWNGRADE INGEST LINK_TICKETS "
    "LOOKUP_ASSET MERGE_UNDO RATE_TICKET RECEIVE_STOCK RECONCILE REPORT_COMPLETE REPORT_WRONG_DEPT RUN_JOBS "
    "RUN_PIPELINE SAFETY_CONFIRM_SAFE SAFETY_ESCALATE SAFETY_REQUEST_INFO SEND_RESIDENT_MESSAGE SET_ASSIGNEE "
    "SET_PRIORITY SPLIT_TICKET SPLIT_UNDO TRANSITION UPDATE_CHECKLIST UPDATE_MATERIAL".split()
)
BASE_REASONS = frozenset(
    "ASSET_UNCLEAR BLOCKED_ONSITE CATEGORY_UNCLEAR DUPLICATE EMERGENCY_PENDING_BQL MISSING_INFO NOT_ACCEPTED "
    "OUT_OF_HOURS OUT_OF_SCOPE PENDING_REVIEW REWORK SAFETY_REVIEW_REQUIRED WAITING_EMERGENCY WAITING_MATERIAL "
    "WRONG_DEPT WRONG_DEPT_AFTER_START".split()
)
BASE_STATUSES = frozenset(
    "CANCELLED CLOSED IN_PROGRESS MERGED NEED_INFO ON_HOLD READY_FOR_REVIEW RECEIVED ROUTED VERIFYING".split()
)
BASE_CLOSURE_KINDS = frozenset({"EMERGENCY_HANDLED", "NORMAL"})
# SPEC-P01 §2 says NORMAL, but the Ticket validator refuses a CLOSED ticket without department_id unless the closure is
# EMERGENCY_HANDLED (see BQL_HANDLED_CLOSURE in engine.py and the open question in the WP1 report).
HANDLED_CLOSURE = "EMERGENCY_HANDLED"


def assert_base_shape(case: Case) -> None:
    """The document after a WP1 step only has keys older code knows, and older code's model still reads it."""
    assert set(Case.model_fields) == BASE_CASE_FIELDS
    assert set(Ticket.model_fields) == BASE_TICKET_FIELDS
    assert set(Blocker.model_fields) == BASE_BLOCKER_FIELDS
    dump = case.model_dump(mode="json")
    assert set(dump) <= BASE_CASE_FIELDS
    assert set(dump["ticket"]) <= BASE_TICKET_FIELDS
    if dump["ticket"]["blocker"] is not None:
        assert set(dump["ticket"]["blocker"]) <= BASE_BLOCKER_FIELDS
    assert {a["action"] for a in dump["audit"]} <= BASE_ACTIONS
    assert Case.model_validate(dump) == case


def test_enums_of_the_document_are_those_of_the_base_commit():
    assert {a.value for a in Action} == BASE_ACTIONS
    assert {r.value for r in ReasonCode} == BASE_REASONS
    assert {s.value for s in TicketStatus} == BASE_STATUSES
    assert {k.value for k in ClosureKind} == BASE_CLOSURE_KINDS


# ---------------------------------------------------------------------- fixtures


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
    """Engine + real accounts behind the HTTP API; `tok(name)` logs in and returns the Bearer header."""
    auth = AuthService({a.username: a for a in load_accounts().accounts})
    app.dependency_overrides[get_engine] = lambda: eng
    app.dependency_overrides[get_auth] = lambda: auth
    client = TestClient(app)
    cache: dict[str, dict] = {}

    def tok(username: str, password: str = PORTAL_PASSWORD) -> dict:
        if username not in cache:
            response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
            assert response.status_code == 200, response.text
            cache[username] = {"Authorization": f"Bearer {response.json()['access_token']}"}
        return cache[username]

    yield SimpleNamespace(engine=eng, client=client, tok=tok, clock=clock)
    app.dependency_overrides.pop(get_engine, None)
    app.dependency_overrides.pop(get_auth, None)


def set_flag(monkeypatch, value: bool | None) -> None:
    settings = get_settings().model_copy(update={"mo_custom_materials": value})
    monkeypatch.setattr(maintenance_router, "get_settings", lambda: settings)


def oos_ticket(engine: MaintenanceEngine, text: str = FEE_REPORT) -> str:
    case = engine.receive(text, resident_id=RESIDENT)
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "OUT_OF_SCOPE"
    return case.ticket.ticket_id


def routed_ticket(engine: MaintenanceEngine, text: str = LIGHTING) -> str:
    case = engine.receive(text, resident_id=RESIDENT)
    assert case.ticket.status == "ROUTED"
    return case.ticket.ticket_id


def in_progress_ticket(engine: MaintenanceEngine) -> str:
    ticket_id = routed_ticket(engine)
    engine.accept(ticket_id, TEC)
    assert engine.get(ticket_id).ticket.status == "IN_PROGRESS"
    return ticket_id


def audit_denials(case: Case) -> list:
    return [a for a in case.audit if a.action == Action.ACTION_DENIED]


# ======================================================================= §1 accounts

PORTAL_ACCOUNTS = [
    ("cudan", "SIM-ACTOR-RESIDENT-01", "Nguyễn Minh Anh", "RESIDENT", None),
    ("tiepnhan", "SIM-ACTOR-BPTN-01", "Phạm Thu Trang", "BPTN", None),
    ("quanly", "SIM-ACTOR-BQL-01", "Vũ Hoàng Long", "BQL", None),
    ("vesinh", "SIM-ACTOR-DEPT-CLN-01", "Ngô Thị Lan", "DEPARTMENT", "DEPT_CLEANING"),
    ("kythuat", "SIM-ACTOR-DEPT-TEC-01", "Đặng Văn Hùng", "DEPARTMENT", "DEPT_TECHNICAL"),
    ("kho", "SIM-ACTOR-WAREHOUSE-01", "Trần Minh Kho", "WAREHOUSE", None),
]
LEGACY_ACCOUNTS = {
    "cudan01": "SIM-ACTOR-RESIDENT-01",
    "cudan02": "SIM-ACTOR-RESIDENT-02",
    "bptn01": "SIM-ACTOR-BPTN-01",
    "vesinh01": "SIM-ACTOR-DEPT-CLN-01",
    "kythuat01": "SIM-ACTOR-DEPT-TEC-01",
    "kho01": "SIM-ACTOR-WAREHOUSE-01",
    "bql01": "SIM-ACTOR-BQL-01",
    "qa01": "SIM-ACTOR-QA-01",
}


@pytest.mark.parametrize(("username", "actor_id", "display", "role", "department"), PORTAL_ACCOUNTS)
def test_s1_portal_account_logs_in_with_123456(env, username, actor_id, display, role, department):
    response = env.client.post("/api/v1/auth/login", json={"username": username, "password": PORTAL_PASSWORD})
    assert response.status_code == 200, response.text
    user = response.json()["user"]
    assert (user["username"], user["actor_id"], user["display_name"]) == (username, actor_id, display)
    assert (user["role"], user["department_id"]) == (role, department)
    me = env.client.get("/api/v1/auth/me", headers=env.tok(username)).json()
    assert me == user


def test_s1_warehouse_account_role(env):
    body = env.client.post("/api/v1/auth/login", json={"username": "kho", "password": PORTAL_PASSWORD}).json()
    assert body["user"]["role"] == "WAREHOUSE"


def test_s1_resident_profile_on_login_and_me(env):
    login = env.client.post("/api/v1/auth/login", json={"username": "cudan", "password": PORTAL_PASSWORD}).json()
    assert login["user"]["profile"] == {"tower": "S2.05", "floor": "12", "apartment": "1208"}
    me = env.client.get("/api/v1/auth/me", headers=env.tok("cudan")).json()
    assert me["profile"]["tower"] == "S2.05"
    accounts = {a.username: a for a in load_accounts().accounts}
    assert accounts["cudan01"].profile.model_dump() == {"tower": "S2.05", "floor": "14", "apartment": "1402"}
    assert accounts["cudan02"].profile.model_dump() == {"tower": "S1.12", "floor": "8", "apartment": "0805"}
    staff = env.client.get("/api/v1/auth/me", headers=env.tok("tiepnhan")).json()
    assert staff["profile"] is None


def test_s1_legacy_accounts_are_untouched(env):
    accounts = {a.username: a for a in load_accounts().accounts}
    assert len(accounts) == 14
    for username, actor_id in LEGACY_ACCOUNTS.items():
        assert accounts[username].actor_id == actor_id
        response = env.client.post("/api/v1/auth/login", json={"username": username, "password": LEGACY_PASSWORD})
        assert response.status_code == 200, (username, response.text)
    assert load_accounts().shared_test_password == LEGACY_PASSWORD
    wrong = env.client.post("/api/v1/auth/login", json={"username": "cudan01", "password": PORTAL_PASSWORD})
    assert wrong.status_code == 401  # 123456 belongs to the six portal accounts only


def test_s1_account_model_still_forbids_unknown_fields():
    base = {"username": "abc", "display_name": "A", "actor_id": "SIM-ACTOR-BQL-01", "password_hash": "x"}
    assert Account.model_validate(base).profile is None
    with pytest.raises(ValidationError):
        Account.model_validate({**base, "tower": "S1"})
    with pytest.raises(ValidationError):
        Account.model_validate({**base, "profile": {"tower": "S1", "floor": "1", "apartment": "2", "x": "y"}})
    assert auth_module.Me.model_fields["profile"].default is None


def test_s1_demo_accounts_list_has_the_portal_accounts(env):
    body = env.client.get("/api/v1/auth/demo-accounts").json()
    assert {a["username"] for a in body["accounts"]} >= {name for name, *_ in PORTAL_ACCOUNTS}
    assert "password_hash" not in str(body)


# ======================================================================= §2 Viec cua BQL (engine)


def test_s2_to_bql_marks_the_blocker_escalated_and_notifies_bql(eng):
    ticket_id = oos_ticket(eng)
    case = eng.send_to_bql(ticket_id, BPTN, note="Phí dịch vụ, BQL xử lý")
    ticket = case.ticket
    assert ticket.status == "VERIFYING"
    assert ticket.blocker.code == "OUT_OF_SCOPE" and ticket.blocker.escalated is True
    assert ticket.blocker.owner_role == "BPTN"
    audit = case.audit[-1]
    assert (audit.actor_id, audit.field_name, audit.reason) == (BPTN, "blocker.escalated", "Phí dịch vụ, BQL xử lý")
    assert (audit.old_value, audit.new_value) == (False, True)
    note = case.notifications[-1]
    assert (note.type, note.audience) == ("escalation", "BQL")
    assert note.payload == {"reason_code": "OUT_OF_SCOPE", "by": "BPTN"}
    assert_base_shape(case)


def test_s2_full_path_to_bql_then_handled_closes_normally(eng):
    ticket_id = oos_ticket(eng)
    eng.send_to_bql(ticket_id, BPTN, note="Chuyển BQL")
    case = eng.bql_handle_out_of_scope(ticket_id, BQL, note="Đã gọi cư dân, hướng dẫn nộp phí")
    ticket = case.ticket
    assert ticket.status == "CLOSED" and ticket.blocker is None
    assert ticket.closure_kind == HANDLED_CLOSURE and ticket.closed_by == BQL and ticket.closed_at == MONDAY_9AM
    event = case.events[-1]
    assert (event.from_status, event.to_status, event.actor_id) == ("VERIFYING", "CLOSED", BQL)
    assert event.public_message == "Ban quản lý đã xử lý phản ánh."
    assert event.internal_note == "Đã gọi cư dân, hướng dẫn nộp phí"
    assert case.audit[-1].field_name == "closure_kind" and case.audit[-1].new_value == HANDLED_CLOSURE
    assert_base_shape(case)
    rated = eng.rate(ticket_id, RESIDENT, 5)  # CLOSED ⇒ the resident can rate, like any closed ticket
    assert rated.ticket.rating == 5


def test_s2_handled_works_before_escalation_too(eng):
    ticket_id = oos_ticket(eng)
    case = eng.bql_handle_out_of_scope(ticket_id, BQL, note="BQL xử lý ngay")
    assert case.ticket.status == "CLOSED" and case.ticket.closure_kind == HANDLED_CLOSURE


def test_s2_return_to_bptn_clears_escalation_and_recomputes_timers(eng, clock):
    ticket_id = oos_ticket(eng)
    eng.send_to_bql(ticket_id, BPTN, note="Chuyển BQL")
    clock.advance(hours=1)
    case = eng.bql_return_to_bptn(ticket_id, BQL, note="Thuộc BPTN liên hệ cư dân")
    blocker = case.ticket.blocker
    assert case.ticket.status == "VERIFYING" and blocker.code == "OUT_OF_SCOPE"
    assert blocker.escalated is False and blocker.owner_role == "BPTN"
    assert blocker.since == clock.now
    assert blocker.next_retry_at is not None and blocker.next_retry_at > clock.now
    assert blocker.escalate_at is not None and blocker.escalate_at > clock.now
    audit = case.audit[-1]
    assert (audit.actor_id, audit.field_name, audit.reason) == (BQL, "blocker.escalated", "Thuộc BPTN liên hệ cư dân")
    assert (audit.old_value, audit.new_value) == (True, False)
    assert_base_shape(case)
    again = eng.send_to_bql(ticket_id, BPTN, note="Chuyển lại BQL")  # BPTN sees it again and may escalate again
    assert again.ticket.blocker.escalated is True


def test_s2_to_bql_twice_is_invalid(eng):  # mutation m1 target
    ticket_id = oos_ticket(eng)
    eng.send_to_bql(ticket_id, BPTN, note="Chuyển BQL")
    before = eng.get(ticket_id)
    with pytest.raises(InvalidTransitionError):
        eng.send_to_bql(ticket_id, BPTN, note="Chuyển BQL lần hai")
    after = eng.get(ticket_id)
    assert after == before
    assert len([n for n in after.notifications if n.type == "escalation"]) == 1


def test_s2_return_without_escalation_is_invalid(eng):
    ticket_id = oos_ticket(eng)
    with pytest.raises(InvalidTransitionError):
        eng.bql_return_to_bptn(ticket_id, BQL, note="Chưa leo thang mà trả về")
    assert eng.get(ticket_id).ticket.blocker.escalated is False


def test_s2_handled_needs_an_out_of_scope_blocker(eng):  # mutation m2 target
    routed = routed_ticket(eng)
    emergency = eng.receive(SMOKE_REPORT, resident_id=RESIDENT).ticket.ticket_id
    assert eng.get(emergency).ticket.blocker.code == "EMERGENCY_PENDING_BQL"
    for ticket_id in (routed, emergency):
        before = eng.get(ticket_id)
        with pytest.raises(InvalidTransitionError):
            eng.bql_handle_out_of_scope(ticket_id, BQL, note="Không phải ngoài phạm vi")
        assert eng.get(ticket_id) == before
    with pytest.raises(InvalidTransitionError):
        eng.send_to_bql(routed, BPTN, note="Đã giao phòng ban")
    with pytest.raises(InvalidTransitionError):
        eng.bql_return_to_bptn(routed, BQL, note="Đã giao phòng ban")


def test_s2_wrong_roles_are_denied_and_audited(eng):
    ticket_id = oos_ticket(eng)
    eng.send_to_bql(ticket_id, BPTN, note="Chuyển BQL")
    for actor in (BQL, CLN, WAREHOUSE, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.send_to_bql(ticket_id, actor, note="x")
    for actor in (BPTN, CLN, TEC, WAREHOUSE, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.bql_handle_out_of_scope(ticket_id, actor, note="x")
        with pytest.raises(ActionDeniedError):
            eng.bql_return_to_bptn(ticket_id, actor, note="x")
    case = eng.get(ticket_id)
    assert len(audit_denials(case)) == 4 + 5 + 5
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.escalated is True  # nothing else changed
    with pytest.raises(ActionDeniedError):
        eng.send_to_bql(ticket_id, "SIM-ACTOR-UNKNOWN", note="x")


@pytest.mark.parametrize("note", ["", "   ", None])
def test_s2_blank_note_is_a_guard_error(eng, note):
    ticket_id = oos_ticket(eng)
    with pytest.raises(GuardError) as err:
        eng.send_to_bql(ticket_id, BPTN, note=note)
    assert not isinstance(err.value, InvalidTransitionError)
    eng.send_to_bql(ticket_id, BPTN, note="ok")
    with pytest.raises(GuardError):
        eng.bql_return_to_bptn(ticket_id, BQL, note=note)
    with pytest.raises(GuardError):
        eng.bql_handle_out_of_scope(ticket_id, BQL, note=note)
    assert eng.get(ticket_id).ticket.status == "VERIFYING"


def test_s2_unknown_ticket_is_not_found(eng):
    with pytest.raises(NotFoundError):
        eng.send_to_bql("SIM-TKT-9999", BPTN, note="x")
    with pytest.raises(NotFoundError):
        eng.bql_handle_out_of_scope("SIM-TKT-9999", BQL, note="x")


def test_s2_escalated_oos_is_found_by_the_bql_filter(eng):
    from src.maintenance.views import bql_rows

    ticket_id = oos_ticket(eng)
    assert [r.ticket_id for r in bql_rows(eng, eng.clock(), blocker_code="OUT_OF_SCOPE", escalated=True)] == []
    eng.send_to_bql(ticket_id, BPTN, note="Chuyển BQL")
    rows = bql_rows(eng, eng.clock(), blocker_code="OUT_OF_SCOPE", escalated=True)
    assert [r.ticket_id for r in rows] == [ticket_id]


# ======================================================================= §2 (API)


def test_s2_api_full_path(env):
    ticket_id = oos_ticket(env.engine)
    c, tok = env.client, env.tok
    path = f"/api/v1/mo/tickets/{ticket_id}/to-bql"
    assert c.post(path, json={"note": "Chuyển BQL"}, headers=tok("quanly")).status_code == 403
    assert c.post(path, json={"note": "Chuyển BQL"}, headers=tok("cudan")).status_code == 403
    ok = c.post(path, json={"note": "Chuyển BQL"}, headers=tok("tiepnhan"))
    assert ok.status_code == 200, ok.text
    assert ok.json()["ticket"]["blocker"]["escalated"] is True
    again = c.post(path, json={"note": "Lần hai"}, headers=tok("tiepnhan"))
    assert again.status_code == 409 and again.json()["detail"]["code"] == "INVALID_TRANSITION"
    rows = c.get("/api/v1/bql/tickets?blocker_code=OUT_OF_SCOPE&escalated=true", headers=tok("quanly")).json()
    assert [r["ticket_id"] for r in rows] == [ticket_id]

    back = f"/api/v1/bql/tickets/{ticket_id}/return-to-bptn"
    assert c.post(back, json={"note": "x"}, headers=tok("tiepnhan")).status_code == 403
    back_ok = c.post(back, json={"note": "BPTN liên hệ cư dân"}, headers=tok("quanly"))
    assert back_ok.status_code == 200 and back_ok.json()["ticket"]["blocker"]["escalated"] is False
    wrong = c.post(back, json={"note": "x"}, headers=tok("quanly"))
    assert wrong.status_code == 409  # no longer escalated

    c.post(path, json={"note": "Chuyển lại"}, headers=tok("tiepnhan"))
    done = f"/api/v1/bql/tickets/{ticket_id}/handled"
    assert c.post(done, json={"note": "x"}, headers=tok("tiepnhan")).status_code == 403
    assert c.post(done, json={"note": "x"}, headers=tok("cudan")).status_code == 403
    assert c.post(done, json={"note": "   "}, headers=tok("quanly")).status_code == 409
    handled = c.post(done, json={"note": "Đã xử lý xong"}, headers=tok("quanly"))
    assert handled.status_code == 200, handled.text
    body = handled.json()["ticket"]
    assert body["status"] == "CLOSED" and body["closure_kind"] == HANDLED_CLOSURE and body["blocker"] is None
    final = c.post(done, json={"note": "Lần hai"}, headers=tok("quanly"))
    assert final.status_code == 409
    view = c.get(f"/api/v1/resident/tickets/{ticket_id}", headers=tok("cudan")).json()
    assert view["status"] == "CLOSED"
    assert "RATE" in str(view["allowed_actions"]).upper()
    assert audit_denials(env.engine.get(ticket_id))  # the 403s were audited


def test_s2_api_blank_and_missing_note_is_409_guard_failed(env):
    ticket_id = oos_ticket(env.engine)
    path = f"/api/v1/mo/tickets/{ticket_id}/to-bql"
    for body in ({"note": ""}, {"note": "   "}, {}):
        response = env.client.post(path, json=body, headers=env.tok("tiepnhan"))
        assert response.status_code == 409, (body, response.text)
        assert response.json()["detail"]["code"] == "GUARD_FAILED"
    assert env.client.post(path, json={"note": "x", "extra": 1}, headers=env.tok("tiepnhan")).status_code == 422


def test_s2_api_unknown_ticket_404(env):
    response = env.client.post(
        "/api/v1/mo/tickets/SIM-TKT-9999/to-bql", json={"note": "x"}, headers=env.tok("tiepnhan")
    )
    assert response.status_code == 404


def test_s2_api_requires_login(env):
    ticket_id = oos_ticket(env.engine)
    assert env.client.post(f"/api/v1/mo/tickets/{ticket_id}/to-bql", json={"note": "x"}).status_code == 401
    assert env.client.post(f"/api/v1/bql/tickets/{ticket_id}/handled", json={"note": "x"}).status_code == 401


# ======================================================================= §3 materials (engine)


def test_s3_create_item_by_warehouse(eng):
    item = eng.create_material_item(WAREHOUSE, f"  {PVC}  ", " cái ")
    assert item.item_code.startswith("SIM-MAT-X-") and len(item.item_code) == len("SIM-MAT-X-") + 8
    assert (item.item_name, item.unit, item.created_by) == (PVC, "cái", WAREHOUSE)
    assert eng.repo.stock_of(item.item_code) == 0
    assert [m.item_code for m in eng.repo.material_items()] == [item.item_code]
    assert eng.material(item.item_code).item_name == PVC
    assert eng.material("SIM-MAT-LAMP-02").item_name  # catalog first
    assert eng.material("SIM-MAT-X-UNKNOWN0") is None
    rows = {r["item_code"]: r for r in eng.stock_levels(WAREHOUSE)}
    assert rows[item.item_code] == {
        "item_code": item.item_code,
        "item_name": PVC,
        "unit": "cái",
        "qty": 0,
        "min_qty": None,
    }
    assert "SIM-MAT-LAMP-02" in rows
    assert item.item_code in [m.item_code for m in eng.all_materials()]
    assert_codes_unique = [m.item_code for m in eng.all_materials()]
    assert len(assert_codes_unique) == len(set(assert_codes_unique))


def test_s3_warehouse_bql_department_may_create_other_roles_may_not(eng):
    assert eng.create_material_item(TEC, "Keo dán ống", "tuýp").created_by == TEC
    assert eng.create_material_item(BQL, "Dây điện 2.5", "m").created_by == BQL
    for actor in (BPTN, RESIDENT, "SIM-ACTOR-UNKNOWN"):
        with pytest.raises(ActionDeniedError):
            eng.create_material_item(actor, "Van khóa nước", "cái")
    assert len(eng.repo.material_items()) == 2


@pytest.mark.parametrize(
    ("name", "unit"),
    [
        ("a", "cái"),
        ("  b ", "cái"),
        ("x" * 81, "cái"),
        (PVC, ""),
        (PVC, "   "),
        (PVC, "u" * 21),
        ("Ống\x00nước", "cái"),
    ],
)
def test_s3_invalid_name_or_unit_is_a_guard_error(eng, name, unit):
    with pytest.raises(GuardError):
        eng.create_material_item(WAREHOUSE, name, unit)
    assert eng.repo.material_items() == []
    assert not any(code.startswith("SIM-MAT-X-") for code in eng.repo.stock())


def test_s3_name_and_unit_limits_are_inclusive(eng):
    assert eng.create_material_item(WAREHOUSE, "ab", "u").item_name == "ab"
    assert eng.create_material_item(WAREHOUSE, "x" * 80, "u" * 20).item_name == "x" * 80


def test_s3_same_name_gives_the_same_code(eng):  # mutation m3 target
    first = eng.create_material_item(WAREHOUSE, PVC, "cái")
    second = eng.create_material_item(TEC, "  ỐNG NƯỚC pvc 21 ", "m")
    assert second.item_code == first.item_code
    assert second.unit == "cái"  # the stored item wins; the new unit is ignored
    assert len(eng.repo.material_items()) == 1
    assert eng.repo.stock_of(first.item_code) == 0


def test_s3_name_of_a_catalog_item_returns_the_catalog_code(eng):
    catalog_item = eng.catalog.materials[0]
    got = eng.create_material_item(WAREHOUSE, f" {catalog_item.item_name.upper()} ", "cái")
    assert got.item_code == catalog_item.item_code
    assert eng.repo.material_items() == []


def test_s3_decomposed_unicode_name_matches_the_composed_one(eng):
    import unicodedata

    first = eng.create_material_item(WAREHOUSE, unicodedata.normalize("NFC", PVC), "cái")
    second = eng.create_material_item(WAREHOUSE, unicodedata.normalize("NFD", PVC), "cái")
    assert second.item_code == first.item_code


def test_s3_ticket_waits_for_the_new_item_then_runs_after_stock(eng):
    item = eng.create_material_item(WAREHOUSE, PVC, "cái")
    raw = RawTicket(
        ticket_id="SIM-TKT-0900",
        created_at=MONDAY_9AM.isoformat(timespec="seconds"),
        original_description=LIGHTING,
    )
    eng.ingest(raw, [PlannedMaterial(item_code=item.item_code, planned_qty=2)], resident_id=RESIDENT)
    case = eng.run_agent(raw.ticket_id)
    assert case.ticket.status == "ON_HOLD" and case.ticket.blocker.code == "WAITING_MATERIAL"
    line = case.material_lines[0]
    assert (line.item_code, line.item_name, line.unit, line.norm_label) == (item.item_code, PVC, "cái", "N_A")
    assert line.simulated_stock_qty == 0 and line.material_stock_status == "INSUFFICIENT"
    assert_base_shape(case)
    [resumed] = eng.receive_stock(WAREHOUSE, item.item_code, 2)
    assert resumed.ticket.status == "ROUTED"
    assert eng.repo.stock_of(item.item_code) == 2
    assert_base_shape(resumed)


def test_s3_receive_stock_accepts_the_new_item(eng):
    item = eng.create_material_item(WAREHOUSE, PVC, "cái")
    assert eng.receive_stock(WAREHOUSE, item.item_code, 5) == []
    assert eng.repo.stock_of(item.item_code) == 5
    with pytest.raises(NotFoundError):
        eng.receive_stock(WAREHOUSE, "SIM-MAT-X-NOSUCH00", 1)


def test_s3_reset_forgets_new_items_with_their_stock(eng):
    item = eng.create_material_item(WAREHOUSE, PVC, "cái")
    eng.reset(with_fixtures=False)
    assert eng.repo.material_items() == []
    assert item.item_code not in eng.repo.stock()


# ======================================================================= §3 materials (repository + flag + API)


def test_s3_memory_repository_item_contract(eng):
    from datetime import datetime

    from src.maintenance.store.base import MaterialItem

    now = datetime.fromisoformat("2026-09-28T09:00:00+07:00")
    item = MaterialItem(item_code="SIM-MAT-X-0000000A", item_name="A", unit="u", created_by=WAREHOUSE, created_at=now)
    assert eng.repo.add_material_item(item) == item
    assert eng.repo.add_material_item(item.model_copy(update={"item_name": "B"})) == item  # same code: first wins
    assert eng.repo.material_items() == [item]


def test_s3_flag_defaults_follow_the_store():
    memory = get_settings().model_copy(update={"mo_store": "memory", "mo_custom_materials": None})
    postgres = get_settings().model_copy(update={"mo_store": "postgres", "mo_custom_materials": None})
    assert memory.custom_materials_enabled() is True
    assert postgres.custom_materials_enabled() is False
    assert postgres.model_copy(update={"mo_custom_materials": True}).custom_materials_enabled() is True
    assert memory.model_copy(update={"mo_custom_materials": False}).custom_materials_enabled() is False


def test_s3_api_roles_and_validation(env):
    c, tok = env.client, env.tok
    for who in ("tiepnhan", "cudan"):
        response = c.post("/api/v1/mo/warehouse/items", json={"item_name": PVC, "unit": "cái"}, headers=tok(who))
        assert response.status_code == 403, (who, response.text)
    short = c.post("/api/v1/mo/warehouse/items", json={"item_name": "a", "unit": "cái"}, headers=tok("kho"))
    assert short.status_code in (409, 422)
    if short.status_code == 409:
        assert short.json()["detail"]["code"] == "GUARD_FAILED"
    huge = c.post("/api/v1/mo/warehouse/items", json={"item_name": "x" * 5000, "unit": "cái"}, headers=tok("kho"))
    assert huge.status_code in (409, 422)
    assert c.post("/api/v1/mo/warehouse/items", json={"item_name": PVC}, headers=tok("kho")).status_code == 422
    assert (
        c.post(
            "/api/v1/mo/warehouse/items", json={"item_name": PVC, "unit": "c", "x": 1}, headers=tok("kho")
        ).status_code
        == 422
    )
    assert c.post("/api/v1/mo/warehouse/items", json={"item_name": PVC, "unit": "cái"}).status_code == 401
    assert env.engine.repo.material_items() == []


def test_s3_flag_off_blocks_the_route_and_hides_the_button(env, monkeypatch):
    set_flag(monkeypatch, False)
    response = env.client.post(
        "/api/v1/mo/warehouse/items", json={"item_name": PVC, "unit": "cái"}, headers=env.tok("kho")
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "FEATURE_DISABLED"
    catalog = env.client.get("/api/v1/mo/catalog", headers=env.tok("kho")).json()
    assert catalog["custom_materials_enabled"] is False
    assert env.engine.repo.material_items() == []
    set_flag(monkeypatch, True)
    assert (
        env.client.post(
            "/api/v1/mo/warehouse/items", json={"item_name": PVC, "unit": "cái"}, headers=env.tok("kho")
        ).status_code
        == 201
    )


# ======================================================================= §4 wrong department


def test_s4_api_department_reports_wrong_department_after_start(env):
    ticket_id = in_progress_ticket(env.engine)
    c, tok = env.client, env.tok
    path = f"/api/v1/mo/tickets/{ticket_id}/wrong-department"
    assert c.post(path, json={"note": "Không phải việc kỹ thuật"}, headers=tok("vesinh")).status_code == 403
    assert c.post(path, json={"note": "Không phải việc kỹ thuật"}, headers=tok("quanly")).status_code == 403
    assert c.post(path, json={"note": "x"}, headers=tok("cudan")).status_code == 403
    assert c.post(path, json={"note": "  "}, headers=tok("kythuat")).status_code == 409
    done = c.post(path, json={"note": "Không phải việc kỹ thuật"}, headers=tok("kythuat"))
    assert done.status_code == 200, done.text
    ticket = done.json()["ticket"]
    assert ticket["status"] == "VERIFYING" and ticket["blocker"]["code"] == "WRONG_DEPT_AFTER_START"
    assert c.post(path, json={"note": "Lần hai"}, headers=tok("kythuat")).status_code in (403, 409)
    assert audit_denials(env.engine.get(ticket_id))


def test_s4_api_bql_keeps_or_sends_back(env):
    c, tok = env.client, env.tok
    keep_id = in_progress_ticket(env.engine)
    c.post(f"/api/v1/mo/tickets/{keep_id}/wrong-department", json={"note": "Sai phòng"}, headers=tok("kythuat"))
    path = f"/api/v1/bql/tickets/{keep_id}/wrong-department"
    assert c.post(path, json={"decision": "KEEP", "note": "x"}, headers=tok("tiepnhan")).status_code == 403
    assert c.post(path, json={"decision": "KEEP", "note": "x"}, headers=tok("kythuat")).status_code == 403
    assert c.post(path, json={"decision": "MAYBE", "note": "x"}, headers=tok("quanly")).status_code == 422
    assert c.post(path, json={"decision": "KEEP", "note": " "}, headers=tok("quanly")).status_code == 409
    kept = c.post(path, json={"decision": "KEEP", "note": "Giữ phòng kỹ thuật"}, headers=tok("quanly"))
    assert kept.status_code == 200, kept.text
    assert kept.json()["ticket"]["status"] == "IN_PROGRESS"
    assert c.post(path, json={"decision": "KEEP", "note": "Lần hai"}, headers=tok("quanly")).status_code == 409

    back_id = routed_ticket(env.engine, "Đèn hành lang tầng 7 tòa S2 không sáng")
    env.engine.accept(back_id, TEC)
    c.post(f"/api/v1/mo/tickets/{back_id}/wrong-department", json={"note": "Sai phòng"}, headers=tok("kythuat"))
    sent = c.post(
        f"/api/v1/bql/tickets/{back_id}/wrong-department",
        json={"decision": "TO_BPTN", "note": "Chuyển BPTN phân lại"},
        headers=tok("quanly"),
    )
    assert sent.status_code == 200, sent.text
    ticket = sent.json()["ticket"]
    assert ticket["status"] == "VERIFYING" and ticket["blocker"]["code"] == "WRONG_DEPT"
    assert_base_shape(env.engine.get(back_id))


# ======================================================================= PostgreSQL (--pg only, local docker *_test)


def _item(code: str, name: str):
    from datetime import datetime

    from src.maintenance.store.base import MaterialItem

    created = datetime.fromisoformat("2026-09-28T09:00:00+07:00")
    return MaterialItem(item_code=code, item_name=name, unit="cái", created_by=WAREHOUSE, created_at=created)


@pytest.fixture
def pg_materials(pg_repo, pg_url):
    """A Postgres repository with the feature on, and an empty `material_items` table."""
    from sqlalchemy import text

    from src.maintenance.store.postgres import PostgresRepository

    with pg_repo._engine.begin() as conn:
        conn.execute(text("delete from maintops.material_items"))
    return PostgresRepository(pg_url, custom_materials=True)


@pytest.mark.pg
def test_pg_material_items_contract(pg_materials):
    item = _item("SIM-MAT-X-0000000A", "Ống PVC")
    assert pg_materials.material_items() == []
    assert pg_materials.add_material_item(item) == item
    assert pg_materials.add_material_item(_item("SIM-MAT-X-0000000A", "Khác")) == item  # the first one wins
    assert pg_materials.material_items() == [item]


@pytest.mark.pg
def test_pg_engine_waits_for_a_new_item_then_resumes(pg_materials):
    engine = MaintenanceEngine(repo=pg_materials, clock=Clock(MONDAY_9AM))
    item = engine.create_material_item(WAREHOUSE, PVC, "cái")
    assert engine.create_material_item(TEC, PVC.upper(), "m").item_code == item.item_code
    assert pg_materials.stock_of(item.item_code) == 0
    raw = RawTicket(
        ticket_id="SIM-TKT-0900", created_at=MONDAY_9AM.isoformat(timespec="seconds"), original_description=LIGHTING
    )
    engine.ingest(raw, [PlannedMaterial(item_code=item.item_code, planned_qty=2)], resident_id=RESIDENT)
    assert engine.run_agent(raw.ticket_id).ticket.blocker.code == "WAITING_MATERIAL"
    [resumed] = engine.receive_stock(WAREHOUSE, item.item_code, 2)
    assert resumed.ticket.status == "ROUTED"
    assert engine.all_materials()[-1].item_code == item.item_code


@pytest.mark.pg
def test_pg_feature_off_never_touches_the_table(pg_repo):
    assert pg_repo.material_items() == []  # feature off: [] without a query
    with pytest.raises(GuardError):
        pg_repo.add_material_item(_item("SIM-MAT-X-0000000B", "Ống"))


@pytest.mark.pg
def test_pg_check_accepts_the_previous_revision_only_while_the_feature_is_off(pg_repo, pg_url):
    from sqlalchemy import text

    from src.maintenance.store.postgres import HEAD_REVISION, PostgresRepository

    with pg_repo._engine.begin() as conn:
        conn.execute(text("update maintops.alembic_version set version_num = '0002_p1_doc_shape'"))
    try:
        PostgresRepository(pg_url).check()  # feature off: the database may still be at 0002
        with pytest.raises(RuntimeError, match="upgrade head"):
            PostgresRepository(pg_url, custom_materials=True).check()
    finally:
        with pg_repo._engine.begin() as conn:
            conn.execute(text("update maintops.alembic_version set version_num = :v"), {"v": HEAD_REVISION})
    PostgresRepository(pg_url, custom_materials=True).check()


@pytest.mark.pg
def test_pg_migration_0003_creates_and_drops_only_its_table(pg_url):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text

    from src.maintenance.store.postgres import ALEMBIC_INI, sql_engine

    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["database_url"] = pg_url
    exists = text("select to_regclass('maintops.material_items') is not null")
    try:
        command.downgrade(cfg, "0002_p1_doc_shape")
        with sql_engine(pg_url).connect() as conn:
            assert conn.execute(exists).scalar() is False
            assert conn.execute(text("select to_regclass('maintops.cases') is not null")).scalar() is True
    finally:
        command.upgrade(cfg, "head")
    with sql_engine(pg_url).connect() as conn:
        assert conn.execute(exists).scalar() is True
        assert conn.execute(text("select version_num from maintops.alembic_version")).scalar() == "0004_portal_extras"


# ======================================================================= §3b BQL manages the warehouse (Q08)


def test_s3b_bql_receives_stock_and_other_roles_are_denied(eng):
    code = "SIM-MAT-LAMP-02"
    before = eng.repo.stock_of(code) or 0
    eng.receive_stock(BQL, code, 3)
    assert eng.repo.stock_of(code) == before + 3
    for actor in (TEC, CLN, BPTN, RESIDENT):
        with pytest.raises(ActionDeniedError):
            eng.receive_stock(actor, code, 1)
    assert eng.repo.stock_of(code) == before + 3


def test_s3b_api_bql_and_warehouse_receive_stock_department_gets_403(env):
    code = "SIM-MAT-LAMP-02"
    path = f"/api/v1/mo/warehouse/stock/{code}"
    before = env.engine.repo.stock_of(code) or 0
    assert env.client.post(path, json={"qty": 3}, headers=env.tok("quanly")).status_code == 200
    assert env.engine.repo.stock_of(code) == before + 3
    assert env.client.post(path, json={"qty": 1}, headers=env.tok("kho")).status_code == 200
    for who in ("kythuat", "vesinh", "tiepnhan", "cudan"):
        response = env.client.post(path, json={"qty": 1}, headers=env.tok(who))
        assert response.status_code == 403, who
        assert response.json()["detail"]["code"] == "ACTION_DENIED"
    assert env.engine.repo.stock_of(code) == before + 4
    created = env.client.post(
        "/api/v1/mo/warehouse/items", json={"item_name": PVC, "unit": "cái"}, headers=env.tok("quanly")
    )
    assert created.status_code == 201


def test_rating_is_in_the_resident_view_and_the_bql_row(env):
    ticket_id = oos_ticket(env.engine)
    c, tok = env.client, env.tok
    c.post(f"/api/v1/bql/tickets/{ticket_id}/handled", json={"note": "Đã xử lý"}, headers=tok("quanly"))
    assert c.get(f"/api/v1/resident/tickets/{ticket_id}", headers=tok("cudan")).json()["rating"] is None
    assert (
        c.post(f"/api/v1/resident/tickets/{ticket_id}/rating", json={"score": 4}, headers=tok("cudan")).status_code
        == 200
    )
    assert c.get(f"/api/v1/resident/tickets/{ticket_id}", headers=tok("cudan")).json()["rating"] == 4
    rows = c.get("/api/v1/bql/tickets", headers=tok("quanly")).json()
    assert [r["rating"] for r in rows if r["ticket_id"] == ticket_id] == [4]
