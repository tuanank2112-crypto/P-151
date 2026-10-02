import json

import pytest
from fastapi.testclient import TestClient

from src.api import photos
from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import MaintenanceEngine

RESIDENT = {"X-Actor-Id": "SIM-ACTOR-RESIDENT-01"}
OTHER_RESIDENT = {"X-Actor-Id": "SIM-ACTOR-RESIDENT-02"}
BPTN = {"X-Actor-Id": "SIM-ACTOR-BPTN-01"}
CLN = {"X-Actor-Id": "SIM-ACTOR-DEPT-CLN-01"}
TEC = {"X-Actor-Id": "SIM-ACTOR-DEPT-TEC-01"}
BQL = {"X-Actor-Id": "SIM-ACTOR-BQL-01"}
AGENT = {"X-Actor-Id": "SIM-ACTOR-AGENT"}
WAREHOUSE = {"X-Actor-Id": "SIM-ACTOR-WAREHOUSE-01"}
MORNING = "2026-09-28T09:00:00+07:00"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@pytest.fixture
def engine():
    e = MaintenanceEngine()
    e.reset()
    app.dependency_overrides[get_engine] = lambda: e
    yield e
    app.dependency_overrides.pop(get_engine, None)


@pytest.fixture
def api(engine, tmp_path, monkeypatch):
    """These tests name the actor with X-Actor-Id (header auth is off in the app; login is tested in test_auth).
    Requests without their own header run as the QA account, which may use the demo control endpoints."""
    monkeypatch.setattr(photos, "upload_dir", lambda: tmp_path)
    app.dependency_overrides[actor_header_allowed] = lambda: True
    yield TestClient(app, headers={"X-Actor-Id": "SIM-ACTOR-QA-01"})
    app.dependency_overrides.pop(actor_header_allowed, None)


def create(api, text, when=MORNING, headers=RESIDENT):
    response = api.post(
        "/api/v1/resident/tickets", json={"original_description": text, "simulated_received_at": when}, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()["ticket_id"]


def test_queue_lists_twelve_fixture_tickets(api):
    rows = api.get("/api/v1/mo/tickets").json()
    assert len(rows) == 12
    assert {r["flow"] for r in rows} == {"DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4", "REGRESSION"}


def test_evaluate_endpoint_passes_all(api):
    report = api.post("/api/v1/mo/evaluate").json()
    assert report["passed"] == 12 and report["demo_flows_passed"] == 4


def test_12_resident_view_hides_internal_fields(api, engine):
    tid = create(
        api, "Đèn hành lang tầng 7 tòa SIM-B không sáng", when="2026-10-01T23:00:00+07:00"
    )  # > 48h after the fixture
    engine.get(tid).ticket.assignee_id = "NV-TEC-03"  # set directly: the resident must never see it
    view = api.get(f"/api/v1/resident/tickets/{tid}", headers=RESIDENT).json()
    assert view["status"] == "ROUTED" and view["status_label"] == "Đã chuyển phòng ban"
    assert view["department_name"] == "Phòng Kỹ thuật"
    assert view["public_message"].startswith("Phản ánh sẽ được xử lý từ 06:00")
    assert [e["status"] for e in view["timeline"]] == ["RECEIVED", "ROUTED"]
    assert set(view["timeline"][0]) == {"status", "status_label", "public_message", "created_at"}
    text = json.dumps(view)
    for secret in (
        "reason_code",
        "internal_note",
        "assignee_id",
        "OUT_OF_HOURS",
        "auto_retry_count",
        "escalated",
        "SIM-MAT",
        "Ngoài ca phòng ban",
        "NV-TEC-03",
    ):
        assert secret not in text


def test_resident_full_journey_over_http(api):
    tid = create(api, "Nhiều rác quá, cần dọn")
    view = api.get(f"/api/v1/resident/tickets/{tid}", headers=RESIDENT).json()
    assert view["status"] == "NEED_INFO" and view["allowed_actions"] == ["ADD_INFO"]

    view = api.post(
        f"/api/v1/resident/tickets/{tid}/additions", json={"content": "Hành lang tầng 7 tòa SIM-B"}, headers=RESIDENT
    ).json()
    assert view["status"] == "ROUTED"

    assert api.post(f"/api/v1/mo/tickets/{tid}/accept", headers=CLN).json()["ticket"]["status"] == "IN_PROGRESS"
    for item in ("CLN-CHK-01", "CLN-CHK-02", "CLN-CHK-03"):
        api.post(f"/api/v1/mo/tickets/{tid}/checklist/{item}", json={"status": "COMPLETED"}, headers=CLN)
    api.post(f"/api/v1/mo/tickets/{tid}/materials/SIM-MAT-CLEAN-01", json={"issued_qty": 2, "used_qty": 2}, headers=CLN)
    api.post(
        f"/api/v1/mo/tickets/{tid}/evidence",
        json={
            "requirement_id": "CLN-EVD-PROCESSING-NOTE",
            "evidence_type": "PROCESSING_NOTE",
            "content_or_metadata": "Đã dọn",
        },
        headers=CLN,
    )
    case = api.post(f"/api/v1/mo/tickets/{tid}/complete", headers=CLN).json()
    assert case["ticket"]["status"] == "IN_PROGRESS"  # no photo of the finished work yet
    assert case["draft"]["readiness_evaluation"]["failing_items"] == ["execution_photo"]
    upload(api, f"/api/v1/mo/tickets/{tid}/photos", CLN)
    case = api.post(f"/api/v1/mo/tickets/{tid}/complete", headers=CLN).json()
    assert case["ticket"]["status"] == "READY_FOR_REVIEW"

    assert api.post(f"/api/v1/bql/tickets/{tid}/close", json={}, headers=BQL).json()["ticket"]["status"] == "CLOSED"
    view = api.get(f"/api/v1/resident/tickets/{tid}", headers=RESIDENT).json()
    assert view["allowed_actions"] == ["RATE", "REPORT_NOT_DONE"]
    view = api.post(f"/api/v1/resident/tickets/{tid}/rating", json={"score": 5}, headers=RESIDENT).json()
    assert view["allowed_actions"] == ["REPORT_NOT_DONE"]


def upload(api, url, headers, files=None):
    response = api.post(url, files=files or [("files", ("a.png", PNG, "image/png"))], headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_resident_photo_is_optional_and_private(api):
    tid = create(api, "Cầu thang bộ tầng 4 tòa SIM-B nhiều rác")
    assert api.get(f"/api/v1/resident/tickets/{tid}", headers=RESIDENT).json()["photos"] == []

    view = upload(api, f"/api/v1/resident/tickets/{tid}/photos", RESIDENT)
    [photo] = view["photos"]
    response = api.get(f"/api/v1/resident/tickets/{tid}/photos/{photo}", headers=RESIDENT)
    assert response.status_code == 200 and response.content == PNG and response.headers["content-type"] == "image/png"
    assert api.get(f"/api/v1/mo/tickets/{tid}/photos/{photo}", headers=CLN).status_code == 200  # routed to cleaning
    assert api.get(f"/api/v1/mo/tickets/{tid}/photos/{photo}", headers=TEC).status_code == 404
    assert api.get(f"/api/v1/resident/tickets/{tid}/photos/{photo}", headers=OTHER_RESIDENT).status_code == 404
    response = api.post(
        f"/api/v1/resident/tickets/{tid}/photos", files=[("files", ("a.png", PNG, "image/png"))], headers=OTHER_RESIDENT
    )
    assert response.status_code == 404


def test_photo_upload_checks_the_bytes_not_the_name(api):
    tid = create(api, "Cầu thang bộ tầng 4 tòa SIM-B nhiều rác")
    url = f"/api/v1/resident/tickets/{tid}/photos"
    fake = api.post(url, files=[("files", ("x.png", b"<script>alert(1)</script>", "image/png"))], headers=RESIDENT)
    assert fake.status_code == 415
    big = api.post(url, files=[("files", ("b.png", PNG + b"\x00" * photos.MAX_BYTES, "image/png"))], headers=RESIDENT)
    assert big.status_code == 413
    six = [("files", (f"{i}.png", PNG, "image/png")) for i in range(6)]
    assert api.post(url, files=six, headers=RESIDENT).status_code == 422
    assert api.get(f"/api/v1/resident/tickets/{tid}", headers=RESIDENT).json()["photos"] == []


def test_department_photo_needs_an_accepted_ticket(api):
    tid = create(api, "Cầu thang bộ tầng 4 tòa SIM-B nhiều rác")
    response = api.post(f"/api/v1/mo/tickets/{tid}/photos", files=[("files", ("a.png", PNG, "image/png"))], headers=CLN)
    assert response.status_code == 409  # ROUTED, not yet accepted


def test_resident_cannot_see_another_residents_ticket(api):
    tid = create(api, "Hành lang tầng 3 tòa SIM-A nhiều rác")
    assert api.get(f"/api/v1/resident/tickets/{tid}", headers=OTHER_RESIDENT).status_code == 404
    assert api.get(f"/api/v1/resident/tickets/{tid}", headers=BQL).status_code == 403


@pytest.mark.parametrize("headers", [AGENT, BPTN, CLN, RESIDENT])
def test_close_by_anyone_but_bql_is_403_and_audited(api, headers):
    tid = "SIM-TKT-CLN-001"
    api.post(f"/api/v1/mo/demo/{tid}")  # → READY_FOR_REVIEW
    response = api.post(f"/api/v1/mo/tickets/{tid}/transition", json={"to": "CLOSED"}, headers=headers)
    assert response.status_code == 403 and response.json()["detail"]["code"] == "ACTION_DENIED"
    assert api.get(f"/api/v1/mo/tickets/{tid}/audit").json()[-1]["action_result"] == "ACTION_DENIED"
    assert api.get(f"/api/v1/mo/tickets/{tid}").json()["ticket"]["status"] == "READY_FOR_REVIEW"


def test_invalid_transition_is_409(api):
    response = api.post("/api/v1/bql/tickets/SIM-TKT-CLN-004/close", json={}, headers=BQL)
    assert response.status_code == 409 and response.json()["detail"]["code"] == "INVALID_TRANSITION"


def test_bql_filters(api):
    rows = api.get("/api/v1/bql/tickets", params={"status": "VERIFYING"}, headers=BQL).json()
    assert {r["ticket_id"] for r in rows} == {"SIM-TKT-TEC-002", "SIM-TKT-TEC-005"}
    rows = api.get("/api/v1/bql/tickets", params={"blocker_code": "OUT_OF_HOURS"}, headers=BQL).json()
    assert [r["ticket_id"] for r in rows] == ["SIM-TKT-CLN-002"]
    rows = api.get("/api/v1/bql/tickets", params={"department_id": "DEPT_TECHNICAL"}, headers=BQL).json()
    # Only tickets actually handed over at step 8; the other three are still a proposal
    assert {r["ticket_id"] for r in rows} == {"SIM-TKT-TEC-001", "SIM-TKT-TEC-004", "SIM-TKT-TEC-006"}
    proposed = api.get("/api/v1/bql/tickets", params={"status": "ON_HOLD"}, headers=BQL).json()
    assert proposed[0]["department_id"] is None and proposed[0]["proposed_department_id"] == "DEPT_TECHNICAL"
    # Fixture tickets are from 27/09, so by the real clock their escalation times have passed
    assert api.get("/api/v1/bql/tickets", params={"overdue": True}, headers=BQL).json()
    assert api.get("/api/v1/bql/tickets", headers=CLN).status_code == 403


def test_jobs_endpoint_escalates_and_bql_sees_it(api):
    tid = create(api, "Nhiều rác quá")
    api.post("/api/v1/mo/jobs/run", json={"now": "2026-10-01T10:00:00+07:00"})
    rows = api.get("/api/v1/bql/tickets", params={"escalated": True, "status": "NEED_INFO"}, headers=BQL).json()
    assert tid in {r["ticket_id"] for r in rows}


def test_bptn_resolve_and_stock_over_http(api):
    case = api.post(
        "/api/v1/mo/tickets/SIM-TKT-TEC-002/bptn-resolve",
        json={"asset_onsite": True, "note": "Không có trong sổ tài sản"},
        headers=BPTN,
    ).json()
    assert case["ticket"]["status"] == "ROUTED" and case["ticket"]["flags"] == ["ASSET_CHECK_ONSITE"]

    assert api.post("/api/v1/mo/warehouse/stock/SIM-MAT-LAMP-02", json={"qty": 5}, headers=BPTN).status_code == 403
    resumed = api.post("/api/v1/mo/warehouse/stock/SIM-MAT-LAMP-02", json={"qty": 5}, headers=WAREHOUSE).json()
    assert [c["ticket"]["ticket_id"] for c in resumed] == ["SIM-TKT-TEC-003"]
    assert resumed[0]["ticket"]["status"] == "ROUTED"


def test_bptn_fills_missing_location_over_http(api):
    tid = create(api, "Nhiều rác quá, cần dọn")
    url = f"/api/v1/mo/tickets/{tid}/bptn-resolve"
    body = {"location": "Tòa SIM-B / Tầng 7 / Hành lang", "note": "Gọi cư dân"}
    assert api.post(url, json=body, headers=RESIDENT).status_code == 403
    case = api.post(url, json=body, headers=BPTN).json()
    assert case["ticket"]["status"] == "ROUTED" and case["ticket"]["department_id"] == "DEPT_CLEANING"


def test_request_bodies_reject_placeholders(api):
    url = "/api/v1/mo/tickets/SIM-TKT-TEC-002/bptn-resolve"
    assert api.post(url, json={"note": "string", "asset_onsite": True}, headers=BPTN).status_code == 422
    assert api.post(url, json={"reason": "x"}, headers=BPTN).status_code == 422


def test_no_endpoint_assigns_a_person(api):
    """The department assigns its own staff outside this CR; no endpoint picks a person."""
    schema = api.get("/openapi.json").json()
    assert not any("assign" in path for path in schema["paths"])
    assert "technician" not in json.dumps(schema).lower()


def test_resident_lists_only_their_own_tickets(api):
    mine = create(api, "Hành lang tầng 7 tòa SIM-B nhiều rác")
    theirs = create(api, "Sảnh chính tòa SIM-A nhiều rác", headers=OTHER_RESIDENT)
    ids = [v["ticket_id"] for v in api.get("/api/v1/resident/tickets", headers=RESIDENT).json()]
    assert mine in ids and theirs not in ids
    assert api.get("/api/v1/resident/tickets", headers=BQL).status_code == 403


def test_catalog_feeds_the_ui(api):
    catalog = api.get("/api/v1/mo/catalog").json()
    assert catalog["departments"] == {"DEPT_CLEANING": "Phòng Vệ sinh", "DEPT_TECHNICAL": "Phòng Kỹ thuật"}
    assert catalog["status_labels"]["ROUTED"] == "Đã chuyển phòng ban"
    assert all(a["asset_id"].startswith("SIM-ASSET-") for a in catalog["assets"])


def test_ui_is_served(api):
    assert api.get("/", follow_redirects=False).headers["location"] == "/ui/"
    page = api.get("/ui/")
    assert page.status_code == 200 and "app.js" in page.text
    assert api.get("/ui/app.js").status_code == 200


def test_16_resident_sees_no_department_before_hand_over(api, engine):
    need_info = create(api, "Nhiều rác quá")
    asset_unclear = create(api, "Đèn cầu thang bộ tầng 9 tòa SIM-A không sáng")
    engine.stock["SIM-MAT-CLEAN-01"] = 0
    waiting = create(api, "Hành lang tầng 7 tòa SIM-B nhiều rác")
    for tid in (need_info, asset_unclear, waiting):
        assert engine.get(tid).ticket.department_id is None
        view = api.get(f"/api/v1/resident/tickets/{tid}", headers=RESIDENT).json()
        assert view["department_name"] is None
        text = json.dumps(view, ensure_ascii=False)
        assert "Phòng" not in text and "DEPT_" not in text


def test_resident_cannot_backdate_in_production(api, monkeypatch):
    from src.config import get_settings

    monkeypatch.setattr(get_settings(), "app_env", "production")
    body = {"original_description": "Hành lang tầng 3 tòa SIM-A nhiều rác", "simulated_received_at": MORNING}
    assert api.post("/api/v1/resident/tickets", json=body, headers=RESIDENT).status_code == 422
    body.pop("simulated_received_at")
    assert api.post("/api/v1/resident/tickets", json=body, headers=RESIDENT).status_code == 201
