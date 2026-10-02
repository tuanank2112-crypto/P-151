"""Storage contract for MaintenanceOps cases (plan #01, 01-CONTRACTS §2 and §5).

The engine error hierarchy lives here (re-exported by `src.maintenance.engine`) so repositories can raise
engine errors without importing the engine.
"""

from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractContextManager
from typing import Any, Protocol

from src.maintenance.models import AuditEvent, Case, Notification, StatusEvent


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


class Tx(Protocol):
    """One open transaction. Every write becomes visible together at commit, or not at all."""

    def get_for_update(self, ticket_id: str) -> Case: ...

    def insert(self, case: Case) -> None: ...

    def save(self, case: Case) -> None: ...

    def append_log(self, rows: Sequence[AuditEvent | StatusEvent]) -> None: ...

    def append_notifications(self, rows: Sequence[Notification]) -> None: ...

    def add_stock(self, item_code: str, qty: float) -> float: ...


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

    def run_number(self) -> int: ...

    def wipe(self, stock: dict[str, float | None]) -> int: ...

    def job_lease(self) -> AbstractContextManager[bool]: ...

    def seed_lease(self) -> AbstractContextManager[bool]: ...

    def check(self) -> None: ...
