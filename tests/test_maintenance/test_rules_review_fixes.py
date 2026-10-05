"""Regression for the 2026-10-04 logic review (plan 04, C1): classification false negatives and positives."""

import pytest

from src.maintenance.rules import classify, extract_location, missing_location_parts

BUILDINGS = ("S1", "S2")  # catalog site.buildings (Ocean Park pilot)

LIGHTING = [
    "Đèn cầu thang bộ tầng 3 tòa S1 nhấp nháy",
    "Đèn hành lang tầng 3 tòa S1 bị hư",
    "Đèn ở hành lang tầng 5 tòa S1 không sáng",
    "Đèn trong hầm xe B1 tòa S1 không sáng",
    "Đèn led sảnh chính tòa S1 bị vỡ",
    "Hành lang tầng 3 tòa S1 mất đèn",
    "Đèn hành lang tầng 3 không lên",
    # surname / "busy" must not pull the cleaning playbook in
    "Tôi là Bùi Văn An, đèn hành lang tầng 3 không sáng",
    "Tôi bị bận nên báo muộn: đèn hành lang tầng 3 không sáng",
]
CLEANING = [
    "Sảnh chính tòa S2 bẩn quá",
    "Hành lang tầng 3 dơ quá",
    "Có phân chó ở sảnh chính tòa S1",
    "Có người nôn ra sàn hành lang tầng 4",
    "Nước tiểu ở góc cầu thang bộ tầng 2",
]
NO_PLAYBOOK = [
    "Khi đến tầng 5 tòa S1 tôi thấy cửa thoát hiểm bị hỏng",
    "Tôi đến sảnh chính thì thấy thang máy hỏng",
    "Đi đến hầm xe thì barrier tắt nguồn",
]


@pytest.mark.parametrize("text", LIGHTING)
def test_lighting_reports_get_the_technical_playbook(text):
    result = classify(text)
    assert result.playbook_id == "PB-TEC-01", result
    assert result.service_category == "KY_THUAT"


@pytest.mark.parametrize("text", CLEANING)
def test_dirty_common_area_reports_get_the_cleaning_playbook(text):
    result = classify(text)
    assert result.playbook_id == "PB-CLN-01", result
    assert result.service_category == "VE_SINH"


@pytest.mark.parametrize("text", NO_PLAYBOOK)
def test_arriving_somewhere_is_not_a_lamp(text):
    result = classify(text)
    assert result.playbook_id is None, result
    assert result.reason_code == "OUT_OF_SCOPE"


# ---------------------------------------------------------------------- live-API corpus, 2026-10-04 (after UI dropped
# the location picker): lamp after the area, burnt-out lamp (Q22), mixed report, location wording


LAMP_AFTER_AREA = [
    "Cầu thang bộ tầng 6 tòa S2 đèn bị hỏng.",
    "Hầm B2 tòa S1 đèn tắt hết, rất tối",
    "Tòa S1 / Tầng hầm B1 / Bãi đỗ xe: đèn không sáng.",
    "Bóng đèn hành lang tầng 3 tòa S1 bị cháy, nhờ thay.",  # Q22
    "bong den hanh lang tang 3 toa S1 bi chay",
    "Bóng đèn cầu thang tầng 9 bị cháy, nhờ thay",
]


@pytest.mark.parametrize("text", LAMP_AFTER_AREA)
def test_lamp_named_after_the_area_or_burnt_out_is_lighting(text):
    assert classify(text).playbook_id == "PB-TEC-01", classify(text)


def test_dirt_and_a_broken_lamp_in_one_report_is_unclear():
    result = classify("Hành lang tầng 3 tòa S1 vừa có rác vừa có đèn không sáng.")
    assert result.playbook_id is None and result.reason_code == "CATEGORY_UNCLEAR"


def test_a_lamp_without_any_common_area_is_not_enough():
    assert classify("Đèn nhà tôi bị hỏng").playbook_id is None


@pytest.mark.parametrize(
    ("text", "location"),
    [
        ("Tòa S1 / Tầng 2 / Thang bộ: có rác và bụi.", "Tòa S1 / Tầng 2 / Cầu thang bộ"),
        ("Tòa S2 / Tầng 4 / Phòng rác tầng: rác tràn ra ngoài.", "Tòa S2 / Tầng 4 / Phòng rác"),
        ("Tòa S1 / Tầng hầm B1 / Bãi đỗ xe: đèn không sáng.", "Tòa S1 / Tầng B1 / Hầm xe"),  # asset label kept
        ("Tòa S2 / Tầng trệt / Sân chơi: nhiều lá cây.", "Tòa S2 / Tầng Trệt / Sân chơi"),
        ("Tòa nhà S1, tầng 3, hành lang: nhiều rác", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Block S1 lầu 3 hành lang có rác", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Tòa S2 tầng 6 sân thượng có rác", "Tòa S2 / Tầng 6 / Sân thượng"),
        ("Hành lang tầng 3 tòa S1 có rác", "Tòa S1 / Tầng 3 / Hành lang"),  # unchanged
    ],
)
def test_location_wording_residents_use(text, location):
    assert extract_location(text, BUILDINGS) == location


def test_tòa_nhà_alone_is_not_a_building_code():
    assert "building" in missing_location_parts("Tòa nhà tầng 3 hành lang có rác", BUILDINGS)
