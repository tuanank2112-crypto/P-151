"""Deterministic state/reason resolver (Data Contract v1.1 §8.1).

`resolve` is a pure function of `CaseFacts`, so the same facts always give the same state, rule and reason.
Priority: raw required fields → exception → CHỜ XÁC MINH blockers → IN_PROGRESS blockers → READY_FOR_REVIEW.
"""

from dataclasses import dataclass, field

from src.maintenance.enums import (
    AssetLookupStatus,
    DutyLookupStatus,
    MaterialStockStatus,
    QueueReason,
    RouteStatus,
    TicketState,
)
from src.maintenance.models import StateDecision


@dataclass
class CaseFacts:
    missing_raw_fields: list[str] = field(default_factory=list)
    classification_rule: str | None = None  # PB-COM-R-CLS-01 when no unique playbook
    playbook_present: bool = False
    exception_rule: str | None = None  # open blocking exception
    risk_unclear_rule: str | None = None
    confirmation_pending: bool = False
    location_missing: bool = False
    draft_present: bool = False
    asset_status: AssetLookupStatus | None = None
    stock_status: MaterialStockStatus | None = None
    duty_status: DutyLookupStatus | None = None
    route_status: RouteStatus | None = None
    routed: bool = False
    checklist_pending: list[str] = field(default_factory=list)
    evidence_missing: list[str] = field(default_factory=list)  # known requirement, missing/invalid/unreadable
    evidence_unverified: list[str] = field(default_factory=list)  # source/requirement needs a human
    material_incomplete: list[str] = field(default_factory=list)  # qty not entered yet
    material_variance_unexplained: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class Blocker:
    state: TicketState
    rule_id: str
    reason: str
    queue_reason: QueueReason | None = None


def route_blockers(facts: CaseFacts) -> list[Blocker]:
    """Why the draft cannot be routed. Order follows the contract: CHỜ XÁC MINH causes before IN_PROGRESS causes."""
    cho, in_progress = TicketState.CHO_XAC_MINH, TicketState.IN_PROGRESS
    blockers: list[Blocker] = []
    if facts.asset_status == AssetLookupStatus.NOT_FOUND:
        blockers.append(
            Blocker(cho, "PB-COM-R-AST-01", "Không tìm thấy asset LIGHTING tại vị trí", QueueReason.ASSET_NOT_FOUND)
        )
    if facts.asset_status == AssetLookupStatus.AMBIGUOUS:
        blockers.append(
            Blocker(cho, "PB-COM-R-AST-01", "Nhiều asset LIGHTING khớp vị trí; không đoán", QueueReason.ASSET_AMBIGUOUS)
        )
    if facts.duty_status == DutyLookupStatus.DUTY_UNKNOWN:
        blockers.append(Blocker(cho, "PB-COM-R-DTY-03", "Dữ liệu trực không xác định", QueueReason.DUTY_UNKNOWN))
    if facts.stock_status == MaterialStockStatus.UNKNOWN:
        blockers.append(
            Blocker(cho, "PB-COM-R-STK-02", "Tồn kho mô phỏng không xác định", QueueReason.MATERIAL_STOCK_UNKNOWN)
        )
    if facts.duty_status == DutyLookupStatus.NO_AVAILABLE_TEAM:
        blockers.append(
            Blocker(in_progress, "PB-COM-R-DTY-01", "Không có team phù hợp đang trực", QueueReason.NO_AVAILABLE_TEAM)
        )
    if facts.duty_status == DutyLookupStatus.CAPACITY_EXCEEDED:
        blockers.append(
            Blocker(
                in_progress,
                "PB-COM-R-DTY-02",
                "Team đang trực đã đủ tải mô phỏng",
                QueueReason.TEAM_CAPACITY_EXCEEDED,
            )
        )
    if facts.stock_status == MaterialStockStatus.INSUFFICIENT:
        blockers.append(
            Blocker(
                in_progress,
                "PB-COM-R-STK-01",
                "Tồn kho mô phỏng không đủ vật tư dự kiến",
                QueueReason.MATERIAL_SHORTAGE,
            )
        )
    return blockers


def _blockers(facts: CaseFacts) -> list[Blocker]:
    cho, in_progress = TicketState.CHO_XAC_MINH, TicketState.IN_PROGRESS

    # 2. Raw required fields: nothing else can be evaluated
    if facts.missing_raw_fields:
        return [Blocker(cho, "PB-COM-R-ING-01", f"Thiếu field bắt buộc: {', '.join(facts.missing_raw_fields)}")]
    if facts.classification_rule:
        return [Blocker(cho, facts.classification_rule, "Không khớp duy nhất một playbook v1.1")]
    if not facts.playbook_present:
        return [Blocker(in_progress, "FR-INGEST-001", "Raw hợp lệ; chờ Agent đề xuất playbook")]

    # 3. Exception stops the standard flow
    if facts.exception_rule:
        return [
            Blocker(TicketState.EXCEPTION, facts.exception_rule, "Phát hiện tín hiệu rủi ro đã định nghĩa; chuyển BQL")
        ]

    # 4. Pre-draft CHỜ XÁC MINH causes (no draft can exist yet)
    pre_draft: list[Blocker] = []
    if facts.risk_unclear_rule:
        pre_draft.append(Blocker(cho, facts.risk_unclear_rule, "Tín hiệu rủi ro chưa rõ; cần xác minh nguồn"))
    if facts.confirmation_pending:
        pre_draft.append(Blocker(cho, "PB-COM-R-CFM-01", "Đề xuất service/type chưa được BPTN xác nhận"))
    if facts.location_missing:
        pre_draft.append(Blocker(cho, "PB-COM-R-LOC-01", "Thiếu location_normalized"))
    if pre_draft:
        return pre_draft

    blockers = route_blockers(facts)
    if facts.material_variance_unexplained:
        blockers.append(
            Blocker(
                cho,
                "PB-COM-R-MAT-02",
                f"Chênh lệch vật tư thiếu lý do: {', '.join(facts.material_variance_unexplained)}",
            )
        )
    if facts.evidence_unverified:
        blockers.append(
            Blocker(cho, "PB-COM-R-EVD-02", f"Evidence cần xác minh nguồn: {', '.join(facts.evidence_unverified)}")
        )

    # 5. Known-incomplete execution keeps IN_PROGRESS
    if facts.checklist_pending:
        blockers.append(
            Blocker(in_progress, "PB-COM-R-CHK-01", f"Checklist còn PENDING: {', '.join(facts.checklist_pending)}")
        )
    if facts.evidence_missing:
        blockers.append(
            Blocker(in_progress, "PB-COM-R-EVD-01", f"Thiếu evidence tối thiểu: {', '.join(facts.evidence_missing)}")
        )
    if facts.material_incomplete:
        blockers.append(
            Blocker(
                in_progress, "PB-COM-R-MAT-01", f"Vật tư chưa nhập đủ số lượng: {', '.join(facts.material_incomplete)}"
            )
        )
    if not facts.draft_present or not facts.routed:
        blockers.append(Blocker(in_progress, "PB-COM-R-ROUTE-02", "Route chưa hợp lệ; không READY"))

    rank = {TicketState.CHO_XAC_MINH: 0, TicketState.IN_PROGRESS: 1}
    return sorted(blockers, key=lambda b: rank[b.state])  # stable: keeps contract order inside each group


def resolve(facts: CaseFacts) -> StateDecision:
    blockers = _blockers(facts)
    if not blockers:
        return StateDecision(
            state=TicketState.READY_FOR_REVIEW,
            rule_id="PB-COM-R-READY-01",
            reason="Đủ tám gate, route hợp lệ; sẵn sàng để BQL xem xét (không phải nghiệm thu)",
        )
    primary = blockers[0]
    queue_reason = next((b.queue_reason for b in blockers if b.queue_reason), None)
    return StateDecision(
        state=primary.state,
        rule_id=primary.rule_id,
        reason=primary.reason,
        queue_reason=queue_reason,
        blocking_rules=[b.rule_id for b in blockers],
    )
