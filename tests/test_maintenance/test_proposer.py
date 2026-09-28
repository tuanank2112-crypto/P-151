"""LLM proposal guards, tested with a fake model (no network)."""

from src.maintenance.engine import MaintenanceEngine
from src.maintenance.models import RawTicket
from src.maintenance.proposer import LLMAssessment, SignalJudgement, propose

ABSENT = SignalJudgement(status="ABSENT")


def assessment(service="KY_THUAT", ticket_type="COMMON_AREA_LIGHTING", **signals) -> LLMAssessment:
    fields = ("unknown_substance", "hazard_signal", "burning_smell", "spark", "exposed_wire")
    return LLMAssessment(
        service_category=service,
        ticket_type=ticket_type,
        reason="Lý do giả lập",
        **{f: signals.get(f, ABSENT) for f in fields},
    )


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
    text = "Hành lang tầng 3 tòa SIM-A tối om, bóng tuýp chết rồi"
    assert propose(text).classification.playbook_id is None  # rules alone cannot tell
    result = propose(text, fake(assessment()), "gpt-test")
    assert result.classification.playbook_id == "PB-TEC-01"
    assert result.classification.rule_id == "PB-TEC-R-TRG-01"
    assert result.proposer == "rules+llm:gpt-test"


def test_rules_and_llm_disagreeing_is_ambiguous():
    text = "Hành lang tầng 3 nhiều rác, cần vệ sinh"
    result = propose(text, fake(assessment()))  # LLM says lighting, rules say cleaning
    assert result.classification.playbook_id is None
    assert result.classification.rule_id == "PB-COM-R-CLS-01"


def test_llm_abstaining_on_a_rules_match_is_ambiguous():
    """Mixed report: rules only caught the cleaning part, the LLM saw both and returned UNKNOWN."""
    text = "Hành lang đầy rác và đèn cũng hỏng luôn"
    assert propose(text).classification.playbook_id == "PB-CLN-01"
    result = propose(text, fake(assessment(service="UNKNOWN", ticket_type="UNKNOWN")))
    assert result.classification.playbook_id is None
    assert result.classification.rule_id == "PB-COM-R-CLS-01"


def test_invalid_pair_from_llm_is_not_a_playbook():
    text = "Hành lang tối om, bóng tuýp chết rồi"
    result = propose(text, fake(assessment(service="VE_SINH", ticket_type="COMMON_AREA_LIGHTING")))
    assert result.classification.playbook_id is None
    assert any("không hợp lệ" in n for n in result.notes)


def test_llm_cannot_remove_a_risk_signal_found_by_rules():
    text = "Đèn hành lang tầng 3 không sáng, có tia lửa ở hộp đèn"
    result = propose(text, fake(assessment(spark=ABSENT)))
    assert result.signals["SPARK_PRESENT"] == "PRESENT"


def test_llm_present_needs_a_real_quote():
    text = "Đèn hành lang tầng 3 không sáng, ngửi thấy mùi cháy nhẹ"
    grounded = propose(text, fake(assessment(burning_smell=SignalJudgement(status="PRESENT", quote="mùi cháy nhẹ"))))
    assert grounded.signals["BURNING_SMELL_PRESENT"] == "PRESENT"

    invented = propose(text, fake(assessment(spark=SignalJudgement(status="PRESENT", quote="tóe lửa liên tục"))))
    assert invented.signals["SPARK_PRESENT"] == "UNCLEAR"
    assert any("SPARK_PRESENT" in n for n in invented.notes)


def test_llm_error_falls_back_to_rules():
    text = "Đèn hành lang tầng 3 tòa SIM-A không sáng"
    result = propose(text, fake(TimeoutError("quota")))
    assert result.classification.playbook_id == "PB-TEC-01"
    assert result.proposer == "rules" and "TimeoutError" in result.notes[0]


def test_engine_calls_llm_once_and_traces_the_proposer():
    llm = fake(assessment(burning_smell=SignalJudgement(status="PRESENT", quote="mùi cháy")))
    engine = MaintenanceEngine(llm=llm, llm_label="gpt-test")
    engine.reset(with_fixtures=False)
    raw = RawTicket(
        ticket_id="SIM-TKT-TEC-301",
        created_at="2026-09-27T10:00:00+07:00",
        original_description="Bóng tuýp hành lang tầng 3 tòa SIM-A chết rồi, có mùi cháy",
    )
    engine.ingest(raw)
    case = engine.run_agent(raw.ticket_id)
    case = engine.run_agent(raw.ticket_id)
    assert len(llm.calls) == 1
    assert case.proposer == "rules+llm:gpt-test"
    assert case.ticket.current_state == "EXCEPTION"
    assert case.exceptions[0].exception_type == "ELECTRICAL_HIGH_RISK"
    proposal_event = next(a for a in case.audit if a.action == "CREATE_PROPOSAL")
    assert proposal_event.new_value["proposer"] == "rules+llm:gpt-test"
