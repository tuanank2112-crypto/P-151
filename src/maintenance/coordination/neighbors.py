"""Ordinary tickets next to an open emergency, and the follow-up ticket (SPEC-P07).

P1-E: an emergency and the tickets at the same place link both ways, always. An ordinary ticket reaching step 8 next to
an open emergency waits (`ON_HOLD / WAITING_EMERGENCY`) only when `agent_policy.hold_near_open_emergency` is on (Q18:
off by default). The wait ends on BQL's event (T05, T10, T23, `bql_merge`), never on a timer.
P1-F: BQL opens a follow-up repair ticket from an emergency ticket; the model is asked outside the lock (I-16).
"""

from datetime import datetime

from src.maintenance.common import AGENT_ID, LOCAL_TZ, SYSTEM_ID, _blank, _created_at
from src.maintenance.enums import (
    TERMINAL_STATUSES,
    Action,
    ActorRole,
    ReasonCode,
    RiskLevel,
    TicketStatus,
)
from src.maintenance.errors import GuardError, InvalidTransitionError
from src.maintenance.messages import follow_up_created_message
from src.maintenance.models import Case, RawTicket

PENDING_FOLLOW_UP_ID = "PENDING-FOLLOWUP"  # id of the temporary case the model is asked about (P07 §6)


class NeighborMixin:
    # ------------------------------------------------------------------ P1-E: emergency next to ordinary tickets

    def _open_emergencies_at(self, location: str | None, *, exclude: set[str]) -> list[str]:
        """Open emergency tickets at `location`, oldest first. No time window: an open emergency is open."""
        if location is None:
            return []
        found: list[tuple[float, str]] = []
        for case in self._cases_snapshot():
            ticket = case.ticket
            blocker = ticket.blocker
            if (
                ticket.ticket_id in exclude
                or ticket.status in TERMINAL_STATUSES
                or blocker is None
                or blocker.code != ReasonCode.EMERGENCY_PENDING_BQL
                or self.effective_location(case) != location
            ):
                continue
            created = _created_at(ticket.raw)
            found.append((created.timestamp() if created else 0.0, ticket.ticket_id))
        return [ticket_id for _, ticket_id in sorted(found)]

    def _link_emergency_both_ways(self, emergency: Case, ticket_ids: list[str], now: datetime) -> None:
        """A ticket became an emergency: every open ticket at its place lists it, and it lists them (link only,
        no status change). The list is worked out here too, so T07 (which never computed it) links as well."""
        for ticket_id in dict.fromkeys([*ticket_ids, *self._related_ticket_ids(emergency)]):
            other = self._related_case(ticket_id)
            if other.ticket.status in TERMINAL_STATUSES:  # I-26: a finished ticket is not written
                continue
            self._link_pair(
                emergency,
                other,
                now,
                AGENT_ID,
                ActorRole.AGENT,
                why=f"Cùng vị trí với khẩn cấp {emergency.ticket.ticket_id}",
            )

    def _hold_for_emergency(self, work: Case, now: datetime) -> bool:
        """Start of step 8: True = the ticket waits for the emergency next to it. The link is written either way."""
        ticket = work.ticket
        exclude = {ticket.ticket_id, ticket.follow_up_of} - {None}  # a follow-up never waits for its own source
        ids = self._open_emergencies_at(self.effective_location(work), exclude=exclude)
        if not ids:
            return False
        for emergency_id in ids:
            self._link_pair(
                work,
                self._related_case(emergency_id),
                now,
                AGENT_ID,
                ActorRole.AGENT,
                why="Khẩn cấp đang mở cùng vị trí",
            )
        if not self.catalog.agent_policy.hold_near_open_emergency:
            return False
        return self._stop(
            work,
            TicketStatus.ON_HOLD,
            ReasonCode.WAITING_EMERGENCY,
            now,
            resume_step=8,
            note=f"Chờ BQL xử lý khẩn cấp {ids[0]} cùng vị trí",
        )

    def _release_waiting_for(self, emergency: Case, now: datetime) -> None:
        """BQL handled `emergency` (downgraded, closed, cancelled, merged): the tickets waiting for it go on from
        step 8, unless another emergency is still open at their place."""
        emergency_id = emergency.ticket.ticket_id
        for ticket_id in list(emergency.ticket.related_ticket_ids):
            view = self._case_view(ticket_id)
            blocker = view.ticket.blocker
            if view.ticket.status != TicketStatus.ON_HOLD or blocker is None:
                continue
            if blocker.code != ReasonCode.WAITING_EMERGENCY:
                continue
            still_open = self._open_emergencies_at(self.effective_location(view), exclude={emergency_id, ticket_id})
            waiting = self._related_case(ticket_id)
            if still_open:
                self._link_pair(
                    waiting,
                    self._related_case(still_open[0]),
                    now,
                    AGENT_ID,
                    ActorRole.AGENT,
                    why="Khẩn cấp đang mở cùng vị trí",
                )
                continue
            self._apply_transition(
                waiting,
                TicketStatus.RECEIVED,
                SYSTEM_ID,
                ActorRole.SYSTEM,
                now,
                note=f"Khẩn cấp {emergency_id} đã được BQL xử lý",
            )
            self._run_pipeline(waiting, 8, now)

    # ------------------------------------------------------------------ P1-F: follow-up repair ticket

    def create_follow_up(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        """BQL opens a repair ticket after an emergency. The model is asked about the new ticket's content first,
        outside the lock, on a temporary case; the new ticket then runs the pipeline in the same transaction."""

        def gate(case: Case) -> bool:
            blocker = case.ticket.blocker
            return (
                self._role(actor_id) == ActorRole.BQL
                and case.ticket.status == TicketStatus.VERIFYING
                and blocker is not None
                and blocker.code == ReasonCode.EMERGENCY_PENDING_BQL
                and not _blank(note)
            )

        record = None
        if self._gate(ticket_id, gate):
            source, moment = self._peek(ticket_id), self.clock()
            if source is not None:
                temp = self._build_follow_up(source, PENDING_FOLLOW_UP_ID, moment, actor_id, note)
                record = self._decide(temp, moment)
        with self._prepared({}, retry_on_stale=False):
            return self._create_follow_up(ticket_id, actor_id, note, record)

    def _create_follow_up(self, ticket_id: str, actor_id: str, note: str, record) -> Case:
        created: list[str] = []

        def op(work: Case, now: datetime) -> None:
            blocker = work.ticket.blocker
            if work.ticket.status != TicketStatus.VERIFYING or blocker is None:
                raise InvalidTransitionError("Chỉ tạo ticket tiếp theo từ ticket khẩn cấp đang chờ BQL")
            if blocker.code != ReasonCode.EMERGENCY_PENDING_BQL:
                raise InvalidTransitionError("Chỉ tạo ticket tiếp theo từ ticket khẩn cấp đang chờ BQL")
            if _blank(note):
                raise GuardError("Tạo ticket tiếp theo bắt buộc ghi chú")
            new_id = f"SIM-TKT-{self.repo.next_ticket_number():04d}"
            new = self._build_follow_up(work, new_id, now, actor_id, note)
            created.append(new_id)
            self._audit(
                work,
                Action.CREATE_FOLLOW_UP,
                "Ticket",
                work.ticket.ticket_id,
                actor_id,
                ActorRole.BQL,
                "follow_up",
                None,
                new_id,
                note.strip(),
                now=now,
            )
            self._audit(
                new,
                Action.CREATE_FOLLOW_UP,
                "Ticket",
                new_id,
                actor_id,
                ActorRole.BQL,
                "follow_up_of",
                None,
                work.ticket.ticket_id,
                note.strip(),
                now=now,
            )
            self._link_pair(work, new, now, actor_id, ActorRole.BQL, why="Ticket sửa chữa tiếp theo")
            if record is not None:
                self._local.prepared[new_id] = record
            self._insert_case(new)
            self._run_pipeline(new, 2, now)  # 2b skips itself (cleared); the source stays as it is (BQL closes it)

        self._mutate(ticket_id, actor_id, Action.CREATE_FOLLOW_UP, op, field_name="follow_up", reason=note)
        return self.get(created[0])

    def _build_follow_up(self, src: Case, new_id: str, now: datetime, actor_id: str, note: str) -> Case:
        """The follow-up case as it is before it runs: same report, the resident's additions and photos copied, the
        safety clearance inherited from BQL. No transaction; the temporary case of the model call is built the same."""
        raw = RawTicket(
            ticket_id=new_id,
            created_at=now.astimezone(LOCAL_TZ).isoformat(timespec="seconds"),
            original_description=src.ticket.raw.original_description,
            original_evidence_refs=src.ticket.raw.original_evidence_refs,
            channel="follow_up",
        )
        new = self._build_case(
            raw,
            None,
            src.ticket.resident_id,
            now,
            public_message=follow_up_created_message(src.ticket.ticket_id),
            notify_extra={"follow_up_of": src.ticket.ticket_id},
            reason=f"Ticket sửa chữa tiếp theo của {src.ticket.ticket_id}",
        )
        self._copy_additions(src, new, now, mode="copy")
        self._copy_resident_photos(src, new, now, mode="copy")
        self._set_ticket(
            new,
            follow_up_of=src.ticket.ticket_id,
            safety_cleared_by=actor_id,
            safety_cleared_at=now,
            safety_clear_reason=note.strip(),
            risk_level=RiskLevel.NONE,
        )
        new.not_duplicate_of.append(src.ticket.ticket_id)
        return new
