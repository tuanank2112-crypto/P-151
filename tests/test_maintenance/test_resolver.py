"""Resolver oracle (Data Contract §8.1) tested without the engine."""

from src.maintenance.enums import AssetLookupStatus, DutyLookupStatus, MaterialStockStatus, RouteStatus
from src.maintenance.resolver import CaseFacts, resolve


def routed_facts(**overrides) -> CaseFacts:
    base = dict(
        playbook_present=True,
        draft_present=True,
        asset_status=AssetLookupStatus.MATCHED,
        stock_status=MaterialStockStatus.SUFFICIENT,
        duty_status=DutyLookupStatus.AVAILABLE,
        route_status=RouteStatus.ROUTED,
        routed=True,
    )
    return CaseFacts(**{**base, **overrides})


def test_all_gates_pass_is_ready():
    decision = resolve(routed_facts())
    assert decision.state == "READY_FOR_REVIEW" and decision.rule_id == "PB-COM-R-READY-01"


def test_tc_state_002_invalid_route_never_ready():
    decision = resolve(routed_facts(routed=False, route_status=RouteStatus.NOT_ROUTED))
    assert decision.state == "IN_PROGRESS" and decision.rule_id == "PB-COM-R-ROUTE-02"


def test_raw_missing_beats_everything():
    decision = resolve(routed_facts(missing_raw_fields=["created_at"], exception_rule="PB-TEC-R-EX-01"))
    assert decision.state == "CHỜ XÁC MINH" and decision.rule_id == "PB-COM-R-ING-01"


def test_exception_beats_verification_and_progress():
    decision = resolve(routed_facts(exception_rule="PB-TEC-R-EX-01", confirmation_pending=True))
    assert decision.state == "EXCEPTION"


def test_verification_beats_in_progress():
    decision = resolve(
        routed_facts(duty_status=DutyLookupStatus.CAPACITY_EXCEEDED, stock_status=MaterialStockStatus.UNKNOWN)
    )
    assert decision.state == "CHỜ XÁC MINH" and decision.rule_id == "PB-COM-R-STK-02"
    assert decision.blocking_rules == ["PB-COM-R-STK-02", "PB-COM-R-DTY-02"]
    assert decision.queue_reason == "MATERIAL_STOCK_UNKNOWN"


def test_known_incomplete_execution_stays_in_progress():
    decision = resolve(routed_facts(checklist_pending=["TEC-CHK-02"], evidence_missing=["TEC-EVD-RESULT-NOTE"]))
    assert decision.state == "IN_PROGRESS" and decision.rule_id == "PB-COM-R-CHK-01"


def test_same_facts_same_decision():
    facts = routed_facts(duty_status=DutyLookupStatus.NO_AVAILABLE_TEAM)
    assert resolve(facts) == resolve(facts)
