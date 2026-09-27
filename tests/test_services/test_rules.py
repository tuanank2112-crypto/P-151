from datetime import datetime

import pytest

from src.models.entities import Location, Shift
from src.services.assignment import is_on_shift
from src.services.intake_llm import IntakeExtraction, extract_mock, match_location
from src.services.safety import detect_safety_flags, normalize

LOCATIONS = [
    Location(id="T05-HL", building="S1.01", floor=5, area="corridor", name="Hành lang tầng 5"),
    Location(id="T05-STM", building="S1.01", floor=5, area="elevator_lobby", name="Sảnh thang máy tầng 5"),
    Location(id="T06-HL", building="S1.01", floor=6, area="corridor", name="Hành lang tầng 6"),
    Location(id="TM1", building="S1.01", floor=None, area="elevator_car", unit="1", name="Thang máy số 1"),
    Location(id="TM2", building="S1.01", floor=None, area="elevator_car", unit="2", name="Thang máy số 2"),
]


def test_normalize_strips_diacritics():
    assert normalize("Đèn Tầng 5 có mùi khét") == "den tang 5 co mui khet"


@pytest.mark.parametrize(
    ("text", "flag"),
    [
        ("Có mùi khét ở hành lang", "burning_smell"),
        ("mui khet o hanh lang", "burning_smell"),
        ("Ổ điện bị chập điện, tóe tia lửa", "sparks_short"),
        ("Có người mắc kẹt trong thang máy số 2", "entrapment"),
        ("Mất điện cả tầng 7", "power_outage"),
    ],
)
def test_safety_flags(text, flag):
    assert flag in detect_safety_flags(text)


@pytest.mark.parametrize(
    "text",
    ["Đèn hành lang tầng 5 chập chờn", "Bóng đèn chưa khỏi hỏng từ hôm qua", "Rò rỉ nước ở hành lang tầng 3"],
)
def test_no_false_safety_flags(text):
    assert detect_safety_flags(text) == []


def test_extract_mock_lighting_corridor():
    extraction = extract_mock("Đèn hành lang tầng 5 bị hỏng")
    assert (extraction.category, extraction.area, extraction.floor) == ("lighting", "corridor", 5)


def test_extract_mock_elevator_number():
    extraction = extract_mock("Thang máy số 2 bị kêu to khi lên tầng 10")
    assert (extraction.category, extraction.area, extraction.unit) == ("elevator", "elevator_car", "2")


def test_extract_mock_month_is_not_elevator():
    assert extract_mock("Từ tháng 5 đèn hành lang tầng 6 đã yếu").unit is None


def test_match_unique_location():
    extraction = IntakeExtraction(category="lighting", floor=5, area="corridor", summary="x")
    assert match_location(extraction, LOCATIONS).location_id == "T05-HL"


def test_match_floor_only_is_ambiguous():
    extraction = IntakeExtraction(category="lighting", floor=5, summary="x")
    result = match_location(extraction, LOCATIONS)
    assert result.location_id is None
    assert len(result.candidates) > 1


def test_match_elevator_without_number_is_ambiguous():
    extraction = IntakeExtraction(category="elevator", area="elevator_car", summary="x")
    assert match_location(extraction, LOCATIONS).location_id is None


def test_match_elevator_with_number():
    extraction = IntakeExtraction(category="elevator", area="elevator_car", unit="2", floor=10, summary="x")
    assert match_location(extraction, LOCATIONS).location_id == "TM2"


def _shift(days: str, start: str, end: str) -> Shift:
    return Shift(
        technician_id="KT", technician_name="KT", skill="lighting", building="S1.01", days=days, start=start, end=end
    )


def test_day_shift():
    shift = _shift("0123456", "06:00", "14:00")
    assert is_on_shift(shift, datetime(2026, 9, 28, 9, 0))
    assert not is_on_shift(shift, datetime(2026, 9, 28, 14, 0))


def test_overnight_shift_belongs_to_previous_day():
    shift = _shift("0", "22:00", "06:00")  # Monday night only
    assert is_on_shift(shift, datetime(2026, 9, 28, 23, 0))  # Monday 23:00
    assert is_on_shift(shift, datetime(2026, 9, 29, 3, 0))  # Tuesday 03:00, still Monday's shift
    assert not is_on_shift(shift, datetime(2026, 9, 28, 3, 0))  # Monday 03:00 is Sunday's shift
