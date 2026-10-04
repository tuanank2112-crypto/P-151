"""Plan 04 (logic review 2026-10-04): P1 priority homographs; round 3 B-01 clause rule (SPEC-P01 R6)."""

import pytest

from src.maintenance.catalog import load_lexicon
from src.maintenance.enums import Priority, RiskLevel, ServiceCategory
from src.maintenance.priority import propose_priority
from src.maintenance.safety import assess

LEX = load_lexicon().priority
SAFETY = load_lexicon().safety
WHERE = "Tòa SIM-A / Tầng 3 / Hành lang"


@pytest.mark.parametrize(
    "text,forbidden",
    [
        ("vết bẩn hình tròn trên tường hành lang tầng 3", "PRI-H2"),  # "tròn" (round) is not "trơn" (slippery)
        ("Cho em hỏi hành lang tầng 3 có ít bụi", "PRI-M2"),  # "hỏi" (ask) is not "hôi" (smelly)
    ],
)
def test_homograph_does_not_raise_priority(text, forbidden):
    assert propose_priority(ServiceCategory.VE_SINH, WHERE, text, LEX).rule_id != forbidden


@pytest.mark.parametrize(
    "text,priority,rule",
    [
        ("Sàn hành lang rất trơn", Priority.HIGH, "PRI-H2"),
        ("Sảnh bị trơn, cần lau", Priority.HIGH, "PRI-H2"),
        ("Hành lang hôi quá, cần vệ sinh", Priority.MEDIUM, "PRI-M2"),
        ("Hành lang có mùi hôi", Priority.MEDIUM, "PRI-M2"),
    ],
)
def test_real_slippery_and_smelly_wording_keeps_its_rule(text, priority, rule):
    proposal = propose_priority(ServiceCategory.VE_SINH, WHERE, text, LEX)
    assert (proposal.priority, proposal.rule_id) == (priority, rule)


@pytest.mark.parametrize(
    "text",
    ["Thang máy cháy, đèn tắt hết", "Căn hộ 1205 cháy, đèn tắt hết rồi", "Chỗ thang máy cháy, đèn tắt hết"],
)
def test_b01_lamp_noun_in_another_clause_is_not_benign(text):
    """Plan 04 round 3, SPEC-P01 R6: "cháy, đèn ..." is two clauses, so the lamp noun after the comma proves nothing."""
    result = assess(text, SAFETY)
    assert result.risk_level != RiskLevel.NONE
    assert not any(s.rule_id == "B-01" for s in result.signals)


@pytest.mark.parametrize(
    "text",
    [
        "Bóng đèn hành lang gần căn 1205 bị cháy",
        "Bóng đèn cầu thang tầng 9 bị cháy, nhờ thay",
        "Cháy bóng đèn hành lang",
    ],
)
def test_b01_same_clause_stays_benign(text):
    result = assess(text, SAFETY)
    assert result.risk_level == RiskLevel.NONE
    assert any(s.rule_id == "B-01" for s in result.signals)
