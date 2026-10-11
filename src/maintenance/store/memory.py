"""In-process `CaseRepository` (MO_STORE=memory, tests, offline demo).

Writes are copy-on-write: a transaction collects its changes and applies them to the store only when the `with`
block exits without an exception. Versions behave like the Postgres repository (insert = 1, save = +1, a save
against a stale version raises `ConcurrencyError`).

Stored `Case` objects are handed out as-is (no copy); callers must treat them as read-only. The engine always
works on a deep copy before it saves.
"""

from __future__ import annotations

import re
import threading
from collections.abc import Iterator, Sequence
from contextlib import contextmanager

from src.maintenance.models import AuditEvent, Case, Notification, StatusEvent
from src.maintenance.store.base import (
    Assignment,
    ConcurrencyError,
    GuardError,
    MaterialItem,
    NotFoundError,
    RatingDetail,
    short_stock_error,
)

_TICKET_NUMBER = re.compile(r"^SIM-TKT-(\d+)$")


def _not_found(ticket_id: str) -> NotFoundError:
    return NotFoundError(f"Không có ticket {ticket_id}")


class _MemoryTx:
    """Pending changes of one transaction; applied by `InMemoryRepository._apply` on a clean exit."""

    def __init__(self, repo: InMemoryRepository):
        self._repo = repo
        self.cases: dict[str, Case] = {}
        self.expected: dict[str, int] = {}  # ticket_id → committed version seen by get_for_update
        self.inserted: set[str] = set()
        self.saved: set[str] = set()
        self.log: list[AuditEvent | StatusEvent] = []
        self.notifications: list[Notification] = []
        self.stock: dict[str, float | None] = {}
        self.assignments: dict[str, Assignment] = {}
        self.rating_details: dict[str, RatingDetail] = {}

    def get_for_update(self, ticket_id: str) -> Case:
        if ticket_id in self.cases:
            return self.cases[ticket_id]
        with self._repo._lock:
            case = self._repo._cases.get(ticket_id)
            if case is None:
                raise _not_found(ticket_id)
            self.expected[ticket_id] = self._repo._versions[ticket_id]
        return case

    def insert(self, case: Case) -> None:
        ticket_id = case.ticket.ticket_id
        with self._repo._lock:
            if ticket_id in self._repo._cases or ticket_id in self.cases:
                raise GuardError(f"Ticket {ticket_id} đã được ingest")
            self._repo._take_number(ticket_id)  # like setval: never handed out again, even on rollback
        self.cases[ticket_id] = case
        self.inserted.add(ticket_id)

    def save(self, case: Case) -> None:
        ticket_id = case.ticket.ticket_id
        if ticket_id in self.inserted:
            self.cases[ticket_id] = case
            return
        if ticket_id not in self.expected:
            raise GuardError(f"Ticket {ticket_id} phải được get_for_update trước khi save")
        with self._repo._lock:
            if self._repo._versions.get(ticket_id) != self.expected[ticket_id]:
                raise ConcurrencyError(
                    f"Ticket {ticket_id} vừa bị thay đổi bởi thao tác khác; tải lại rồi thử lại",
                    {"ticket_id": ticket_id},
                )
        self.cases[ticket_id] = case
        self.saved.add(ticket_id)

    def append_log(self, rows: Sequence[AuditEvent | StatusEvent]) -> None:
        self.log.extend(rows)

    def append_notifications(self, rows: Sequence[Notification]) -> None:
        self.notifications.extend(rows)

    def add_stock(self, item_code: str, qty: float) -> float:
        if item_code in self.stock:
            current = self.stock[item_code]
        else:
            current = self._repo.stock_of(item_code)
        new = (current or 0) + qty
        self.stock[item_code] = new
        return new

    def put_assignment(self, assignment: Assignment) -> None:
        self.assignments[assignment.ticket_id] = assignment

    def put_rating_detail(self, detail: RatingDetail) -> None:
        self.rating_details[detail.ticket_id] = detail

    def take_stock(self, item_code: str, qty: float) -> float | None:
        current = self.stock[item_code] if item_code in self.stock else self._repo.stock_of(item_code)
        if current is None:
            return None
        if qty > current:
            raise short_stock_error(item_code, current, qty)
        self.stock[item_code] = current - qty
        return current - qty


class InMemoryRepository:
    def __init__(self, stock: dict[str, float | None] | None = None):
        self._lock = threading.RLock()
        self._cases: dict[str, Case] = {}
        self._versions: dict[str, int] = {}
        self._log: list[AuditEvent | StatusEvent] = []
        self._notifications: list[Notification] = []
        self._stock: dict[str, float | None] = dict(stock or {})
        self._material_items: dict[str, MaterialItem] = {}
        self._assignments: dict[str, Assignment] = {}
        self._rating_details: dict[str, RatingDetail] = {}
        self._ticket_number = 0
        self._run_number = 0

    # ------------------------------------------------------------------ transaction

    @contextmanager
    def transaction(self) -> Iterator[_MemoryTx]:
        tx = _MemoryTx(self)
        yield tx  # an exception propagates from here: the pending changes are dropped (rollback)
        self._apply(tx)

    def _apply(self, tx: _MemoryTx) -> None:
        with self._lock:
            for ticket_id in tx.saved:  # re-check: nothing may slip in between save and commit
                if self._versions.get(ticket_id) != tx.expected[ticket_id]:
                    raise ConcurrencyError(
                        f"Ticket {ticket_id} vừa bị thay đổi bởi thao tác khác; tải lại rồi thử lại",
                        {"ticket_id": ticket_id},
                    )
            for ticket_id in tx.inserted:
                if ticket_id in self._cases:
                    raise GuardError(f"Ticket {ticket_id} đã được ingest")
            for ticket_id, case in tx.cases.items():
                self._versions[ticket_id] = 1 if ticket_id in tx.inserted else self._versions[ticket_id] + 1
                self._cases[ticket_id] = case
            self._log.extend(tx.log)
            self._notifications.extend(tx.notifications)
            self._stock.update(tx.stock)
            self._assignments.update(tx.assignments)
            self._rating_details.update(tx.rating_details)

    # ------------------------------------------------------------------ reads

    def get(self, ticket_id: str) -> Case:
        case = self._cases.get(ticket_id)
        if case is None:
            raise _not_found(ticket_id)
        return case

    def list(self) -> list[Case]:
        with self._lock:
            return [self._cases[ticket_id] for ticket_id in sorted(self._cases)]

    def count(self) -> int:
        return len(self._cases)

    def stock_of(self, item_code: str) -> float | None:
        return self._stock.get(item_code)

    def stock(self) -> dict[str, float | None]:
        with self._lock:
            return dict(self._stock)

    def run_number(self) -> int:
        return self._run_number

    def material_items(self) -> list[MaterialItem]:
        with self._lock:
            return sorted(self._material_items.values(), key=lambda item: (item.created_at, item.item_code))

    def assignments(self) -> dict[str, Assignment]:
        with self._lock:
            return dict(self._assignments)

    def rating_details(self) -> dict[str, RatingDetail]:
        with self._lock:
            return dict(self._rating_details)

    def version_of(self, ticket_id: str) -> int:
        """Memory-only inspection for tests: the committed version of a ticket."""
        if ticket_id not in self._versions:
            raise _not_found(ticket_id)
        return self._versions[ticket_id]

    def log_rows(self) -> list[AuditEvent | StatusEvent]:
        """Memory-only inspection for tests: every committed audit_log row, in commit order."""
        with self._lock:
            return list(self._log)

    def notification_rows(self) -> list[Notification]:
        """Memory-only inspection for tests: every committed outbox row, in commit order."""
        with self._lock:
            return list(self._notifications)

    # ------------------------------------------------------------------ writes outside a transaction

    def next_ticket_number(self) -> int:
        with self._lock:
            self._ticket_number += 1
            return self._ticket_number

    def _take_number(self, ticket_id: str) -> None:
        match = _TICKET_NUMBER.match(ticket_id)
        if match:
            self._ticket_number = max(self._ticket_number, int(match.group(1)))

    def set_stock(self, item_code: str, qty: float | None) -> None:
        with self._lock:
            self._stock[item_code] = qty

    def add_material_item(self, item: MaterialItem) -> MaterialItem:
        with self._lock:
            return self._material_items.setdefault(item.item_code, item)

    def wipe(self, stock: dict[str, float | None]) -> int:
        with self._lock:
            self._material_items = {}
            self._assignments = {}
            self._rating_details = {}
            self._cases = {}
            self._versions = {}
            self._log = []
            self._notifications = []
            self._stock = dict(stock)
            self._ticket_number = 0
            self._run_number += 1
            return self._run_number

    # ------------------------------------------------------------------ single process: always the leader

    @contextmanager
    def job_lease(self) -> Iterator[bool]:
        yield True

    @contextmanager
    def seed_lease(self) -> Iterator[bool]:
        yield True

    def check(self) -> None:
        return None
