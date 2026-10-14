"""Plan 14: one lighting asset per area (Hành lang, Sảnh thang máy, Cầu thang bộ, Phòng rác), whatever the floor."""

import pytest
from pydantic import ValidationError

from src.maintenance.catalog import load_catalog
from src.maintenance.engine import GuardError
from src.maintenance.rules import location_area
from tests.test_maintenance.helpers import BPTN, report, without_asset

CATALOG = load_catalog()
ACTIVE = {a.area: a.asset_id for a in CATALOG.assets if a.active}


def test_catalog_has_an_active_lamp_asset_for_every_area():
    assert ACTIVE == {
        "Hành lang": "SIM-ASSET-LIGHT-HALLWAY",
        "Sảnh thang máy": "SIM-ASSET-LIGHT-LIFT-LOBBY",
        "Thang máy": "SIM-ASSET-LIGHT-LIFT-CABIN",
        "Cầu thang bộ": "SIM-ASSET-LIGHT-STAIRS",
        "Phòng rác": "SIM-ASSET-LIGHT-WASTE-ROOM",
        "Sảnh chính": "SIM-ASSET-LIGHT-MAIN-LOBBY",
        "Sảnh cư dân": "SIM-ASSET-LIGHT-RESIDENT-LOBBY",
        "Lối thoát hiểm": "SIM-ASSET-LIGHT-EXIT",
        "Bãi đỗ xe": "SIM-ASSET-LIGHT-PARKING",
        "Sân chơi": "SIM-ASSET-LIGHT-PLAYGROUND",
        "Sân thượng": "SIM-ASSET-LIGHT-ROOFTOP",
        "Lối đi": "SIM-ASSET-LIGHT-PATH",
        "Hầm xe": "SIM-ASSET-LIGHT-BASEMENT",
    }  # plan 21: all 13 areas; the receptionist (BPTN) is not asked to pick a lamp asset
    retired = {a.asset_id for a in CATALOG.assets if not a.active}
    assert retired == {f"SIM-ASSET-LIGHT-00{n}" for n in range(1, 7)}  # kept so old ticket ids still resolve


@pytest.mark.parametrize(
    ("location", "area"),
    [
        ("Tòa S1 / Tầng 3 / Hành lang", "Hành lang"),
        ("Tòa S2 / Tầng 12 / Sảnh thang máy", "Sảnh thang máy"),
        ("Tòa S1 / Tầng B1 / Hầm xe", "Hầm xe"),
        ("Tòa S1 / Tầng 6 / cầu thang bộ", "Cầu thang bộ"),
        ("Tòa S1 / Tầng 3", None),
        ("", None),
        (None, None),
    ],
)
def test_location_area_reads_the_last_part(location, area):
    assert location_area(location) == area


@pytest.mark.parametrize(
    ("text", "asset_id"),
    [
        ("Đèn hành lang tầng 1 tòa S1 không sáng", "SIM-ASSET-LIGHT-HALLWAY"),
        ("Đèn hành lang tầng 6 tòa S2 không sáng", "SIM-ASSET-LIGHT-HALLWAY"),
        ("Đèn sảnh thang máy tầng 5 tòa S1 không sáng", "SIM-ASSET-LIGHT-LIFT-LOBBY"),  # was AMBIGUOUS (2 assets)
        ("Đèn cầu thang bộ tầng 9 tòa S1 không sáng", "SIM-ASSET-LIGHT-STAIRS"),  # was NOT_FOUND
        ("Đèn phòng rác tầng 4 tòa S2 không sáng", "SIM-ASSET-LIGHT-WASTE-ROOM"),
    ],
)
def test_same_area_on_any_floor_or_building_matches_the_same_asset(fresh, text, asset_id):
    case = fresh.get(report(fresh, text))
    assert (case.proposal.asset_lookup_status, case.proposal.asset_id) == ("MATCHED", asset_id)
    assert case.ticket.asset_resolution == "FOUND" and case.ticket.department_id == "DEPT_TECHNICAL"


@pytest.mark.parametrize("text", ["Đèn hầm B1 tòa S1 không sáng", "Đèn tầng hầm B1 tòa S2 không sáng"])
def test_an_area_without_an_asset_waits_for_bptn(fresh, text):
    with without_asset(fresh, "Hầm xe"):
        case = fresh.get(report(fresh, text))
    assert case.proposal.asset_lookup_status == "NOT_FOUND"
    assert (case.ticket.status, case.ticket.blocker.code) == ("VERIFYING", "ASSET_UNCLEAR")


def test_bptn_may_pick_only_an_active_area_asset(fresh):
    with without_asset(fresh, "Hầm xe"):
        tid = report(fresh, "Đèn hầm B1 tòa S1 không sáng")
    for retired in ("SIM-ASSET-LIGHT-001", "SIM-ASSET-LIGHT-006"):
        with pytest.raises(GuardError, match="đang dùng"):
            fresh.bptn_resolve(tid, BPTN, asset_id=retired, note="Chọn mã cũ")
    case = fresh.bptn_resolve(tid, BPTN, asset_id="SIM-ASSET-LIGHT-HALLWAY", note="Đèn lối đi trong hầm")
    assert case.proposal.asset_lookup_status == "LOCKED_BY_BPTN" and case.ticket.status == "ROUTED"


def _with_assets(*rows: dict):
    data = CATALOG.model_dump()
    data["assets"] = [*data["assets"], *rows]
    return type(CATALOG).model_validate(data)


def _asset(asset_id: str, area: str, status: str = "ACTIVE_SIMULATED") -> dict:
    return {
        "asset_id": asset_id,
        "asset_type": "LIGHTING",
        "name": "x",
        "area": area,
        "asset_status": status,
        "linked_playbook_id": "PB-TEC-01",
        "source_ref": "test",
        "synthetic": True,
        "read_only": True,
    }


def test_catalog_refuses_two_active_assets_in_one_area_or_an_unknown_area():
    with pytest.raises(ValidationError, match="trùng"):
        _with_assets(_asset("SIM-ASSET-LIGHT-HALLWAY-2", "Hành lang"))
    with pytest.raises(ValidationError, match="AREA_PATTERNS"):
        _with_assets(_asset("SIM-ASSET-LIGHT-ROOF", "Mái nhà"))
    assert _with_assets(_asset("SIM-ASSET-LIGHT-OLD", "Hành lang", "RETIRED_SIMULATED"))  # retired twins are fine
