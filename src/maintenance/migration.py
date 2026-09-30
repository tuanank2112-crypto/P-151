"""v0.4 → v0.5 status mapping (CR-BPTN-02 §2.7).

The prototype keeps tickets in memory and reloads the fixture on start, so there is no stored v0.4 data to rewrite.
`plan_v04_migration` is the mapping a persistent store would apply: it reads one v0.4 case as returned by the v0.4
`GET /mo/tickets/{id}` and says which v0.5 status, reason code and department it becomes. Times such as
`next_retry_at` are not carried over: the engine recomputes them from the v0.5 SLA config when the blocker is created.
"""

from dataclasses import dataclass
from typing import Any

from src.maintenance.catalog import Catalog
from src.maintenance.enums import BlockerOwner, Department, PlaybookId, ReasonCode, TicketStatus

# v0.4 CHỜ XÁC MINH rule → v0.5 reason code (anything else: PENDING_REVIEW, left to BPTN)
_MISSING_INFO_RULES = {"PB-COM-R-ING-01", "PB-COM-R-LOC-01"}
_VERIFYING_RULES = {
    "PB-COM-R-CLS-01": ReasonCode.CATEGORY_UNCLEAR,
    "PB-COM-R-AST-01": ReasonCode.ASSET_UNCLEAR,
}


@dataclass(frozen=True)
class MigrationPlan:
    status: TicketStatus
    reason_code: ReasonCode | None
    proposed_department_id: Department | None
    department_id: Department | None  # only when v0.4 had really routed to a team: v0.5 step 8 already happened
    internal_note: str
    owner_role: BlockerOwner | None = None  # only when it differs from the reason code's usual owner
    recompute_schedule: bool = False  # next_retry_at / escalate_at must be computed again from sla_config


def _get(data: dict[str, Any] | None, *path: str) -> Any:
    for key in path:
        if not isinstance(data, dict):
            return None
        data = data.get(key)
    return data


def _execution_started(case: dict[str, Any]) -> bool:
    checklist = any(item.get("status") == "COMPLETED" for item in case.get("checklist_items") or [])
    materials = any(
        line.get("issued_qty") is not None or line.get("used_qty") is not None
        for line in case.get("material_lines") or []
    )
    return checklist or materials or bool(case.get("evidence"))


def plan_v04_migration(case: dict[str, Any], catalog: Catalog) -> MigrationPlan:
    state = _get(case, "ticket", "current_state")
    rule_id = _get(case, "ticket", "state_decision", "rule_id")
    queue_reason = _get(case, "draft", "queue_reason") or _get(case, "ticket", "state_decision", "queue_reason")
    routed = _get(case, "draft", "route_status") == "ROUTED"
    playbook = _get(case, "proposal", "playbook_id")
    department = catalog.department_for(PlaybookId(playbook)) if playbook else None
    note = f"migrated from v0.4 {state} ({rule_id})"

    def plan(status, reason=None, **kw) -> MigrationPlan:
        handed_over = status in (TicketStatus.ROUTED, TicketStatus.IN_PROGRESS, TicketStatus.READY_FOR_REVIEW)
        return MigrationPlan(
            status, reason, department, department if handed_over else None, kw.pop("internal_note", note), **kw
        )

    if state == "EXCEPTION":
        # No safety state in v0.5: BQL looks at every former exception by hand
        return plan(
            TicketStatus.VERIFYING,
            ReasonCode.PENDING_REVIEW,
            internal_note="migrated from EXCEPTION",
            owner_role=BlockerOwner.BQL,
            recompute_schedule=True,
        )
    if state == "READY_FOR_REVIEW":
        return plan(TicketStatus.READY_FOR_REVIEW)
    if state == "CHỜ XÁC MINH":
        review_reason = _get(case, "ticket", "administrative_normalization", "review_required_reason")
        if rule_id in _MISSING_INFO_RULES or review_reason == "LOCATION_MISSING":
            return plan(TicketStatus.NEED_INFO, ReasonCode.MISSING_INFO, recompute_schedule=True)
        reason = _VERIFYING_RULES.get(rule_id)
        if reason is None and review_reason == "CATEGORY_UNCLEAR":
            reason = ReasonCode.CATEGORY_UNCLEAR
        return plan(TicketStatus.VERIFYING, reason or ReasonCode.PENDING_REVIEW, recompute_schedule=True)
    if state == "IN_PROGRESS":
        if queue_reason == "MATERIAL_SHORTAGE":
            return plan(TicketStatus.ON_HOLD, ReasonCode.WAITING_MATERIAL, recompute_schedule=True)
        if queue_reason in ("NO_AVAILABLE_TEAM", "TEAM_CAPACITY_EXCEEDED"):
            return plan(TicketStatus.ROUTED, ReasonCode.OUT_OF_HOURS, recompute_schedule=True)
        if routed:
            return plan(TicketStatus.IN_PROGRESS if _execution_started(case) else TicketStatus.ROUTED)
        return plan(TicketStatus.RECEIVED)  # the Agent had not produced a draft yet: run the pipeline again
    raise ValueError(f"Trạng thái v0.4 không xác định: {state!r}")
