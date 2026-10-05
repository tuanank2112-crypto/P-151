"""Splitting a two-job report (SPEC-P05). WP5: frame and stubs; WP8 fills the bodies."""

from datetime import datetime

from src.maintenance.models import Case


class SplitMixin:
    def _try_split(self, work: Case, now: datetime) -> bool:
        """Step 3: split a mixed report in two tickets (WP8). False = no split, the pipeline goes on as before."""
        return False

    def undo_split(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        raise NotImplementedError("plan 06 WP8: undo_split")
