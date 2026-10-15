"""Duplicate detection, merge and unmerge (SPEC-P04, plan 06 WP7): the duplicate count and PRI-U1, T08 by BPTN and by
BQL, T09 by a person and by the system (root cancelled), the count released when a suspect is cancelled.

Every write to a ticket other than the main one goes through `_related_case` (I-25) and never to a finished ticket
(I-26). Nothing here asks the model: a merge, an undo or a cancel does not change what the Agent reads (P02 §5).
"""

from datetime import datetime

from src.maintenance.common import AGENT_ID, LOCAL_TZ, SYSTEM_ID, _blank, _created_at
from src.maintenance.enums import (
    TERMINAL_STATUSES,
    Action,
    ActorRole,
    Priority,
    PrioritySource,
    ReasonCode,
    RiskLevel,
    TicketStatus,
)
from src.maintenance.errors import GuardError, InvalidTransitionError
from src.maintenance.models import Blocker, Case
from src.maintenance.priority import apply_duplicate_raise
from src.maintenance.store.base import NotFoundError

_ROOT_CANCELLED = "Ticket gốc bị hủy"
# blockers whose related_ticket_id is counted on that ticket (plan 23 P01: also an emergency suspect)
_SUSPECT_CODES = frozenset({ReasonCode.DUPLICATE, ReasonCode.EMERGENCY_PENDING_BQL})


class MergeMixin:
    # ------------------------------------------------------------------ duplicate count and PRI-U1 (P04 §2)

    def _count_duplicate(
        self,
        root: Case,
        delta: int,
        other_id: str,
        actor_id: str,
        role: ActorRole,
        now: datetime,
        *,
        why: str,
    ) -> None:
        """`root` is a working copy (from `_related_case`, or the main ticket). A finished root is not written."""
        if root.ticket.status in TERMINAL_STATUSES:
            return
        old = root.ticket.duplicate_count
        new = max(0, old + delta)
        if new == old:
            return
        self._audit(
            root,
            Action.LINK_TICKETS,
            "Ticket",
            root.ticket.ticket_id,
            actor_id,
            role,
            "duplicate_count",
            old,
            new,
            f"{why} ({other_id})",
            now=now,
        )
        self._set_ticket(root, duplicate_count=new)
        self._refresh_priority(root, now)

    def _count_if_open(
        self,
        root_id: str,
        delta: int,
        other_id: str,
        actor_id: str,
        role: ActorRole,
        now: datetime,
        *,
        why: str,
    ) -> None:
        """`_count_duplicate` on the ticket `root_id` when it exists and is still open (read first, lock only then)."""
        try:
            if self._case_view(root_id).ticket.status in TERMINAL_STATUSES:
                return
        except NotFoundError:
            return
        self._count_duplicate(self._related_case(root_id), delta, other_id, actor_id, role, now, why=why)

    def _refresh_priority(self, work: Case, now: datetime) -> None:
        """PRI-U1 when the count changed. A person's priority, an emergency ticket and a ticket without a kind of
        work (no priority yet) are left alone; otherwise the proposal runs again (idempotent, no audit when equal).
        Entered through `_activated` so the Agent's stored decision, if it still matches the content, is the base."""
        ticket = work.ticket
        if ticket.priority_source == PrioritySource.HUMAN_OVERRIDE or ticket.risk_level == RiskLevel.EMERGENCY:
            return
        category = self._category(work)
        if category is None:
            return
        with self._activated(work, now):
            self._propose_priority(work, category, now)

    def _apply_pri_u1(self, work: Case, priority: Priority, reason: str) -> tuple[Priority, str]:
        """Called by `_propose_priority` for the Agent's base and the rule base alike."""
        raised, text, _ = apply_duplicate_raise(
            priority,
            reason,
            duplicate_count=work.ticket.duplicate_count,
            raise_at=self.catalog.sla_config.priority.duplicate_raise_at_count,
        )
        return raised, text

    def _recount_duplicates(self, work: Case, actor_id: str, role: ActorRole, now: datetime) -> None:
        """Set `work.duplicate_count` to the P04 §2.1 definition: open tickets waiting as its suspected duplicate
        (VERIFYING/DUPLICATE or VERIFYING/EMERGENCY_PENDING_BQL pointing at it, plan 23 P01) + tickets merged into it that are counted (not its own split children).
        A ticket re-opened by T09 carries the number frozen while it was MERGED; this brings it back."""
        ticket_id = work.ticket.ticket_id
        wanted = 0
        for case in self._cases_snapshot():
            other = case.ticket
            if other.ticket_id == ticket_id:
                continue
            if other.status == TicketStatus.VERIFYING:
                blocker = other.blocker
                if blocker is not None and blocker.code in _SUSPECT_CODES:
                    wanted += blocker.related_ticket_id == ticket_id
            elif other.status == TicketStatus.MERGED and other.merged_into == ticket_id:
                wanted += other.split_from != ticket_id
        old = work.ticket.duplicate_count
        if wanted == old:
            return
        self._audit(
            work,
            Action.LINK_TICKETS,
            "Ticket",
            ticket_id,
            actor_id,
            role,
            "duplicate_count",
            old,
            wanted,
            "Tính lại số nghi trùng khi mở lại ticket",
            now=now,
        )
        self._set_ticket(work, duplicate_count=wanted)

    def _has_open_merged_children(self, work: Case) -> bool:
        """Some child in `merged_children` is still MERGED into `work` (merging `work` now would chain)."""
        for child_id in work.ticket.merged_children:
            try:
                child = self._case_view(child_id)
            except NotFoundError:
                continue
            if child.ticket.status == TicketStatus.MERGED and child.ticket.merged_into == work.ticket.ticket_id:
                return True
        return False

    def _on_duplicate_detected(self, root: Case, work: Case, now: datetime) -> None:
        """Step 4 found `root`: count it on the root. Called with the root locked and still open."""
        self._count_duplicate(
            root, +1, work.ticket.ticket_id, AGENT_ID, ActorRole.AGENT, now, why="Phản ánh nghi trùng"
        )

    def _mark_emergency_duplicate(self, work: Case, now: datetime) -> str | None:
        """Plan 23 P01 §1: `work` just became EMERGENCY_PENDING_BQL. When an older open emergency waits at the same
        place, `work` points at the oldest one that is a root itself (no pointer: after a merge into a newer ticket
        the oldest may be a suspect, R02 F-A) and is counted on it. A pointer is never followed. Nothing else
        changes: the ticket stays with BQL, who alone merges (I-1, I-2)."""
        ticket = work.ticket
        location = self.effective_location(work)
        if location is None or ticket.blocker is None or ticket.blocker.code != ReasonCode.EMERGENCY_PENDING_BQL:
            return None
        mine = (_created_at(ticket.raw), ticket.ticket_id)
        if mine[0] is None:
            return None
        older = [
            other
            for other_id in self._open_emergencies_at(location, exclude={ticket.ticket_id, *work.not_duplicate_of})
            if (created := _created_at((other := self._case_view(other_id).ticket).raw)) is not None
            and (created, other_id) < mine
        ]  # oldest first
        roots = [other for other in older if other.blocker.related_ticket_id is None]
        root_id = (roots or older)[0].ticket_id if older else None
        if root_id is None:
            return None
        self._point_suspect(work, root_id, now, why=f"Nghi trùng khẩn cấp {root_id} cùng vị trí")
        return root_id

    def _point_suspect(self, work: Case, root_id: str | None, now: datetime, *, why: str) -> None:
        """Set `work`'s suspect pointer to `root_id` (None clears it), counted on the new root (I-3)."""
        old = work.ticket.blocker.related_ticket_id
        if old == root_id:
            return
        self._audit(
            work, Action.LINK_TICKETS, "Ticket", work.ticket.ticket_id, AGENT_ID, ActorRole.AGENT,
            "blocker.related_ticket_id", old, root_id, why, now=now,
        )  # fmt: skip
        self._set_ticket(work, blocker=work.ticket.blocker.model_copy(update={"related_ticket_id": root_id}))
        if root_id is not None:
            self._count_duplicate(
                self._related_case(root_id), +1, work.ticket.ticket_id, AGENT_ID, ActorRole.AGENT, now,
                why="Phản ánh khẩn cấp nghi trùng",
            )  # fmt: skip

    def _repoint_suspects(self, root: Case, now: datetime) -> None:
        """Plan 23 P01 §3: `root` stopped being an open emergency (downgraded, closed, cancelled, merged). Its open
        suspects get a root that still is one: the ticket it was merged into, else the oldest suspect, which itself
        stops being a suspect. `root` keeps no count for them while it is still open (it is no longer their root)."""
        root_id = root.ticket.ticket_id
        suspects = []
        for case in self._cases_snapshot():
            blocker = case.ticket.blocker
            if (
                case.ticket.status == TicketStatus.VERIFYING
                and blocker is not None
                and blocker.code == ReasonCode.EMERGENCY_PENDING_BQL
                and blocker.related_ticket_id == root_id
            ):
                suspects.append(((_created_at(case.ticket.raw), case.ticket.ticket_id), case.ticket.ticket_id))
        if not suspects:
            return
        ordered = [ticket_id for _, ticket_id in sorted(suspects)]
        merged_into = root.ticket.merged_into if root.ticket.status == TicketStatus.MERGED else None
        new_root = merged_into or ordered[0]
        for ticket_id in ordered:
            suspect = self._related_case(ticket_id)
            self._count_duplicate(root, -1, ticket_id, AGENT_ID, ActorRole.AGENT, now, why="Ca gốc không còn khẩn cấp")
            target = None if ticket_id == new_root or new_root in suspect.not_duplicate_of else new_root
            self._point_suspect(suspect, target, now, why=f"Ca gốc {root_id} không còn khẩn cấp mở")

    # ------------------------------------------------------------------ T08 (P04 §3)

    def _merge_into(
        self,
        work: Case,
        root_id: str,
        actor_id: str,
        role: ActorRole,
        now: datetime,
        *,
        note: str | None,
        counted: bool,
    ) -> None:
        """T08: `work` becomes MERGED into `root_id`. `counted=False`: BPTN confirms a pair step 4 already counted;
        `counted=True`: BQL merges an emergency ticket, which step 4 never counts. All checks come before any write."""
        if root_id == work.ticket.ticket_id:
            raise GuardError("Không gộp ticket vào chính nó")
        if self._has_open_merged_children(work):
            raise GuardError(
                "Ticket còn ticket con đang gộp vào nó; hoàn tác gộp các ticket con trước (không gộp dây chuyền)",
                {"merged_children": list(work.ticket.merged_children)},
            )
        root = self._related_case(root_id)  # NotFoundError when there is none
        if root.ticket.status in TERMINAL_STATUSES:
            raise GuardError(
                f"Ticket gốc {root_id} đã kết thúc ({root.ticket.status}); không gộp được",
                {"root_status": root.ticket.status},
            )
        child_id = work.ticket.ticket_id
        self._apply_transition(work, TicketStatus.MERGED, actor_id, role, now, note=note, merged_into=root_id)
        if child_id not in root.ticket.merged_children:
            old = list(root.ticket.merged_children)
            self._audit(
                root,
                Action.LINK_TICKETS,
                "Ticket",
                root_id,
                actor_id,
                role,
                "merged_children",
                old,
                [*old, child_id],
                f"Gộp {child_id} vào ticket này",
                now=now,
            )
            self._set_ticket(root, merged_children=[*old, child_id])
        self._copy_additions(work, root, now, mode="merge")
        self._copy_resident_photos(work, root, now, mode="merge")
        if counted:
            self._count_duplicate(root, +1, child_id, actor_id, role, now, why="BQL gộp phản ánh khẩn cấp")

    def bql_merge(self, ticket_id: str, actor_id: str, *, into: str, note: str) -> Case:
        """T08 by BQL: an emergency ticket waiting for BQL is merged into another open emergency ticket."""

        into = into.strip()

        def op(work: Case, now: datetime) -> None:
            blocker = work.ticket.blocker
            if (
                work.ticket.status != TicketStatus.VERIFYING
                or blocker is None
                or blocker.code != ReasonCode.EMERGENCY_PENDING_BQL
            ):
                raise InvalidTransitionError(
                    "Chỉ gộp được ticket khẩn cấp đang chờ BQL (EMERGENCY_PENDING_BQL)",
                    {"status": work.ticket.status},
                )
            if _blank(note):
                raise GuardError("Gộp phản ánh khẩn cấp bắt buộc ghi lý do")
            if into == ticket_id:
                raise GuardError("Không gộp ticket vào chính nó")
            if self._has_open_merged_children(work):
                raise GuardError(
                    "Ticket còn ticket con đang gộp vào nó; hoàn tác gộp các ticket con trước (không gộp dây chuyền)",
                    {"merged_children": list(work.ticket.merged_children)},
                )
            root = self._related_case(into)  # 404
            if root.ticket.status in TERMINAL_STATUSES:
                raise GuardError(
                    f"Ticket gốc {into} đã kết thúc ({root.ticket.status}); không gộp được",
                    {"root_status": root.ticket.status},
                )
            if root.ticket.risk_level != RiskLevel.EMERGENCY:
                raise GuardError("Chỉ gộp vào phản ánh khẩn cấp đang mở", {"root_risk_level": root.ticket.risk_level})
            self._audit(
                work,
                Action.BQL_MERGE,
                "Ticket",
                ticket_id,
                actor_id,
                ActorRole.BQL,
                "merged_into",
                None,
                into,
                note.strip(),
                now=now,
            )
            suspect_of = blocker.related_ticket_id
            if suspect_of is not None and suspect_of != into:  # plan 23 P01 §2: counted on another root until now
                self._count_if_open(suspect_of, -1, ticket_id, actor_id, ActorRole.BQL, now, why="Gộp vào ca khác")
            counted = suspect_of != into  # already counted on `into` when it was marked
            self._merge_into(work, into, actor_id, ActorRole.BQL, now, note=note.strip(), counted=counted)
            self._repoint_suspects(work, now)  # plan 23 P01 §3: its own suspects now point at `into`
            self._release_waiting_for(work, now)  # P1-E: tickets waiting for this emergency may go on

        return self._mutate(ticket_id, actor_id, Action.BQL_MERGE, op)

    # ------------------------------------------------------------------ T09 (P04 §5)

    def _t09_unmerge_by_person(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        if role not in (ActorRole.BPTN, ActorRole.BQL):  # SYSTEM is a T09 actor only for a cancelled root (SPEC-P08 §3)
            self._deny(
                self.get(work.ticket.ticket_id),
                actor_id,
                role,
                Action.MERGE_UNDO,
                "merged_into",
                None,
                note,
                now,
                message="Hoàn tác gộp do BPTN/BQL (T09)",
            )
        if role == ActorRole.BPTN and work.ticket.risk_level == RiskLevel.EMERGENCY:
            self._deny(
                self.get(work.ticket.ticket_id),
                actor_id,
                role,
                Action.MERGE_UNDO,
                "merged_into",
                None,
                note,
                now,
                message="Ticket khẩn cấp do BQL gộp; chỉ BQL hoàn tác",
            )
        if _blank(note):
            raise GuardError("Hoàn tác gộp bắt buộc ghi lý do")
        self._unmerge(work, actor_id, role, now, note=note.strip())

    def _unmerge(self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str) -> None:
        """T09: back to RECEIVED, the pair is never offered again, the root's count goes down (not for a split child),
        then the pipeline runs again: from step 4 for an ordinary ticket, from 2 for an emergency (D-05, I-17)."""
        ticket_id = work.ticket.ticket_id
        root_id = work.ticket.merged_into
        counted = work.ticket.split_from != root_id
        self._apply_transition(work, TicketStatus.RECEIVED, actor_id, role, now, note=note, merged_into=None)
        self._recount_duplicates(work, actor_id, role, now)  # frozen while MERGED (I-26): back to P04 §2.1
        if root_id not in work.not_duplicate_of:
            work.not_duplicate_of.append(root_id)
        self._audit(
            work, Action.MERGE_UNDO, "Ticket", ticket_id, actor_id, role, "merged_into", root_id, None, note, now=now
        )
        if counted:
            self._count_if_open(root_id, -1, ticket_id, actor_id, role, now, why="Hoàn tác gộp")
        ordinary = work.ticket.risk_level == RiskLevel.NONE and self._category(work) is not None
        self._run_pipeline(work, 4 if ordinary else 2, now)

    # ------------------------------------------------------------------ cancel (P04 §6)

    def _release_duplicate_count(self, work: Case, previous_blocker: Blocker | None, now: datetime) -> None:
        """A suspect left its suspect state without being merged into its root (cancelled; for an emergency also
        downgraded or closed by BQL, plan 23 P01 §2): the root no longer counts it (when the root is still open)."""
        if previous_blocker is None or previous_blocker.code not in _SUSPECT_CODES:
            return
        if previous_blocker.related_ticket_id:
            self._count_if_open(
                previous_blocker.related_ticket_id,
                -1,
                work.ticket.ticket_id,
                SYSTEM_ID,
                ActorRole.SYSTEM,
                now,
                why="Ticket nghi trùng không còn chờ gộp",
            )

    def _unmerge_children_of(self, root: Case, now: datetime) -> None:
        """The root was cancelled: every child still MERGED into it goes back (T09 SYSTEM), oldest first, so a later
        child sees the earlier one's new state and becomes its duplicate instead of being routed twice."""
        root_id = root.ticket.ticket_id
        latest = datetime.max.replace(tzinfo=LOCAL_TZ)
        children = []
        for child_id in root.ticket.merged_children:
            try:
                child = self._case_view(child_id)
            except NotFoundError:
                continue
            if child.ticket.status == TicketStatus.MERGED and child.ticket.merged_into == root_id:
                children.append((_created_at(child.ticket.raw) or latest, child_id))
        for _, child_id in sorted(children):
            self._unmerge(self._related_case(child_id), SYSTEM_ID, ActorRole.SYSTEM, now, note=_ROOT_CANCELLED)

    def undo_merge(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        return self.transition(ticket_id, TicketStatus.RECEIVED, actor_id, note=note, expected_from=TicketStatus.MERGED)
