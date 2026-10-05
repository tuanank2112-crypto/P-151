"""Ordinary tickets next to an open emergency, and the follow-up ticket (SPEC-P07). WP5: frame and stubs; WP10 fills
the bodies."""

from datetime import datetime

from src.maintenance.models import Case


class NeighborMixin:
    def _link_emergency_both_ways(self, emergency: Case, ticket_ids: list[str], now: datetime) -> None:
        return None

    def _hold_for_emergency(self, work: Case, now: datetime) -> bool:
        """Start of step 8: True = the ticket waits for the emergency next to it (WP10)."""
        return False

    def _release_waiting_for(self, emergency: Case, now: datetime) -> None:
        return None

    def create_follow_up(self, ticket_id: str, actor_id: str, *, note: str) -> Case:
        raise NotImplementedError("plan 06 WP10: create_follow_up")
