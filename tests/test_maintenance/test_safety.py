"""CR-BPTN-03 §15: the labelled sentence set for the safety layer (Evaluation Evidence).

Hard target: no tier-1 miss. False alarms are measured and printed (run with `-s` to see the numbers).
"""

from pathlib import Path

import pytest
import yaml

from src.maintenance.enums import RiskLevel
from src.maintenance.models import RiskSignal
from src.maintenance.safety import assess, merge_llm

CASES = yaml.safe_load((Path(__file__).with_name("safety_cases.yaml")).read_text(encoding="utf-8"))["cases"]


def test_the_set_has_at_least_forty_labelled_sentences_with_every_trap():
    assert len(CASES) >= 40
    notes = " ".join(c["note"] for c in CASES)
    for trap in ("B-01", "B-02", "B-03", "B-04", "B-05"):
        assert trap in notes, trap
    assert {c["expected"] for c in CASES} == {"EMERGENCY", "UNCLEAR", "NONE"}


def test_no_tier1_miss_and_report_false_alarms():
    results = [(c, assess(c["text"]).risk_level) for c in CASES]
    misses = [c["text"] for c, level in results if c["expected"] == "EMERGENCY" and level != RiskLevel.EMERGENCY]
    false_alarms = [c["text"] for c, level in results if c["expected"] == "NONE" and level != RiskLevel.NONE]
    wrong = [c["text"] for c, level in results if level != c["expected"]]
    tier1 = sum(c["expected"] == "EMERGENCY" for c in CASES)
    normal = sum(c["expected"] == "NONE" for c in CASES)
    print(
        f"\nsafety set: {len(CASES)} sentences | tier-1 missed {len(misses)}/{tier1} | "
        f"false alarms {len(false_alarms)}/{normal} | wrong label {len(wrong)}/{len(CASES)}"
    )
    assert misses == []  # hard gate
    assert wrong == []  # current rules match every label; a new mismatch must be looked at, not ignored


@pytest.mark.parametrize("case", CASES, ids=[c["note"] for c in CASES])
def test_each_sentence(case):
    assert assess(case["text"]).risk_level == case["expected"]


def test_every_signal_keeps_its_quote():
    result = assess("Đèn sảnh không sáng, có tia lửa và mùi khét ở hộp đèn")
    assert {s.signal_id for s in result.signals} >= {"S-01", "S-02"}
    assert all(s.source_quote and s.detected_by == "RULE" for s in result.signals)


def test_benign_reading_is_kept_as_absent_for_traceability():
    result = assess("Bóng đèn hành lang tầng 3 bị cháy")
    assert result.risk_level == RiskLevel.NONE
    assert [(s.signal_id, s.status) for s in result.signals] == [("B-01", "ABSENT")]


def test_ac05_the_model_can_raise_but_never_lower():
    text = "Đèn sảnh có tia lửa"
    rule = assess(text)
    lowered = merge_llm(
        rule, [RiskSignal(signal_id="S-02", status="ABSENT", source_quote="tia lửa", detected_by="LLM")], text
    )
    assert lowered.risk_level == RiskLevel.EMERGENCY

    calm = "Đèn hành lang không sáng"
    raised = merge_llm(
        assess(calm),
        [RiskSignal(signal_id="S-04", status="PRESENT", source_quote="không sáng", detected_by="LLM")],
        calm,
    )
    assert raised.risk_level == RiskLevel.EMERGENCY
    invented = merge_llm(
        assess(calm),
        [RiskSignal(signal_id="S-04", status="PRESENT", source_quote="khói bốc lên", detected_by="LLM")],
        calm,
    )
    assert invented.risk_level == RiskLevel.UNCLEAR  # a PRESENT without a verbatim quote only reaches tier 2


def test_amplifiers_are_tier_3_only():
    result = assess("Rác ở lối thoát hiểm, trẻ em hay chơi ở đây")
    assert result.risk_level == RiskLevel.NONE
    assert set(result.amplifiers) == {"exit_route_location", "vulnerable_person"}
