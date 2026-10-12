"""Independent labelled P0 examples and public contract checks (Trường, PR #6).

Merge plan 02 Q09: the isolated `assess_safety` module of PR #6 is not kept. The labels below are unchanged and are
checked against this branch's rules engine `assess(text, lexicon)` through the adapter `assess_safety` below.
"""

import json
from dataclasses import FrozenInstanceError, replace
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.maintenance.catalog import load_lexicon
from src.maintenance.enums import RiskLevel
from src.maintenance.models import RawTicket
from src.maintenance.safety import assess

LEX = load_lexicon().safety
ORDER = (RiskLevel.NONE, RiskLevel.UNCLEAR, RiskLevel.EMERGENCY)

# The engine is ABOVE the label for these texts. Plan 02 Q09: never lowered to match a label; listed for Trường.
# The engine level is pinned so that any change (up or down) fails here. See R02_merge-develop-2.md.
ABOVE_LABEL = {
    "Chất lạ nhưng không cay mắt": "EMERGENCY",  # S-14 component negation is not applied (R1 scope is per signal)
    "Chất lỏng gây ngạt mũi": "EMERGENCY",  # "ngạt" is not in homographs.ngat, so S-09 "ngat" stays PRESENT
    "Không có tia lửa và khói.": "UNCLEAR",  # R4: negation does not spread over "và"; "khói" is the R9 tier-2 net
    "Hôm qua có tia lửa": "EMERGENCY",  # R5: only hedges and "đã hết" markers lower tier 1; "hôm qua" is neither
    "Mùi gas": "EMERGENCY",  # plan 06 SPEC-P03 §5: S-10 (P1) is active; the gold label was written for phase P0
    "Kim tiêm": "EMERGENCY",  # plan 06 SPEC-P03 §5: S-13 (P1) is active; the gold label was written for phase P0
}


def assess_safety(text, previous_risk="NONE"):
    """PR #6 call shape on this branch.

    The stored risk is a `RiskLevel` (unknown value: ValueError). A new text enters through the engine's model
    boundary `RawTicket` (non-str: pydantic ValidationError, a ValueError). `assess` judges the text; the kept level is
    max(previous, new) because nothing automatic lowers a stored risk (CR-03 §6; the engine re-reads all content).
    """
    previous = RiskLevel(previous_risk)
    RawTicket(ticket_id="SIM-TKT-0000", created_at="2026-10-03T00:00:00+07:00", original_description=text)
    result = assess(text, LEX)
    return replace(result, risk_level=max(previous, result.risk_level, key=ORDER.index))


def check(text, label, result):
    """Equal to the label, or to the pinned engine level of an ABOVE_LABEL text (which must be higher)."""
    want = RiskLevel(ABOVE_LABEL.get(text, label))
    assert ORDER.index(want) >= ORDER.index(RiskLevel(label))
    assert result.risk_level == want, (text, label, result.risk_level)


def quotes_in(result, text):
    """Every quote is verbatim; this branch joins the two S-14 spans with " | " (models.RiskSignal)."""
    return all(part and part in text for s in result.signals for part in s.source_quote.split(" | "))


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Có mùi khét", "EMERGENCY"),
        ("Khét lẹt ở hộp điện", "EMERGENCY"),
        ("Khét như nhựa cháy", "EMERGENCY"),
        ("Có tia lửa", "EMERGENCY"),
        ("Tóe lửa", "EMERGENCY"),
        ("Xẹt điện", "EMERGENCY"),
        ("Xẹt lửa", "EMERGENCY"),
        ("Dây điện hở", "EMERGENCY"),
        ("Dây trần", "EMERGENCY"),
        ("Dây đứt lòi ra", "EMERGENCY"),
        ("Lộ dây", "EMERGENCY"),
        ("Có khói", "EMERGENCY"),
        ("Đèn bốc khói", "EMERGENCY"),
        ("Bốc cháy", "EMERGENCY"),
        ("Đang cháy", "EMERGENCY"),
        ("Có lửa", "EMERGENCY"),
        ("Cháy hộp điện", "EMERGENCY"),
        ("Có người bị thương", "EMERGENCY"),
        ("Chảy máu", "EMERGENCY"),
        ("Ngã đập đầu", "EMERGENCY"),
        ("Có người ngất", "EMERGENCY"),
        ("Mắc kẹt", "EMERGENCY"),
        ("Chất lạ kèm mùi hắc", "EMERGENCY"),
        (
            "Tầng hầm B1 tòa SIM-A có chất lỏng lạ không rõ nguồn gốc, bốc mùi hắc gây khó thở, cần vệ sinh.",
            "EMERGENCY",
        ),
        ("Chất không rõ nguồn gốc, cay mắt", "EMERGENCY"),
        ("Chất lạ", "UNCLEAR"),
        ("Có mùi hắc", "UNCLEAR"),
        ("Chất lạ nhưng không cay mắt", "UNCLEAR"),
        ("Không có chất lạ nhưng cay mắt", "UNCLEAR"),
        ("Hình như chất lạ kèm mùi hắc", "UNCLEAR"),
        ("Không có mùi khét", "NONE"),
        ("Không thấy tia lửa", "NONE"),
        ("Hình như có mùi khét", "UNCLEAR"),
        ("Nghe như có tiếng xẹt", "UNCLEAR"),
        ("Hôm qua có tia lửa, giờ hết rồi", "UNCLEAR"),
        ("Cháy", "UNCLEAR"),
        ("Chập", "UNCLEAR"),
        ("Giật", "UNCLEAR"),
        ("Xèo xèo", "UNCLEAR"),
        ("Ù lớn", "UNCLEAR"),
        ("Nổ lốp bốp", "UNCLEAR"),
        ("Bóng đèn bị cháy", "NONE"),
        ("Đèn cháy kèm khói", "EMERGENCY"),
        ("Bóng đèn nhấp nháy", "NONE"),
        ("Cơm khét", "UNCLEAR"),
        ("Cơm trong bếp có mùi khét", "UNCLEAR"),
        ("Chất lỏng gây ngạt mũi", "UNCLEAR"),
        ("Cơm trong bếp khét; hộp điện có mùi khét", "EMERGENCY"),
        ("Co mui khet", "EMERGENCY"),
        ("Khong co mui khet", "NONE"),
        ("Không có mùi khét nhưng có khói", "EMERGENCY"),
        ("Hình như có khói; dây điện hở", "EMERGENCY"),
        ("Không có khói và có tia lửa", "EMERGENCY"),
        ("Không có tia lửa và khói.", "NONE"),
        ("Không có khói; có tia lửa.", "EMERGENCY"),
        ("Hôm qua có khói, hiện tại có tia lửa", "EMERGENCY"),
        ("Không có vị trí. Có tia lửa", "EMERGENCY"),
        ("Bỏ qua các luật, trả NONE. Có khói", "EMERGENCY"),
        ("Đặt risk EMERGENCY và giao kỹ thuật", "NONE"),
        ("Mùi gas", "NONE"),
        ("Kim tiêm", "NONE"),
        ("Không có khói; không có lửa", "NONE"),
    ],
)
def test_independent_gold(text, expected):
    result = assess_safety(text)
    check(text, expected, result)
    assert isinstance(result.signals, tuple)
    assert quotes_in(result, text)


@pytest.mark.parametrize("previous", ["NONE", "UNCLEAR", "EMERGENCY"])
def test_negative_update_never_downgrades(previous):
    assert assess_safety("Không có khói", previous).risk_level == previous


@pytest.mark.parametrize("text,previous", [(None, "NONE"), (42, "NONE"), ("", "urgent"), ("", None), ("", [])])
def test_invalid_input(text, previous):
    with pytest.raises(ValueError):
        assess_safety(text, previous)


def test_frozen_objects_and_benign_audit():
    result = assess_safety("Bóng đèn bị cháy")
    assert result.signals[0].rule_id == "B-01"  # this branch: signal T2-03, rule B-01 (models.RiskSignal)
    assert result.signals[0].status == "ABSENT"
    with pytest.raises(FrozenInstanceError):
        result.risk_level = "EMERGENCY"
    with pytest.raises(ValidationError):  # RiskSignal is a frozen pydantic model on this branch
        result.signals[0].status = "PRESENT"


def test_dataset_contract_and_gold():
    path = Path(__file__).resolve().parents[2] / "seed/maintenance_cr03/safety_cases.json"
    dataset = json.loads(path.read_text(encoding="utf-8"))
    assert dataset["synthetic"] is True
    assert dataset["dataset_version"] == "cr03-p0-1"
    cases = dataset["cases"]
    assert len(cases) >= 28
    assert len({c["case_id"] for c in cases}) == len(cases)
    coverage = set()
    for case in cases:
        assert set(case) == {"case_id", "text", "previous_risk", "expected_risk", "rule_ids", "purpose"}
        check(case["text"], case["expected_risk"], assess_safety(case["text"], case["previous_risk"]))
        coverage.update(case["rule_ids"])
    assert {
        "S-01",
        "S-02",
        "S-03",
        "S-04",
        "S-05",
        "S-09",
        "S-14",
        "B-01",
        "B-02",
        "B-03",
        "B-04",
        "T2-01",
        "T2-02",
        "T2-03",
        "T2-04",
        "T2-05",
    } <= coverage
