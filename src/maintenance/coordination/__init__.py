"""Coordination mixins of `MaintenanceEngine` (plan 06 SPEC-P02 §3).

WP5 lays the frame and the stubs; the bodies arrive in wave 4: merge (WP7), split (WP8), department (WP9) and
neighbors (WP10). A mixin imports only `errors`, `common`, `enums`, `models`, `store.base`, `messages`, `priority` and
`rules`, never `engine`; it reaches the engine through `self` (`_related_case`, `_apply_transition`, ...).
"""

from src.maintenance.coordination.department import DepartmentMixin
from src.maintenance.coordination.merge import MergeMixin
from src.maintenance.coordination.neighbors import NeighborMixin
from src.maintenance.coordination.split import SplitMixin

__all__ = ["DepartmentMixin", "MergeMixin", "NeighborMixin", "SplitMixin"]
