"""Regression for the 2026-10-04 logic review (plan 04, C1): classification false negatives and positives."""

import pytest

from src.maintenance.rules import classify, extract_location, missing_location_parts

LIGHTING = [
    "Đèn cầu thang bộ tầng 3 tòa SIM-A nhấp nháy",
    "Đèn hành lang tầng 3 tòa SIM-A bị hư",
    "Đèn ở hành lang tầng 5 tòa SIM-A không sáng",
    "Đèn trong hầm xe B1 tòa SIM-A không sáng",
    "Đèn led sảnh chính tòa SIM-A bị vỡ",
    "Hành lang tầng 3 tòa SIM-A mất đèn",
    "Đèn hành lang tầng 3 không lên",
    # surname / "busy" must not pull the cleaning playbook in
    "Tôi là Bùi Văn An, đèn hành lang tầng 3 không sáng",
    "Tôi bị bận nên báo muộn: đèn hành lang tầng 3 không sáng",
]
CLEANING = [
    "Sảnh chính tòa SIM-B bẩn quá",
    "Hành lang tầng 3 dơ quá",
    "Có phân chó ở sảnh chính tòa SIM-A",
    "Có người nôn ra sàn hành lang tầng 4",
    "Nước tiểu ở góc cầu thang bộ tầng 2",
]
NO_PLAYBOOK = [
    "Khi đến tầng 5 tòa SIM-A tôi thấy cửa thoát hiểm bị hỏng",
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
    "Cầu thang bộ tầng 6 tòa SIM-C đèn bị hỏng.",
    "Hầm B2 tòa SIM-A đèn tắt hết, rất tối",
    "Tòa SIM-A / Tầng hầm B1 / Bãi đỗ xe: đèn không sáng.",
    "Bóng đèn hành lang tầng 3 tòa SIM-A bị cháy, nhờ thay.",  # Q22
    "bong den hanh lang tang 3 toa SIM-A bi chay",
    "Bóng đèn cầu thang tầng 9 bị cháy, nhờ thay",
]


@pytest.mark.parametrize("text", LAMP_AFTER_AREA)
def test_lamp_named_after_the_area_or_burnt_out_is_lighting(text):
    assert classify(text).playbook_id == "PB-TEC-01", classify(text)


def test_dirt_and_a_broken_lamp_in_one_report_is_unclear():
    result = classify("Hành lang tầng 3 tòa SIM-A vừa có rác vừa có đèn không sáng.")
    assert result.playbook_id is None and result.reason_code == "CATEGORY_UNCLEAR"


def test_a_lamp_without_any_common_area_is_not_enough():
    assert classify("Đèn nhà tôi bị hỏng").playbook_id is None


@pytest.mark.parametrize(
    ("text", "location"),
    [
        ("Tòa SIM-A / Tầng 2 / Thang bộ: có rác và bụi.", "Tòa SIM-A / Tầng 2 / Cầu thang bộ"),
        ("Tòa SIM-C / Tầng 4 / Phòng rác tầng: rác tràn ra ngoài.", "Tòa SIM-C / Tầng 4 / Phòng rác"),
        ("Tòa SIM-A / Tầng hầm B1 / Bãi đỗ xe: đèn không sáng.", "Tòa SIM-A / Tầng B1 / Hầm xe"),  # asset label kept
        ("Tòa SIM-B / Tầng trệt / Sân chơi: nhiều lá cây.", "Tòa SIM-B / Tầng Trệt / Sân chơi"),
        ("Tòa nhà SIM-A, tầng 3, hành lang: nhiều rác", "Tòa SIM-A / Tầng 3 / Hành lang"),
        ("Block SIM-A lầu 3 hành lang có rác", "Tòa SIM-A / Tầng 3 / Hành lang"),
        ("Tòa SIM-B tầng 6 sân thượng có rác", "Tòa SIM-B / Tầng 6 / Sân thượng"),
        ("Hành lang tầng 3 tòa SIM-A có rác", "Tòa SIM-A / Tầng 3 / Hành lang"),  # unchanged
    ],
)
def test_location_wording_residents_use(text, location):
    assert extract_location(text) == location


def test_tòa_nhà_alone_is_not_a_building_code():
    assert "building" in missing_location_parts("Tòa nhà tầng 3 hành lang có rác")


# ---------------------------------------------------------------------- plan 05 (H02): the location never picks the
# job type; lamps typed without accents; private / street lamps; the full metamorphic suite is
# test_classify_metamorphic.py


@pytest.mark.parametrize(
    ("text", "playbook", "reason_code"),
    [
        # "phòng rác" is where the resident stands, not rubbish
        ("Block SIM-B lầu 6 phòng rác: đèn chập chờn", "PB-TEC-01", None),
        ("Tòa SIM-A / Tầng 3 / Phòng rác: thang máy hỏng", None, "OUT_OF_SCOPE"),
        # ...but the garbage room overflowing is still cleaning
        ("Phòng rác tầng 4 tòa SIM-A đầy tràn", "PB-CLN-01", None),
        ("phong rac tang 4 toa SIM-A bi day", "PB-CLN-01", None),
        # unaccented lamp before its symptom; arrival is not a lamp
        ("Hanh lang tang 3 toa SIM-A den chap chon", "PB-TEC-01", None),
        ("Toa SIM-A / Tang 3 / Hanh lang: vua co rac vua co den khong sang", None, "CATEGORY_UNCLEAR"),
        ("Khi den hanh lang tang 3 thi thay thang may hong", None, "OUT_OF_SCOPE"),
        ("Hanh lang tang 3 den sang roi, cam on", None, "OUT_OF_SCOPE"),
        ("Hành lang tầng 3 đèn sáng rồi, cảm ơn", None, "OUT_OF_SCOPE"),  # "rồi" is not "rơi"
        # a lamp inside a flat or on the street outside the gate, even with the resident's location
        ("Tòa SIM-A tầng 3 hành lang: đèn trong căn hộ tôi bị hỏng", None, "OUT_OF_SCOPE"),
        ("Toa SIM-A tang 3 hanh lang: bong den phong ngu nha toi bi chay", None, "OUT_OF_SCOPE"),
        ("Hành lang tầng 3 tòa SIM-A: đèn đường ngoài cổng không sáng", None, "OUT_OF_SCOPE"),
        ("Đèn hành lang trước căn hộ 305 tầng 3 tòa SIM-A không sáng", "PB-TEC-01", None),
        # new resident wording, accented and not
        ("Tòa SIM-A / Tầng 3 / Hành lang: đèn sáng lờ mờ", "PB-TEC-01", None),
        ("Tòa SIM-A / Tầng 3 / Hành lang: đèn rớt xuống vỡ tan", "PB-TEC-01", None),
        ("Toa SIM-A / Tang 3 / Hanh lang: bong den chay roi", "PB-TEC-01", None),
        ("Toa SIM-A / Tang 3 / Hanh lang: mat den tu toi qua", "PB-TEC-01", None),
        ("Tòa SIM-A / Tầng 3 / Hành lang: nước đọng thành vũng", "PB-CLN-01", None),
        ("Tòa SIM-A / Tầng 3 / Hành lang: mùi hôi nồng nặc", "PB-CLN-01", None),
        ("Toa SIM-A / Tang 3 / Hanh lang: san do qua", "PB-CLN-01", None),
        ("Tòa SIM-A / Tầng 3 / Hành lang: sơn đổ ra sàn chưa ai lau", "PB-CLN-01", None),
        # look-alikes of the new cleaning words
        ("Toa SIM-A / Tang 3 / Hanh lang: toi ban qua, thang may hong", None, "OUT_OF_SCOPE"),
        ("Hành lang tầng 3: không lâu sau thang máy lại hỏng", None, "OUT_OF_SCOPE"),
        ("Phan Văn Tài, hành lang tầng 3: đèn không sáng", "PB-TEC-01", None),
    ],
)
def test_plan05_location_and_wording(text, playbook, reason_code):
    result = classify(text)
    assert (result.playbook_id, result.reason_code) == (playbook, reason_code), result
