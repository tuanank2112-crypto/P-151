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


# ---------------------------------------------------------------------- plan 05 round 2 (H04): the location is where
# the PROBLEM is, not the resident's home; spaced building codes; "cầu thang", "lối thoát hiểm"; liquid on electrical
# equipment and bare wires get no playbook


@pytest.mark.parametrize(
    ("text", "location"),
    [
        ("Căn 1508 tầng 15 tòa S1, báo giúp hành lang tầng 3 có rác", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Em ở tòa S2, đi qua hành lang tầng 3 tòa S1 thấy nhiều rác", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Em o toa S2 di qua hanh lang tang 3 toa S1 thay nhieu rac", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Cô Đào phòng 1508 tòa S1 nhờ báo hành lang tầng 15 lá cây rụng", "Tòa S1 / Tầng 15 / Hành lang"),
        ("Em ở căn 2-07 tòa S2, đèn hành lang tầng 2 nhấp nháy", "Tòa S2 / Tầng 2 / Hành lang"),
        ("Hành lang tầng 3 tòa S1, đèn hỏng. Tòa S2 tầng 7 thì ổn", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Rác vứt bừa bãi quá, em ở tòa S1 tầng 12\nỞ hầm B1 ạ", "Tòa S1 / Tầng B1 / Hầm xe"),
        ("Em ở tòa S2 tầng 9 hành lang, báo: rác chất đống", "Tòa S2 / Tầng 9 / Hành lang"),  # stands there
        ("Hành lang tầng 3 toà S1 nhiều rác", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Hành lang tầng 3 toà S2 nhiều rác", "Tòa S2 / Tầng 3 / Hành lang"),
        ("hanh lang tang 3 toa s2 nhieu rac", "Tòa S2 / Tầng 3 / Hành lang"),
        ("Hành lang tầng 03 tòa S1 đèn hỏng", "Tòa S1 / Tầng 3 / Hành lang"),
        ("Tầng hầm B01 tòa S1 có rác", "Tòa S1 / Tầng B1 / Hầm xe"),
        ("Cầu thang tầng 5 tòa S2 đèn hỏng", "Tòa S2 / Tầng 5 / Cầu thang bộ"),
        ("Lối thoát hiểm tầng 9 tòa S2 đèn exit không sáng", "Tòa S2 / Tầng 9 / Lối thoát hiểm"),
    ],
)
def test_round2_location_is_where_the_problem_is(text, location):
    assert extract_location(text, BUILDINGS) == location


def test_a_floor_named_only_as_the_residents_home_is_not_the_problem_floor():
    text = "Rác vứt bừa bãi quá, em ở tòa S1 tầng 12"
    assert extract_location(text, BUILDINGS) is None
    assert missing_location_parts(text, BUILDINGS) == ["floor", "area"]


def test_buildings_outside_the_pilot_are_not_codes_and_ở_is_not_a_code_letter():
    """Plan 05 joined spaced codes ("toà SIM A"); with the Ocean Park allow-list only S1/S2 are buildings."""
    assert extract_location("Hành lang tầng 3 toà SIM A nhiều rác", BUILDINGS) is None
    assert extract_location("Hành lang tầng 3 tòa S1 ở gần cổng có rác", BUILDINGS) == "Tòa S1 / Tầng 3 / Hành lang"


@pytest.mark.parametrize(
    ("text", "playbook", "reason_code"),
    [
        ("Cầu thang tầng 5 tòa SIM-B đèn hỏng", "PB-TEC-01", None),
        ("Lối thoát hiểm tầng 9 tòa SIM-C đèn exit không sáng", "PB-TEC-01", None),
        ("Lối thoát hiểm tầng 9 tòa SIM-C nhiều rác", "PB-CLN-01", None),
        ("Cầu thang máy tầng 5 tòa SIM-B bị kẹt", None, "OUT_OF_SCOPE"),
        # liquid on electrical equipment / bare wires: no playbook, BPTN reads it (step 2b is the first guard)
        ("Tầng hầm B1 tòa SIM-A nước tràn vào tủ điện", None, "OUT_OF_SCOPE"),
        ("Tầng hầm B1 tòa SIM-A nước tràn vào tủ điện, ngập gần tới ổ cắm", None, "OUT_OF_SCOPE"),
        ("tang ham B1 toa SIM-A nuoc tran vao tu dien", None, "OUT_OF_SCOPE"),
        ("Hành lang tầng 3 tòa SIM-A ổ cắm bị ngập nước", None, "OUT_OF_SCOPE"),
        ("Đèn hành lang tầng 3 tòa SIM-A rơi ra, lòi cả dây điện", None, "OUT_OF_SCOPE"),
        ("Đèn hành lang tầng 3 tòa SIM-A hỏng, à mà dây điện chỗ đèn lòi ra ngoài", None, "OUT_OF_SCOPE"),
        ("Bóng đèn hành lang tầng 3 tòa SIM-A rớt xuống, lộ dây điện", None, "OUT_OF_SCOPE"),
        # look-alikes stay as before: water on the floor, a lamp switch that does nothing
        ("Hầm B1 tòa SIM-A nước đọng thành vũng", "PB-CLN-01", None),
        ("Hành lang tầng 3 tòa SIM-A bấm công tắc mà đèn không sáng", "PB-TEC-01", None),
    ],
)
def test_round2_classification(text, playbook, reason_code):
    result = classify(text)
    assert (result.playbook_id, result.reason_code) == (playbook, reason_code), result


# ---------------------------------------------------------------------- plan 05b: "đèn cháy / đèn chập = đèn hỏng"


@pytest.mark.parametrize(
    "text",
    [
        "Đèn hành lang tầng 3 tòa SIM-A bị chập",
        "Đèn hành lang tầng 3 tòa SIM-A chập rồi",
        "Hành lang tầng 3 tòa SIM-A đèn bị chập, không sáng",
        "Bóng đèn sảnh chính tòa SIM-B bị chập điện",
        "den hanh lang tang 3 toa SIM-A bi chay",
        "den hanh lang tang 3 toa SIM-A bi chap",
        "Đèn hành lang tầng 3 tòa SIM-A bị cháy",
    ],
)
def test_a_burnt_or_shorted_lamp_is_a_lighting_job(text):
    assert classify(text).playbook_id == "PB-TEC-01", classify(text)


@pytest.mark.parametrize("text", ["Chấp nhận phí gửi xe ở hầm", "Ổ điện hành lang tầng 3 tòa SIM-A bị chập"])
def test_chap_without_a_lamp_is_not_a_lighting_job(text):
    assert classify(text).playbook_id is None
