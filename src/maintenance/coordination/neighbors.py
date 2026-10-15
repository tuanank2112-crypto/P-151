"""Ordinary tickets next to an open emergency, and the follow-up ticket (SPEC-P07).

P1-E: an emergency and the tickets at the same place link both ways, always. An ordinary ticket reaching step 8 next to
an open emergency waits (`ON_HOLD / WAITING_EMERGENCY`) when `agent_policy.hold_near_open_emergency` is on (Q18: off by
default), and, with the switch off, when a person or the Agent read the emergency as the same kind of work (plan 23
P03; a rule emergency is read by the Agent right after it stops, `read_emergency`).
The wait ends on BQL's event (T05, T10, T23, `bql_merge`), never on a timer.
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
    ServiceCategory,
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
        blocking = self._blocking_emergency(work, ids)
        if blocking is None:
            return False
        return self._stop(
            work,
            TicketStatus.ON_HOLD,
            ReasonCode.WAITING_EMERGENCY,
            now,
            resume_step=8,
            note=f"Chờ BQL xử lý khẩn cấp {blocking} cùng vị trí",
        )

    def _blocking_emergency(self, work: Case, emergency_ids: list[str]) -> str | None:
        """The open emergency (oldest first) `work` must wait for, or None. Switch on: any of them (Q18). Switch off
        (plan 23 P03 §1): one that a person or the Agent read as the same kind of work as `work`. Nobody read it
        yet (a rule emergency before the Agent's read, or no Agent at all) ⇒ link only, as before plan 23."""
        if not emergency_ids:
            return None
        if self.catalog.agent_policy.hold_near_open_emergency:
            return emergency_ids[0]
        mine = self._category(work)
        if mine is None:
            return None
        for emergency_id in emergency_ids:
            kinds = self._merged_kinds(self._case_view(emergency_id))
            if kinds is not None and mine in kinds:
                return emergency_id
        return None

    def _merged_kinds(self, emergency: Case) -> frozenset[ServiceCategory] | None:
        """The kinds of an emergency together with every emergency BQL merged into it (their words are not in its
        `_content`, plan 23 P03 §2). An unread part adds nothing; nothing read at all ⇒ None."""
        kinds = self._emergency_kinds(emergency)
        for child_id in emergency.ticket.merged_children:
            child = self._case_view(child_id)
            if child.ticket.status != TicketStatus.MERGED or child.ticket.merged_into != emergency.ticket.ticket_id:
                continue
            more = self._emergency_kinds(child)
            if more is not None:
                kinds = more if kinds is None else kinds | more
        return kinds

    def _emergency_kinds(self, emergency: Case) -> frozenset[ServiceCategory] | None:
        """Plan 23 P03 §2: the kinds of work of an emergency, as a person pinned them, else as the Agent read them (its
        valid jobs, `read_emergency` for a rule emergency). Never guessed from the words by the rules (Q30, R01 F1):
        None = nobody read it, which holds nothing."""
        ticket = emergency.ticket
        pinned = ticket.locked_fields.category or ticket.split_category
        if pinned:
            return frozenset({ServiceCategory(pinned)})
        record = emergency.agent_decision
        if record is None or record.decision is None:
            return None
        jobs = record.decision.jobs
        kinds = frozenset(ServiceCategory(jobs[i].category) for i in record.valid_job_indexes if i < len(jobs))
        return kinds or None

    def _release_waiting_for(self, emergency: Case, now: datetime) -> None:
        """BQL handled `emergency` (downgraded, closed, cancelled, merged): the tickets waiting for it go on from
        step 8 (which links them to the other emergencies there), unless another one still holds them (P03 §1.6)."""
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
            blocking = self._blocking_emergency(view, still_open)  # P03 §1.6: waits on only for one that holds it
            if blocking is not None:
                self._link_pair(
                    waiting,
                    self._related_case(blocking),
                    now,
                    AGENT_ID,
                    ActorRole.AGENT,
                    why="Khẩn cấp đang mở cùng vị trí",
                )
                note = f"Chờ BQL xử lý khẩn cấp {blocking} cùng vị trí"  # the note names the one it waits for now
                self._set_ticket(waiting, blocker=waiting.ticket.blocker.model_copy(update={"internal_note": note}))
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
        locked_location = src.ticket.locked_fields.location  # I-19: BPTN's place for the source holds for the follow-up
        if locked_location:
            self._set_ticket(
                new, locked_fields=new.ticket.locked_fields.model_copy(update={"location": locked_location})
            )
        new.not_duplicate_of.append(src.ticket.ticket_id)
        return new
