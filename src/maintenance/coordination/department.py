"""Wrong department returns and reports (SPEC-P06): T15 count and E03, T16, T17, E02 and the carry-over of quantities."""

from datetime import datetime
from typing import Literal

from src.maintenance.common import _blank, _suffix
from src.maintenance.enums import (
    Action,
    ActorRole,
    BlockerOwner,
    ChecklistStatus,
    ReasonCode,
    TicketStatus,
)
from src.maintenance.errors import GuardError, InvalidTransitionError
from src.maintenance.models import Case, ExecutionSnapshot, MaterialLine


class DepartmentMixin:
    def _t15_return_wrong_department(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        """T15: the department hands a ROUTED ticket back; every return is counted, the Nth one escalates (E03)."""
        if _blank(note):
            raise GuardError("Trả lại sai phòng ban phải có lý do")
        # resume_step is decided by BPTN's answer: 6 if the category changes, 7 if not (never 8)
        wrong = self._new_blocker(work, ReasonCode.WRONG_DEPT, now, resume_step=6, note=note)
        count = work.ticket.wrong_department_return_count + 1
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
            wrong_department_return_count=count,
        )
        if count >= self.catalog.sla_config.wrong_dept_return.escalate_at_count:  # E03: no status change
            work.ticket.blocker.escalated = True
            self._notify(
                work,
                "escalation",
                BlockerOwner.BQL,
                now,
                {"reason_code": ReasonCode.WRONG_DEPT, "wrong_department_return_count": count},
            )

    def _t16_report_wrong_department(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        """T16: the department that already accepted says the ticket is not theirs; BQL decides. Data is kept."""
        if _blank(note):
            raise GuardError("Báo sai phòng ban sau khi nhận việc phải có lý do")
        ticket = work.ticket
        old = ticket.blocker
        blocker = self._new_blocker(work, ReasonCode.WRONG_DEPT_AFTER_START, now, resume_step=6, note=note)
        self._audit(
            work,
            Action.REPORT_WRONG_DEPT,
            "Ticket",
            ticket.ticket_id,
            actor_id,
            role,
            "blocker.code",
            old.code if old else None,
            ReasonCode.WRONG_DEPT_AFTER_START,
            note.strip(),
            now=now,
        )
        self._apply_transition(work, TicketStatus.VERIFYING, actor_id, role, now, blocker=blocker, note=note)
        self._notify(
            work,
            "escalation",
            BlockerOwner.BQL,
            now,
            {"reason_code": ReasonCode.WRONG_DEPT_AFTER_START, "department_id": work.ticket.department_id},
        )

    def _t17_keep_department(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        """T17: BQL keeps the department; it carries on with its data untouched."""
        ticket = work.ticket
        if ticket.blocker is None or ticket.blocker.code != ReasonCode.WRONG_DEPT_AFTER_START:
            raise InvalidTransitionError("BQL giữ phòng ban chỉ khi phòng ban báo sai sau khi nhận (T17)")
        if _blank(note):
            raise GuardError("BQL giữ phòng ban phải có lý do")
        self._audit(
            work,
            Action.BQL_KEEP_DEPARTMENT,
            "Ticket",
            ticket.ticket_id,
            actor_id,
            role,
            "blocker.code",
            ReasonCode.WRONG_DEPT_AFTER_START,
            None,
            note.strip(),
            now=now,
        )
        self._apply_transition(work, TicketStatus.IN_PROGRESS, actor_id, role, now, note=note)

    def _take_execution_snapshot(self, work: Case, actor_id: str, now: datetime) -> ExecutionSnapshot:
        """Deep copy of the execution data, taken BEFORE E02 resets the checklist (SPEC-P06 §5)."""
        ticket = work.ticket
        return ExecutionSnapshot(
            snapshot_id=f"SIM-SNP-{_suffix(ticket.ticket_id)}-{len(work.execution_snapshots) + 1:02d}",
            ticket_id=ticket.ticket_id,
            reason="BQL_REASSIGN_TO_BPTN",
            taken_at=now,
            taken_by=actor_id,
            department_id=ticket.department_id,
            work_order_draft_id=work.draft.work_order_draft_id if work.draft else None,
            playbook_id=work.draft.playbook_id if work.draft else None,
            checklist_items=[item.model_copy(deep=True) for item in work.checklist_items],
            material_lines=[line.model_copy(deep=True) for line in work.material_lines],
            evidence_ids=[record.evidence_id for record in work.evidence],
        )

    def _carry_over_material_qty(self, old_lines: list[MaterialLine], new_lines: list[MaterialLine]) -> None:
        """Rebuilt lines keep `issued_qty`, `used_qty` and `variance_reason` of the old line with the same item code."""
        old_by_code = {line.item_code: line for line in old_lines}
        for line in new_lines:
            old = old_by_code.get(line.item_code)
            if old is None or (old.issued_qty is None and old.used_qty is None):
                continue
            line.issued_qty = old.issued_qty
            line.used_qty = old.used_qty
            line.variance_reason = old.variance_reason

    def report_wrong_department(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        return self.transition(
            ticket_id, TicketStatus.VERIFYING, actor_id, note=note, expected_from=TicketStatus.IN_PROGRESS
        )

    def bql_wrong_department(
        self, ticket_id: str, actor_id: str, *, decision: Literal["KEEP", "TO_BPTN"], note: str
    ) -> Case:
        """BQL decides a WRONG_DEPT_AFTER_START ticket: KEEP (T17) or TO_BPTN (E02)."""
        if decision not in ("KEEP", "TO_BPTN"):  # before anything else, like set_priority
            raise GuardError(f"decision không hợp lệ: {decision!r}")
        if decision == "KEEP":
            return self.transition(
                ticket_id, TicketStatus.IN_PROGRESS, actor_id, note=note, expected_from=TicketStatus.VERIFYING
            )

        def op(work: Case, now: datetime) -> None:
            ticket = work.ticket
            blocker = ticket.blocker
            if (
                ticket.status != TicketStatus.VERIFYING
                or blocker is None
                or blocker.code != ReasonCode.WRONG_DEPT_AFTER_START
            ):
                raise InvalidTransitionError("BQL chuyển về BPTN chỉ khi phòng ban báo sai sau khi nhận (E02)")
            if _blank(note):
                raise GuardError("BQL chuyển về BPTN phải có lý do")
            work.execution_snapshots.append(self._take_execution_snapshot(work, actor_id, now))  # before the reset
            for item in work.checklist_items:
                item.status = ChecklistStatus.PENDING
                item.updated_by = None
                item.updated_at = None
                item.note = None
            work.evidence_round_start = len(work.evidence)
            wrong = self._new_blocker(work, ReasonCode.WRONG_DEPT, now, resume_step=6, note=note)
            self._audit(
                work,
                Action.BQL_REASSIGN_TO_BPTN,
                "Ticket",
                ticket.ticket_id,
                actor_id,
                ActorRole.BQL,
                "blocker.code",
                ReasonCode.WRONG_DEPT_AFTER_START,
                ReasonCode.WRONG_DEPT,
                note.strip(),
                now=now,
            )
            self._set_blocker(
                work,
                wrong,
                actor_id,
                ActorRole.BQL,
                now,
                note=note,
                department_id=None,
                dispatched_at=None,
                accepted_at=None,
            )

        return self._mutate(
            ticket_id,
            actor_id,
            Action.BQL_REASSIGN_TO_BPTN,
            op,
            field_name="decision",
            new_value=decision,
            reason=note,
        )
