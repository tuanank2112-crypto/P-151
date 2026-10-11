"""Plan 16 TESTING §T2: material guards on every path (new C2 endpoint, legacy endpoints, the engine called directly)
and on completion. Each guard failed on the v1.9.9 baseline because the old code accepted the wrong data."""

import json

import pytest
from fastapi.testclient import TestClient

from src.api.auth import actor_header_allowed
from src.api.routers.maintenance import get_engine
from src.main import app
from src.maintenance.engine import ActionDeniedError, GuardError, MaintenanceEngine
from src.maintenance.enums import ChecklistStatus, EvidenceType, MaterialRequirementMode, ReadabilityStatus
from src.maintenance.material_policy import (
    MATERIAL_INVALID,
    MATERIAL_REQUIRED,
    MaterialUsageLine,
    allowed_material_codes,
)
from src.maintenance.models import PlannedMaterial
from tests.test_maintenance.helpers import BPTN, CLEANING, CLN, LIGHTING, MONDAY_9AM, TEC, Clock, report

LAMP, LAMP2, STARTER, CLEAN, BAG = (
    "SIM-MAT-LAMP-01",
    "SIM-MAT-LAMP-02",
    "SIM-MAT-STARTER-01",
    "SIM-MAT-CLEAN-01",
    "SIM-MAT-BAG-01",
)
H = {CLN: {"X-Actor-Id": CLN}, TEC: {"X-Actor-Id": TEC}, BPTN: {"X-Actor-Id": BPTN}}


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


def state(engine: MaintenanceEngine, tid: str):
    return engine.get(tid).model_dump(mode="json"), engine.repo.stock()


def post(api, url, body, actor):
    """JSON with NaN/Infinity allowed, as a careless client could send it."""
    return api.post(url, content=json.dumps(body), headers={**H[actor], "Content-Type": "application/json"})


def usage(api, tid, actor, lines):
    return post(api, f"/api/v1/mo/tickets/{tid}/material-usage", {"lines": lines}, TEC if actor is None else actor)


def finish_work(engine: MaintenanceEngine, tid: str, actor: str):
    case = engine.get(tid)
    for item in case.checklist_items:
        engine.update_checklist(tid, actor, item.template_item_id, status=ChecklistStatus.COMPLETED)
    engine.add_evidence(
        tid,
        actor,
        requirement_id=None,
        evidence_type=EvidenceType.SIMULATED_IMAGE,
        content_or_metadata="after.jpg",
        readability_status=ReadabilityStatus.READABLE,
    )
    return engine.report_complete(tid, actor)


def plant_lines(engine: MaintenanceEngine, tid: str, lines: list[tuple[str, float, float | None]]) -> None:
    """Old data written before plan 16 (or by an old client): stored as is, bypassing every guard."""
    with engine.repo.transaction() as tx:
        case = tx.get_for_update(tid)
        draft = case.draft
        new = []
        for index, (code, qty, recorded) in enumerate(lines, start=1):
            line = engine._material_line(
                draft.work_order_draft_id, "OLD", index, PlannedMaterial(item_code=code, planned_qty=qty)
            )
            line.issued_qty = line.used_qty = recorded
            new.append(line)
        case.material_lines = new
        draft.material_line_ids = [m.material_line_id for m in new]
        draft.material_requirement_mode = MaterialRequirementMode.TRACKED if new else MaterialRequirementMode.N_A
        tx.save(case)


# ---------------------------------------------------------------------- §C1 allowed codes


def test_allowed_codes_come_from_the_catalog_mapping(eng):
    assert allowed_material_codes(eng.catalog, "DEPT_TECHNICAL") == {LAMP, LAMP2, STARTER}
    assert allowed_material_codes(eng.catalog, "DEPT_CLEANING") == {CLEAN, BAG}
    assert allowed_material_codes(eng.catalog, "DEPT_NOPE") == frozenset()


def test_catalog_endpoint_lists_codes_by_department(api):
    body = api.get("/api/v1/mo/catalog", headers=H[TEC]).json()
    assert body["material_codes_by_department"] == {
        "DEPT_CLEANING": [BAG, CLEAN],
        "DEPT_TECHNICAL": [LAMP, LAMP2, STARTER],
    }
    assert {"departments", "assets", "status_labels", "materials"} <= body.keys()  # old fields kept


# ---------------------------------------------------------------------- department guard


@pytest.mark.parametrize(
    ("text", "actor", "foreign"),
    [(LIGHTING, TEC, CLEAN), (LIGHTING, TEC, BAG), (CLEANING, CLN, LAMP), (CLEANING, CLN, STARTER)],
)
def test_foreign_material_is_refused_everywhere(api, eng, text, actor, foreign):
    tid = started(eng, text, actor)
    before = state(eng, tid)
    assert usage(api, tid, actor, [{"item_code": foreign, "used_qty": 1}]).status_code == 409
    plan = api.post(
        f"/api/v1/mo/tickets/{tid}/material-plan",
        json={"lines": [{"item_code": foreign, "planned_qty": 1}]},
        headers=H[actor],
    )
    assert plan.status_code == 409
    with pytest.raises(GuardError, match="không thuộc phòng ban"):
        eng.save_material_usage(tid, actor, lines=[MaterialUsageLine(item_code=foreign, used_qty=1)])
    with pytest.raises(GuardError, match="không thuộc phòng ban"):
        eng.confirm_materials(tid, actor, lines=[PlannedMaterial(item_code=foreign, planned_qty=1)])
    assert state(eng, tid) == before


def test_legacy_record_refuses_a_foreign_line_already_in_the_draft(api, eng):
    tid = started(eng, LIGHTING, TEC)
    plant_lines(eng, tid, [(CLEAN, 1, None)])
    before = state(eng, tid)
    reply = api.post(
        f"/api/v1/mo/tickets/{tid}/materials/{CLEAN}", json={"issued_qty": 1, "used_qty": 1}, headers=H[TEC]
    )
    assert reply.status_code == 409
    with pytest.raises(GuardError, match="không thuộc phòng ban"):
        eng.record_material(tid, TEC, CLEAN, issued_qty=1, used_qty=1)
    assert state(eng, tid) == before


# ---------------------------------------------------------------------- whole positive numbers


BAD_NUMBERS = [0, -1, 0.5, True, "1", None, float("nan"), float("inf"), 10**400]


@pytest.mark.parametrize("bad", BAD_NUMBERS, ids=lambda v: repr(v)[:12])
def test_bad_quantities_are_refused_by_the_api(api, eng, bad):
    tid = started(eng, LIGHTING, TEC)
    before = state(eng, tid)
    assert usage(api, tid, TEC, [{"item_code": LAMP, "used_qty": bad}]).status_code == 422
    plan = {"lines": [{"item_code": LAMP, "planned_qty": bad}]}
    assert post(api, f"/api/v1/mo/tickets/{tid}/material-plan", plan, TEC).status_code == 422
    url = f"/api/v1/mo/tickets/{tid}/materials/{LAMP}"
    assert post(api, url, {"issued_qty": bad, "used_qty": 1}, TEC).status_code == 422
    assert post(api, url, {"issued_qty": 2, "used_qty": bad}, TEC).status_code == 422
    assert state(eng, tid) == before


@pytest.mark.parametrize(
    "bad", [0, -1, 0.5, True, "1", None, float("nan"), float("inf"), 10**400], ids=lambda v: repr(v)[:12]
)
def test_bad_quantities_are_refused_by_the_engine(eng, bad):
    tid = started(eng, LIGHTING, TEC)
    before = state(eng, tid)
    with pytest.raises(GuardError):
        eng.save_material_usage(tid, TEC, lines=[MaterialUsageLine.model_construct(item_code=LAMP, used_qty=bad)])
    with pytest.raises(GuardError):
        eng.confirm_materials(tid, TEC, lines=[PlannedMaterial.model_construct(item_code=LAMP, planned_qty=bad)])
    with pytest.raises(GuardError):
        eng.record_material(tid, TEC, LAMP, issued_qty=bad, used_qty=bad)
    assert state(eng, tid) == before


@pytest.mark.parametrize("good", [1, 1.0])
def test_whole_quantities_are_accepted_and_stored_as_numbers(api, eng, good):
    tid = started(eng, LIGHTING, TEC)
    reply = usage(api, tid, TEC, [{"item_code": LAMP, "used_qty": good}])
    assert reply.status_code == 200, reply.text
    line = reply.json()["material_lines"][0]
    assert (line["planned_qty"], line["issued_qty"], line["used_qty"]) == (1, 1, 1)


def test_new_request_forbids_extra_fields(api, eng):
    tid = started(eng, LIGHTING, TEC)
    for body in (
        {"lines": [{"item_code": LAMP, "used_qty": 1, "issued_qty": 2}]},
        {"lines": [{"item_code": LAMP, "used_qty": 1}], "note": "x"},
        {"lines": [{"item_code": LAMP, "used_qty": 1, "variance_reason": "x"}]},
    ):
        assert api.post(f"/api/v1/mo/tickets/{tid}/material-usage", json=body, headers=H[TEC]).status_code == 422


# ---------------------------------------------------------------------- empty selections


def test_technical_must_choose_a_material(api, eng):
    tid = started(eng, LIGHTING, TEC)
    before = state(eng, tid)
    assert usage(api, tid, TEC, []).status_code == 409
    plan = api.post(f"/api/v1/mo/tickets/{tid}/material-plan", json={"lines": []}, headers=H[TEC])
    assert plan.status_code == 409
    with pytest.raises(GuardError, match="ít nhất một vật tư"):
        eng.save_material_usage(tid, TEC, lines=[])
    with pytest.raises(GuardError, match="ít nhất một vật tư"):
        eng.confirm_materials(tid, TEC, lines=[])
    assert state(eng, tid) == before


def test_technical_cannot_complete_with_no_material_through_n_a(eng):
    """Old data (or an old client) left the technical ticket in mode N_A: completion still fails."""
    tid = started(eng, LIGHTING, TEC)
    plant_lines(eng, tid, [])
    case = finish_work(eng, tid, TEC)
    assert case.ticket.status == "IN_PROGRESS"
    assert MATERIAL_REQUIRED in case.draft.readiness_evaluation.failing_items
    assert not case.draft.readiness_evaluation.materials_entered


@pytest.mark.parametrize("lines", [[(CLEAN, 1, 1)], [(LAMP, 0.5, 0.5)]], ids=["foreign", "fraction"])
def test_old_invalid_lines_cannot_complete(eng, lines):
    tid = started(eng, LIGHTING, TEC)
    plant_lines(eng, tid, lines)
    case = finish_work(eng, tid, TEC)
    assert case.ticket.status == "IN_PROGRESS"
    assert MATERIAL_INVALID in case.draft.readiness_evaluation.failing_items


def test_cleaning_may_use_no_material_and_gets_its_stock_back(api, eng):
    tid = started(eng, CLEANING, CLN)
    start = eng.repo.stock_of(CLEAN)
    assert usage(api, tid, CLN, [{"item_code": CLEAN, "used_qty": 3}]).status_code == 200
    assert eng.repo.stock_of(CLEAN) == start - 3
    reply = usage(api, tid, CLN, [])
    assert reply.status_code == 200, reply.text
    draft = reply.json()["draft"]
    assert reply.json()["material_lines"] == [] and draft["material_requirement_mode"] == "N_A"
    assert eng.repo.stock_of(CLEAN) == start
    assert finish_work(eng, tid, CLN).ticket.status == "READY_FOR_REVIEW"


# ---------------------------------------------------------------------- plan 15 kept: no norm block


def test_norm_one_used_four_saves_and_completes_without_reason(api, eng):
    tid = started(eng, LIGHTING, TEC)
    start = eng.repo.stock_of(LAMP)
    assert eng.catalog.material(LAMP).norm_qty == 1
    reply = usage(api, tid, TEC, [{"item_code": LAMP, "used_qty": 4}])
    assert reply.status_code == 200
    line = reply.json()["material_lines"][0]
    assert (line["issued_qty"], line["used_qty"], line["variance_reason"]) == (4, 4, None)
    assert eng.repo.stock_of(LAMP) == start - 4
    case = finish_work(eng, tid, TEC)
    assert case.ticket.status == "READY_FOR_REVIEW"
    assert case.draft.readiness_evaluation.all_pass and case.draft.non_blocking_warnings == []


def test_legacy_used_below_issued_still_needs_a_reason_and_above_is_refused(api, eng):
    tid = started(eng, LIGHTING, TEC)
    url = f"/api/v1/mo/tickets/{tid}/materials/{LAMP}"
    assert api.post(url, json={"issued_qty": 1, "used_qty": 2}, headers=H[TEC]).status_code == 409
    assert api.post(url, json={"issued_qty": 2, "used_qty": 1}, headers=H[TEC]).status_code == 200
    case = finish_work(eng, tid, TEC)
    assert case.ticket.status == "IN_PROGRESS" and not case.draft.readiness_evaluation.variance_explained
    assert (
        api.post(url, json={"issued_qty": 2, "used_qty": 1, "variance_reason": "Dự phòng"}, headers=H[TEC]).status_code
        == 200
    )
    assert eng.report_complete(tid, TEC).ticket.status == "READY_FOR_REVIEW"


# ---------------------------------------------------------------------- permission and state


def test_wrong_actor_and_wrong_state_change_nothing(api, eng):
    tid = started(eng, LIGHTING, TEC)
    before = state(eng, tid)
    body = [{"item_code": LAMP, "used_qty": 1}]
    assert usage(api, tid, CLN, body).status_code == 403
    assert usage(api, tid, BPTN, body).status_code == 403
    with pytest.raises(ActionDeniedError):
        eng.save_material_usage(tid, CLN, lines=[MaterialUsageLine(item_code=LAMP, used_qty=1)])
    assert state(eng, tid)[1] == before[1]
    assert usage(api, "SIM-TKT-NOPE-999", TEC, body).status_code == 404
    routed = report(eng, "Đèn sảnh thang máy tầng 5 tòa S1 bị cháy.")
    routed_before = state(eng, routed)
    assert usage(api, routed, TEC, body).status_code in (403, 409)  # not accepted: not in progress
    assert state(eng, routed)[1] == routed_before[1]
    assert eng.get(routed).model_dump(mode="json")["material_lines"] == routed_before[0]["material_lines"]
