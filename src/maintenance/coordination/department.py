"""Wrong department returns and reports (SPEC-P06). WP5: frame and stubs; WP9 fills the bodies."""

from datetime import datetime
from typing import Literal

from src.maintenance.common import _blank
from src.maintenance.enums import ActorRole, ReasonCode, TicketStatus
from src.maintenance.errors import GuardError
from src.maintenance.models import Case, MaterialLine


class DepartmentMixin:
    def _t15_return_wrong_department(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        """T15: the department hands a ROUTED ticket back (the body moved here unchanged from `_human_transition`)."""
        if _blank(note):
            raise GuardError("Trả lại sai phòng ban phải có lý do")
        # resume_step is decided by BPTN's answer: 6 if the category changes, 7 if not (never 8)
        wrong = self._new_blocker(work, ReasonCode.WRONG_DEPT, now, resume_step=6, note=note)
        self._apply_transition(
            work,
            TicketStatus.VERIFYING,
            actor_id,
            role,
            now,
            blocker=wrong,
            note=note,
            department_id=None,
            dispatched_at=None,
        )

    def _t16_report_wrong_department(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        raise NotImplementedError("plan 06 WP9: _t16_report_wrong_department")

    def _t17_keep_department(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        raise NotImplementedError("plan 06 WP9: _t17_keep_department")

    def _carry_over_material_qty(self, old_lines: list[MaterialLine], new_lines: list[MaterialLine]) -> None:
        return None

    def report_wrong_department(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        return self.transition(
            ticket_id, TicketStatus.VERIFYING, actor_id, note=note, expected_from=TicketStatus.IN_PROGRESS
        )

    def bql_wrong_department(
        self, ticket_id: str, actor_id: str, *, decision: Literal["KEEP", "TO_BPTN"], note: str
    ) -> Case:
        raise NotImplementedError("plan 06 WP9: bql_wrong_department")
