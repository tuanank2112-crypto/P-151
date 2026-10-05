"""Duplicate detection, merge and unmerge (SPEC-P04). WP5: frame and stubs; WP7 fills the bodies."""

from datetime import datetime

from src.maintenance.enums import ActorRole, Priority, TicketStatus
from src.maintenance.models import Blocker, Case


class MergeMixin:
    def _on_duplicate_detected(self, root: Case, work: Case, now: datetime) -> None:
        """Step 4 found `root`: count it on the root (WP7). Called with the root locked and still open."""
        return None

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
        """T08 by BPTN (`counted=False`: the pair was counted when step 4 found it). WP7 adds the root-side writes."""
        self._apply_transition(work, TicketStatus.MERGED, actor_id, role, now, note=note, merged_into=root_id)

    def _t09_unmerge_by_person(
        self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str | None
    ) -> None:
        raise NotImplementedError("plan 06 WP7: _t09_unmerge_by_person")

    def _unmerge(self, work: Case, actor_id: str, role: ActorRole, now: datetime, *, note: str) -> None:
        raise NotImplementedError("plan 06 WP7: _unmerge")

    def _release_duplicate_count(self, work: Case, previous_blocker: Blocker | None, now: datetime) -> None:
        return None

    def _unmerge_children_of(self, root: Case, now: datetime) -> None:
        return None

    def _apply_pri_u1(self, work: Case, priority: Priority, reason: str) -> tuple[Priority, str]:
        return priority, reason

    def bql_merge(self, ticket_id: str, actor_id: str, *, into: str, note: str) -> Case:
        raise NotImplementedError("plan 06 WP7: bql_merge")

    def undo_merge(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        return self.transition(ticket_id, TicketStatus.RECEIVED, actor_id, note=note, expected_from=TicketStatus.MERGED)
