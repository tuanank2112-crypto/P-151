"""LLM proposal guards, tested with a fake model (no network)."""

from datetime import datetime, timedelta, timezone

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.proposer import LLMAssessment, propose


def assessment(service="KY_THUAT", ticket_type="COMMON_AREA_LIGHTING") -> LLMAssessment:
    return LLMAssessment(service_category=service, ticket_type=ticket_type, reason="Lý do giả lập")


def fake(result):
    calls = []

    def llm(description):
        calls.append(description)
        if isinstance(result, Exception):
            raise result
        return result

    llm.calls = calls
    return llm


def test_llm_classifies_what_the_rules_miss():
    text = "Hành lang tầng 3 tòa S1 tối om, không thấy đường"
    assert propose(text).classification.playbook_id is None  # rules alone cannot tell
    result = propose(text, fake(assessment()), "gpt-test")
    assert result.classification.playbook_id == "PB-TEC-01"
    assert result.classification.rule_id == "PB-TEC-R-TRG-01"
    assert result.proposer == "rules+llm:gpt-test" and result.needs_review


def test_rules_and_llm_disagreeing_is_ambiguous():
    text = "Hành lang tầng 3 nhiều rác, cần vệ sinh"
    result = propose(text, fake(assessment()))  # LLM says lighting, rules say cleaning
    assert result.classification.playbook_id is None
    assert result.classification.reason_code == "CATEGORY_UNCLEAR"


def test_llm_abstaining_on_a_rules_match_is_ambiguous():
    """Mixed report: the LLM saw both and returned UNKNOWN. Since plan 04 the rules see both parts too."""
    text = "Hành lang đầy rác và đèn cũng hỏng luôn"
    assert propose(text).classification.reason_code == "CATEGORY_UNCLEAR"
    result = propose(text, fake(assessment(service="UNKNOWN", ticket_type="UNKNOWN")))
    assert result.classification.playbook_id is None
    assert result.classification.rule_id == "PB-COM-R-CLS-01"


def test_invalid_pair_from_llm_is_not_a_playbook():
    text = "Hành lang tối om, bóng tuýp chết rồi"
    result = propose(text, fake(assessment(service="VE_SINH", ticket_type="COMMON_AREA_LIGHTING")))
    assert result.classification.playbook_id is None
    assert any("không hợp lệ" in n for n in result.notes)


def test_llm_error_falls_back_to_rules():
    text = "Đèn hành lang tầng 3 tòa S1 không sáng"
    result = propose(text, fake(TimeoutError("quota")))
    assert result.classification.playbook_id == "PB-TEC-01"
    assert result.proposer == "rules" and "TimeoutError" in result.notes[0]


def test_engine_calls_llm_once_and_traces_the_proposer():
    llm = fake(assessment())
    engine = MaintenanceEngine(llm=llm, llm_label="gpt-test")
    engine.reset(with_fixtures=False)
    monday = datetime(2026, 9, 28, 9, tzinfo=timezone(timedelta(hours=7)))
    case = engine.receive("Hành lang tầng 3 tòa S1 tối om, không thấy đường", received_at=monday)
    assert len(llm.calls) == 1
    assert case.classification.proposer == "rules+llm:gpt-test" and case.classification.needs_review
    assert case.ticket.status == "VERIFYING" and case.ticket.blocker.code == "PENDING_REVIEW"
    engine.bptn_resolve(case.ticket.ticket_id, "SIM-ACTOR-BPTN-01")
    assert len(llm.calls) == 1  # resuming after review does not ask the model again
    proposal_event = next(a for a in engine.get(case.ticket.ticket_id).audit if a.action == "CREATE_PROPOSAL")
    assert proposal_event.new_value["proposer"] == "rules+llm:gpt-test"


def test_enum_conversion_failure_falls_back_to_rules():
    bad = LLMAssessment.model_construct(service_category="HACK", ticket_type="UNKNOWN", reason="x")
    result = propose("Hành lang tầng 3 nhiều rác, cần vệ sinh", fake(bad), "gpt-test")
    assert result.proposer == "rules"
    assert result.classification.playbook_id == "PB-CLN-01"
    assert result.notes and "LLM lỗi (ValueError)" in result.notes[0]


def test_llm_reason_is_capped():
    long_reason = "a" * 20000
    llm_says = LLMAssessment.model_construct(
        service_category="KY_THUAT", ticket_type="COMMON_AREA_LIGHTING", reason=long_reason
    )
    result = propose("Hành lang tầng 3 tối om, không thấy đường", fake(llm_says), "gpt-test")
    assert result.classification.playbook_id == "PB-TEC-01"
    assert len(result.classification.reason) <= len("Đề xuất từ LLM: ") + 500
