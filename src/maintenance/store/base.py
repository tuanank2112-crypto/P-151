"""Storage contract for MaintenanceOps cases (plan #01, 01-CONTRACTS §2 and §5).

The engine error hierarchy lives here (re-exported by `src.maintenance.engine`) so repositories can raise
engine errors without importing the engine.
"""

from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import datetime
from typing import Any, Protocol

from pydantic import AwareDatetime, BaseModel, ConfigDict

from src.maintenance.models import AuditEvent, Case, Notification, StatusEvent, StockAlert


class EngineError(Exception):
    code = "ENGINE_ERROR"

    def __init__(self, message: str, detail: dict[str, Any] | None = None):
        super().__init__(message)
        self.message = message
        self.detail = detail or {}


class NotFoundError(EngineError):
    code = "NOT_FOUND"


class GuardError(EngineError):
    """Business precondition not met. Nothing is written."""

    code = "GUARD_FAILED"


def short_stock_error(item_code: str, stock: float, qty: float) -> GuardError:
    """Issuing more than the warehouse holds (both stores raise the same error)."""
    return GuardError(
        f"Kho chỉ còn {stock:g} {item_code}, không xuất thêm được {qty:g}",
        {"item_code": item_code, "stock_qty": stock, "requested_qty": qty},
    )


class ConcurrencyError(EngineError):
    """`Tx.save` matched no row at the expected version: someone else changed the ticket. Nothing is written."""

    code = "CONCURRENT_UPDATE"


class StoreUnavailableError(EngineError):
    """The store could not be reached in the middle of a transaction. Nothing is written; never retried."""

    code = "STORE_UNAVAILABLE"


class StorePermissionError(EngineError):
    """The database user may not run this operation (for example TRUNCATE for reset). Nothing is written."""

    code = "STORE_PERMISSION_DENIED"


class UnstorableTextError(GuardError):
    """Text the store cannot hold (a NUL character). Nothing is written."""

    code = "UNSTORABLE_TEXT"


class MaterialItem(BaseModel):
    """A material added at run time (plan 11 SPEC-P01 §3): table `maintops.material_items`, never in a ticket doc."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    item_code: str
    item_name: str
    unit: str
    created_by: str
    created_at: AwareDatetime


class Assignment(BaseModel):
    """Who a department gave a ticket to (plan 11 SPEC-P04 §3): table `maintops.assignments`, never in a ticket doc
    (`Ticket.assignee_id` stays None, CR-BPTN-03 §4.4.2). One row per ticket; a new assignment replaces it."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    ticket_id: str
    staff_id: str
    assigned_by: str
    assigned_at: AwareDatetime


class RatingDetail(BaseModel):
    """Tags and comment that go with a rating (plan 11 SPEC-P04 §4): table `maintops.rating_details`."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    ticket_id: str
    tags: tuple[str, ...] = ()
    comment: str = ""
    created_at: AwareDatetime


class Tx(Protocol):
    """One open transaction. Every write becomes visible together at commit, or not at all."""

    def get_for_update(self, ticket_id: str) -> Case: ...

    def insert(self, case: Case) -> None: ...

    def save(self, case: Case) -> None: ...

    def append_log(self, rows: Sequence[AuditEvent | StatusEvent]) -> None: ...

    def append_notifications(self, rows: Sequence[Notification]) -> None: ...

    def add_stock(self, item_code: str, qty: float) -> float: ...

    def take_stock(self, item_code: str, qty: float) -> float | None:
        """Issue `qty` (negative = return) from known stock, atomically. Unknown stock (null) is left as is and
        returns None; a take larger than the stock raises `GuardError` and the whole transaction rolls back."""
        ...

    def put_assignment(self, assignment: Assignment) -> None:
        """Insert or replace the assignment of a ticket, committed or rolled back with the ticket (plan 11)."""
        ...

    def put_rating_detail(self, detail: RatingDetail) -> None:
        """Insert the tags and comment of a rating, committed or rolled back with the rating itself (plan 11)."""
        ...

    def put_stock_alert(self, alert: StockAlert) -> None:
        """Insert a restock alert, committed or rolled back with the stock it reports (plan 20 B1)."""
        ...


class CaseRepository(Protocol):
    """Source of truth for cases, stock, audit, outbox and the run number (invariant I-1)."""

    def transaction(self) -> AbstractContextManager[Tx]: ...

    def get(self, ticket_id: str) -> Case: ...

    def list(self) -> list[Case]: ...

    def count(self) -> int: ...

    def next_ticket_number(self) -> int: ...

    def stock_of(self, item_code: str) -> float | None: ...

    def stock(self) -> dict[str, float | None]: ...

    def set_stock(self, item_code: str, qty: float | None) -> None: ...

    def material_items(self) -> list[MaterialItem]:
        """Materials added at run time, oldest first (empty when the feature is off)."""
        ...

    def add_material_item(self, item: MaterialItem) -> MaterialItem:
        """Store `item`; an existing `item_code` is kept as it is and returned (the first one wins)."""
        ...

    def assignments(self) -> dict[str, Assignment]:
        """Every assignment by ticket_id (empty when the feature is off)."""
        ...

    def rating_details(self) -> dict[str, RatingDetail]:
        """Every rating detail by ticket_id (empty when the feature is off)."""
        ...

    def stock_alerts(self, department_id: str, *, unread_only: bool) -> list[StockAlert]:
        """Alerts of a department, newest first (empty when the feature is off)."""
        ...

    def acknowledge_stock_alert(self, alert_id: str, actor_id: str, at: datetime) -> StockAlert:
        """Mark an alert read once; an already read alert is returned unchanged. Unknown id ⇒ `NotFoundError`."""
        ...

    def run_number(self) -> int: ...

    def wipe(self, stock: dict[str, float | None]) -> int: ...

    def job_lease(self) -> AbstractContextManager[bool]: ...

    def seed_lease(self) -> AbstractContextManager[bool]: ...

    def check(self) -> None: ...
