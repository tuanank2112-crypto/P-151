"""Plan 21: each area has exactly one lighting material; one material may serve several areas."""

import pytest

from src.maintenance.catalog import load_catalog
from src.maintenance.rules import AREA_LABELS


def _catalog():
    return load_catalog()


def test_every_bound_area_is_a_known_label_and_a_technical_material():
    catalog = _catalog()
    technical = set(catalog.playbook_materials["PB-TEC-01"])
    assert catalog.area_materials and set(catalog.area_materials) <= AREA_LABELS
    assert set(catalog.area_materials.values()) <= technical


def test_one_material_may_serve_many_areas_but_each_area_has_one():
    catalog = _catalog()
    assert catalog.area_materials["Hành lang"] == catalog.area_materials["Cầu thang bộ"]
    assert catalog.material_for_area("Thang máy") != catalog.material_for_area("Hành lang")
    assert catalog.material_for_area("Hầm xe") == catalog.material_for_area("Bãi đỗ xe") == "SIM-MAT-LAMP-07"
    assert catalog.material_for_area(None) is None


def test_all_thirteen_areas_have_exactly_one_material():
    assert set(_catalog().area_materials) == AREA_LABELS


def test_lookup_is_by_area_not_by_building_or_floor():
    from src.maintenance.rules import location_area

    catalog = _catalog()
    for location in ("Tòa S1 / Tầng 3 / Hành lang", "Tòa S2 / Tầng 9 / Hành lang"):
        assert catalog.material_for_area(location_area(location)) == "SIM-MAT-LAMP-01"


@pytest.mark.parametrize("bad", [{"Không có": "SIM-MAT-LAMP-01"}, {"Hành lang": "SIM-MAT-CLEAN-01"}])
def test_catalog_refuses_unknown_area_or_non_technical_material(bad):
    catalog = _catalog()
    with pytest.raises(ValueError):
        type(catalog).model_validate({**catalog.model_dump(), "area_materials": bad})


@pytest.mark.parametrize(
    ("text", "item_code"),
    [
        ("Đèn hành lang tầng 1 tòa S1 không sáng", "SIM-MAT-LAMP-01"),
        ("Đèn phòng rác tầng 4 tòa S2 không sáng", "SIM-MAT-LAMP-03"),
    ],
)
def test_step_7_plans_the_material_bound_to_the_area(fresh, text, item_code):
    from tests.test_maintenance.helpers import report

    case = fresh.get(report(fresh, text))
    assert [m.item_code for m in case.material_lines] == [item_code]
