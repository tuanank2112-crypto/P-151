"""PostgreSQL `CaseRepository` (MO_STORE=postgres, plan #01, 01-CONTRACTS §2-§4).

A `Case` is stored as JSONB (`maintops.cases.doc`) plus filter columns; audit rows and outbox rows go to the
append-only `maintops.audit_log` / `maintops.notifications`. Every engine write is one DB transaction, the ticket
row is locked with `SELECT ... FOR UPDATE` and `save` checks `version`.

The schema is created by Alembic (`migrations/`), never at startup.
"""

from __future__ import annotations

import functools
import logging
import re
import threading
from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, TypeVar

import sqlalchemy as sa
from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError

from src.maintenance.models import AuditEvent, Case, Notification, StatusEvent
from src.maintenance.store.base import (
    ConcurrencyError,
    GuardError,
    NotFoundError,
    StorePermissionError,
    StoreUnavailableError,
    UnstorableTextError,
    short_stock_error,
)

logger = logging.getLogger(__name__)

SCHEMA = "maintops"
SUPABASE_HOST_SUFFIXES = (".supabase.com", ".supabase.co")
HEAD_REVISION = "0002_p1_doc_shape"
ALEMBIC_INI = Path(__file__).with_name("alembic.ini")
UPGRADE_COMMAND = "python -m alembic -c src/maintenance/store/alembic.ini upgrade head"
KEY_JOBS = 151001  # advisory lock keys (transaction-scoped)
KEY_SEED = 151002

_TICKET_NUMBER = re.compile(r"^SIM-TKT-(\d+)$")
_SSL_OK = ("require", "verify-ca", "verify-full")

_metadata = sa.MetaData(schema=SCHEMA)
audit_log_table = sa.Table(
    "audit_log",
    _metadata,
    sa.Column("kind", sa.Text),
    sa.Column("event_id", sa.Text),
    sa.Column("ticket_id", sa.Text),
    sa.Column("occurred_at", sa.DateTime(timezone=True)),
    sa.Column("run_id", sa.Text),
    sa.Column("payload", JSONB),
)
notifications_table = sa.Table(
    "notifications",
    _metadata,
    sa.Column("notification_id", sa.Text),
    sa.Column("ticket_id", sa.Text),
    sa.Column("type", sa.Text),
    sa.Column("audience", sa.Text),
    sa.Column("payload", JSONB),
    sa.Column("created_at", sa.DateTime(timezone=True)),
)


# ---------------------------------------------------------------------- connection


def connect_args_for(url: str) -> dict[str, Any]:
    """Validate `DATABASE_URL` and return psycopg2 `connect_args`. Messages never contain the URL."""
    try:
        parsed = make_url(url)
    except Exception:
        # `from None` is mandatory: the original error carries the whole URL, password included
        raise RuntimeError("DATABASE_URL không phân tích được (MO_STORE=postgres)") from None
    if parsed.drivername not in ("postgresql", "postgresql+psycopg2"):
        raise RuntimeError(
            "DATABASE_URL phải bắt đầu bằng postgresql:// hoặc postgresql+psycopg2:// khi MO_STORE=postgres"
        )
    on_supabase = (parsed.host or "").lower().endswith(SUPABASE_HOST_SUFFIXES)
    if on_supabase and parsed.port == 6543:
        raise RuntimeError("DATABASE_URL trỏ Transaction pooler (6543) — bị cấm; dùng Session pooler cổng 5432")
    if on_supabase:
        sslmode = parsed.query.get("sslmode")
        if sslmode is None:
            return {"connect_timeout": 10, "sslmode": "require"}
        if sslmode not in _SSL_OK:
            raise RuntimeError("DATABASE_URL tới Supabase phải dùng sslmode=require")
    return {"connect_timeout": 10}


@functools.lru_cache(maxsize=4)
def sql_engine(url: str) -> sa.Engine:
    """The WRITE engine: transactions, row locks, leases. With `sql_read_engine` at most 5 connections per process
    (plan 12 Q05): `engine.lock` allows one write transaction, plus one lease."""
    return sa.create_engine(
        url,
        pool_size=2,
        max_overflow=0,
        pool_timeout=30,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args=connect_args_for(url),
    )


@functools.lru_cache(maxsize=4)
def sql_read_engine(url: str) -> sa.Engine:
    """The READ engine (plan 12 SPEC-P01): AUTOCOMMIT, so a one-statement read is one round trip instead of four
    (pre-ping, BEGIN, query, ROLLBACK — 230 ms vs 52 ms measured on Supabase). No pre-ping: `_read` retries once
    when the server dropped the pooled connection."""
    return sa.create_engine(
        url,
        pool_size=2,
        max_overflow=1,
        pool_timeout=30,
        pool_pre_ping=False,
        pool_recycle=300,
        isolation_level="AUTOCOMMIT",
        connect_args=connect_args_for(url),
    )


# ---------------------------------------------------------------------- errors


def _pgcode(exc: BaseException) -> str | None:
    return getattr(getattr(exc, "orig", None), "pgcode", None)


def _translate(exc: DBAPIError) -> Exception:
    """Map a DB error to a store error (01-CONTRACTS §3.3). pgcode first: 40001/40P01/55P03 are OperationalError."""
    code = _pgcode(exc)
    if code in ("40001", "40P01", "55P03"):
        return ConcurrencyError("Xung đột ghi đồng thời; tải lại rồi thử lại")
    if code == "42501":
        return StorePermissionError("User DB không có quyền cho thao tác này (cần owner)")
    if code in ("22P05", "22021"):
        return UnstorableTextError("Nội dung chứa ký tự không lưu được (NUL \\u0000)")
    if isinstance(exc, OperationalError | InterfaceError) or exc.connection_invalidated:
        return StoreUnavailableError("Không kết nối được cơ sở dữ liệu; thử lại sau")
    return exc


@contextmanager
def _db_errors() -> Iterator[None]:
    try:
        yield
    except DBAPIError as exc:
        translated = _translate(exc)
        if translated is exc:
            raise  # a real bug (bad CHECK, bad syntax): keep the original error
        raise translated from exc


def _created_at(value: str) -> datetime | None:
    """Same rule as `engine._created_at` (not imported: engine imports the store)."""
    try:
        moment = datetime.fromisoformat(value)
    except ValueError:
        return None
    return moment if moment.tzinfo else None


# ---------------------------------------------------------------------- transaction

_INSERT_CASE = text(
    "insert into maintops.cases (ticket_id, status, department_id, resident_id, created_at, doc) "
    "values (:ticket_id, :status, :department_id, :resident_id, :created_at, :doc)"
).bindparams(bindparam("doc", type_=JSONB))
_SAVE_NEW = text(
    "update maintops.cases set doc = :doc, status = :status, department_id = :department_id where ticket_id = :id"
).bindparams(bindparam("doc", type_=JSONB))
_SAVE_LOCKED = text(
    "update maintops.cases set doc = :doc, status = :status, department_id = :department_id, "
    "version = version + 1, updated_at = now() where ticket_id = :id and version = :v"
).bindparams(bindparam("doc", type_=JSONB))


# Plan 09 SPEC-P01: one statement returns every row's version and the doc only of rows the cache does not hold as is
_LIST_CHANGED = text(
    "select c.ticket_id, c.xmin::text as v, "
    "case when k.v is distinct from c.xmin::text then c.doc end as doc "
    "from maintops.cases c "
    "left join unnest(cast(:ids as text[]), cast(:vs as text[])) as k(tid, v) on k.tid = c.ticket_id "
    'order by c.ticket_id collate "C"'
)
LIST_LOG_EVERY = 100  # one INFO line with the cache counters every N listings


class _PgTx:
    """One open DB transaction. `conn` is public for white-box tests."""

    def __init__(self, conn: Connection):
        self.conn = conn
        self.versions: dict[str, int] = {}
        self.inserted: dict[str, Case] = {}

    def get_for_update(self, ticket_id: str) -> Case:
        with _db_errors():
            row = self.conn.execute(
                text("select version, doc from maintops.cases where ticket_id = :id for update"), {"id": ticket_id}
            ).first()
        if row is None:
            raise NotFoundError(f"Không có ticket {ticket_id}")
        self.versions[ticket_id] = row.version
        return Case.model_validate(row.doc)

    def insert(self, case: Case) -> None:
        doc = case.model_dump(mode="json")
        ticket = doc["ticket"]
        ticket_id = ticket["ticket_id"]
        params = {
            "ticket_id": ticket_id,
            "status": ticket["status"],
            "department_id": ticket["department_id"],
            "resident_id": ticket["resident_id"],
            "created_at": _created_at(case.ticket.raw.created_at),
            "doc": doc,
        }
        with _db_errors():
            try:
                self.conn.execute(_INSERT_CASE, params)
            except DBAPIError as exc:
                constraint = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
                if _pgcode(exc) == "23505" and constraint == "cases_pkey":
                    raise GuardError(f"Ticket {ticket_id} đã được ingest") from None
                raise
            match = _TICKET_NUMBER.match(ticket_id)
            if match:
                self.conn.execute(
                    text(
                        "select setval('maintops.ticket_number_seq', "
                        "greatest(:n, (select last_value from maintops.ticket_number_seq)), true)"
                    ),
                    {"n": int(match.group(1))},
                )
        self.inserted[ticket_id] = case

    def save(self, case: Case) -> None:
        doc = case.model_dump(mode="json")
        ticket = doc["ticket"]
        ticket_id = ticket["ticket_id"]
        if ticket_id in self.inserted:
            if case is self.inserted[ticket_id]:
                return  # already written by insert in this transaction: nothing to send
            with _db_errors():
                self.conn.execute(
                    _SAVE_NEW,
                    {"doc": doc, "status": ticket["status"], "department_id": ticket["department_id"], "id": ticket_id},
                )
            self.inserted[ticket_id] = case
            return
        if ticket_id not in self.versions:
            raise GuardError(f"Ticket {ticket_id} phải được get_for_update trước khi save")
        with _db_errors():
            result = self.conn.execute(
                _SAVE_LOCKED,
                {
                    "doc": doc,
                    "status": ticket["status"],
                    "department_id": ticket["department_id"],
                    "id": ticket_id,
                    "v": self.versions[ticket_id],
                },
            )
        if result.rowcount != 1:
            raise ConcurrencyError(
                f"Ticket {ticket_id} vừa bị thay đổi bởi thao tác khác; tải lại rồi thử lại", {"ticket_id": ticket_id}
            )
        self.versions[ticket_id] += 1

    def append_log(self, rows: Sequence[AuditEvent | StatusEvent]) -> None:
        if not rows:
            return
        values = []
        for row in rows:
            payload = row.model_dump(mode="json")
            if isinstance(row, AuditEvent):
                values.append(
                    {
                        "kind": "audit",
                        "event_id": row.event_id,
                        "ticket_id": row.ticket_id,
                        "occurred_at": row.timestamp,
                        "run_id": row.run_id,
                        "payload": payload,
                    }
                )
            else:
                values.append(
                    {
                        "kind": "status",
                        "event_id": row.id,
                        "ticket_id": row.ticket_id,
                        "occurred_at": row.created_at,
                        "run_id": None,
                        "payload": payload,
                    }
                )
        with _db_errors():
            self.conn.execute(sa.insert(audit_log_table).values(values))

    def append_notifications(self, rows: Sequence[Notification]) -> None:
        if not rows:
            return
        values = [
            {
                "notification_id": row.notification_id,
                "ticket_id": row.ticket_id,
                "type": row.type,
                "audience": str(row.audience),
                "payload": row.model_dump(mode="json"),
                "created_at": row.created_at,
            }
            for row in rows
        ]
        with _db_errors():
            self.conn.execute(sa.insert(notifications_table).values(values))

    def add_stock(self, item_code: str, qty: float) -> float:
        with _db_errors():
            return self.conn.execute(
                text(
                    "insert into maintops.stock (item_code, qty) values (:c, :q) "
                    "on conflict (item_code) do update set qty = coalesce(maintops.stock.qty, 0) + excluded.qty "
                    "returning qty"
                ),
                {"c": item_code, "q": qty},
            ).scalar_one()

    def take_stock(self, item_code: str, qty: float) -> float | None:
        with _db_errors():
            # One conditional UPDATE: two workers can never both issue the last units (the row lock serialises).
            new = self.conn.execute(
                text(
                    "update maintops.stock set qty = qty - :q "
                    "where item_code = :c and qty is not null and qty >= :q returning qty"
                ),
                {"c": item_code, "q": qty},
            ).scalar()
            if new is not None:
                return new
            current = self.conn.execute(
                text("select qty from maintops.stock where item_code = :c"), {"c": item_code}
            ).scalar()
        if current is None:
            return None
        raise short_stock_error(item_code, current, qty)


# ---------------------------------------------------------------------- repository


_T = TypeVar("_T")


class PostgresRepository:
    def __init__(self, url: str):
        self._engine = sql_engine(url)
        self._read_engine = sql_read_engine(url)
        self._url_host = make_url(url).host
        self._local = threading.local()
        # list() cache (plan 09): ticket_id -> (xmin, validated Case); the Cases are shared and read-only
        self._list_cache: dict[str, tuple[str, Case]] = {}
        self._list_lock = threading.Lock()
        self._list_stats = {"hits": 0, "misses": 0, "calls": 0}

    # ------------------------------------------------------------------ transaction

    @contextmanager
    def transaction(self) -> Iterator[_PgTx]:
        if getattr(self._local, "in_tx", False):
            raise RuntimeError("PostgresRepository: transaction lồng nhau trên cùng thread")
        self._local.in_tx = True
        try:
            with _db_errors(), self._engine.begin() as conn:
                yield _PgTx(conn)
        finally:
            self._local.in_tx = False

    # ------------------------------------------------------------------ reads (own connection: committed data only)

    def _read(self, fn: Callable[[Connection], _T]) -> _T:
        """Run one read on the AUTOCOMMIT engine (plan 12 SPEC-P01). A connection the server dropped (pooler idle
        timeout, restart) is retried exactly once on a new one; any other error is translated as before."""
        for attempt in (0, 1):
            try:
                with self._read_engine.connect() as conn:
                    return fn(conn)
            except DBAPIError as exc:
                if attempt == 0 and exc.connection_invalidated:
                    logger.info("read retried after a dropped connection")
                    continue
                with _db_errors():
                    raise
        raise AssertionError("unreachable")

    def get(self, ticket_id: str) -> Case:
        doc = self._read(
            lambda conn: conn.execute(
                text("select doc from maintops.cases where ticket_id = :id"), {"id": ticket_id}
            ).scalar()
        )
        if doc is None:
            raise NotFoundError(f"Không có ticket {ticket_id}")
        return Case.model_validate(doc)

    def list(self) -> list[Case]:
        """Every ticket, committed state, `collate "C"` order. Only rows whose `xmin` changed since the last call
        travel over the network (plan 09 SPEC-P01); the returned Cases are shared, so callers must not mutate them."""
        with self._list_lock:
            known = dict(self._list_cache)
        ids = list(known)
        rows = self._read(
            lambda conn: conn.execute(_LIST_CHANGED, {"ids": ids, "vs": [known[tid][0] for tid in ids]}).all()
        )
        cache: dict[str, tuple[str, Case]] = {}
        loaded = 0
        for row in rows:  # validate everything before touching the cache: a broken doc leaves it as it was
            if row.doc is None:
                cache[row.ticket_id] = known[row.ticket_id]
            else:
                cache[row.ticket_id] = (row.v, Case.model_validate(row.doc))
                loaded += 1
        with self._list_lock:
            self._list_cache = cache
            stats = self._list_stats
            stats["hits"] += len(cache) - loaded
            stats["misses"] += loaded
            stats["calls"] += 1
            if stats["calls"] % LIST_LOG_EVERY == 0:
                logger.info("list cache hits=%d misses=%d size=%d", stats["hits"], stats["misses"], len(cache))
        return [case for _, case in cache.values()]

    def cache_stats(self) -> dict[str, int]:
        """Counters of the `list()` cache, for tests and logs (not exposed by the API)."""
        with self._list_lock:
            return {
                "hits": self._list_stats["hits"],
                "misses": self._list_stats["misses"],
                "size": len(self._list_cache),
            }

    def count(self) -> int:
        return self._read(lambda conn: conn.execute(text("select count(*) from maintops.cases")).scalar_one())

    def stock_of(self, item_code: str) -> float | None:
        return self._read(
            lambda conn: conn.execute(
                text("select qty from maintops.stock where item_code = :c"), {"c": item_code}
            ).scalar()
        )

    def stock(self) -> dict[str, float | None]:
        rows = self._read(
            lambda conn: conn.execute(text("select item_code, qty from maintops.stock order by item_code")).all()
        )
        return {row.item_code: row.qty for row in rows}

    def run_number(self) -> int:
        return self._read(
            lambda conn: conn.execute(text("select value from maintops.meta where key = 'run_number'")).scalar_one()
        )

    # ------------------------------------------------------------------ test-only inspection (01-CONTRACTS §4.3)

    def version_of(self, ticket_id: str) -> int:
        version = self._read(
            lambda conn: conn.execute(
                text("select version from maintops.cases where ticket_id = :id"), {"id": ticket_id}
            ).scalar()
        )
        if version is None:
            raise NotFoundError(f"Không có ticket {ticket_id}")
        return version

    def log_rows(self) -> list[AuditEvent | StatusEvent]:
        rows = self._read(
            lambda conn: conn.execute(text("select kind, payload from maintops.audit_log order by seq")).all()
        )
        return [
            AuditEvent.model_validate(row.payload) if row.kind == "audit" else StatusEvent.model_validate(row.payload)
            for row in rows
        ]

    def notification_rows(self) -> list[Notification]:
        payloads = self._read(
            lambda conn: conn.execute(text("select payload from maintops.notifications order by seq")).scalars().all()
        )
        return [Notification.model_validate(payload) for payload in payloads]

    # ------------------------------------------------------------------ writes outside a transaction

    def next_ticket_number(self) -> int:
        # nextval is not transactional: one AUTOCOMMIT round trip; a retry after a dropped connection only skips a number
        return self._read(lambda conn: conn.execute(text("select nextval('maintops.ticket_number_seq')")).scalar_one())

    def set_stock(self, item_code: str, qty: float | None) -> None:
        with _db_errors(), self._engine.begin() as conn:
            conn.execute(
                text(
                    "insert into maintops.stock (item_code, qty) values (:c, :q) "
                    "on conflict (item_code) do update set qty = excluded.qty"
                ),
                {"c": item_code, "q": qty},
            )

    def wipe(self, stock: dict[str, float | None]) -> int:
        """Reset everything except `maintops.sessions`. TRUNCATE needs the schema owner (42501 for `maintops_dev`)."""
        with _db_errors(), self._engine.begin() as conn:
            conn.execute(text("truncate maintops.audit_log, maintops.notifications, maintops.cases restart identity"))
            conn.execute(text("delete from maintops.stock"))
            if stock:
                conn.execute(
                    text("insert into maintops.stock (item_code, qty) values (:c, :q)"),
                    [{"c": code, "q": qty} for code, qty in stock.items()],
                )
            conn.execute(text("select setval('maintops.ticket_number_seq', 1, false)"))
            return conn.execute(
                text("update maintops.meta set value = value + 1 where key = 'run_number' returning value")
            ).scalar_one()

    # ------------------------------------------------------------------ leases (one leader across backends)

    @contextmanager
    def _lease(self, key: int) -> Iterator[bool]:
        with _db_errors():
            conn = self._engine.connect()  # its own connection, never the one of a transaction
            try:
                acquired = bool(conn.execute(text("select pg_try_advisory_xact_lock(:k)"), {"k": key}).scalar_one())
            except BaseException:
                conn.close()
                raise
        try:
            yield acquired
        finally:
            try:
                conn.rollback()  # ends the transaction: the lock is released
            except Exception:
                logger.warning("advisory lock release failed; invalidating the connection")
                conn.invalidate()
            finally:
                conn.close()

    def job_lease(self):
        return self._lease(KEY_JOBS)

    def seed_lease(self):
        return self._lease(KEY_SEED)

    # ------------------------------------------------------------------ startup check

    def check(self) -> None:
        try:
            with self._engine.connect() as conn:
                conn.execute(text("select 1"))
                revision = conn.execute(text("select version_num from maintops.alembic_version")).scalar()
        except (OperationalError, InterfaceError) as exc:
            name = type(exc.orig or exc).__name__
            raise RuntimeError(
                f"MO_STORE=postgres: không kết nối được DATABASE_URL (host={self._url_host}) [{name}]"
            ) from None
        except DBAPIError as exc:
            if _pgcode(exc) in ("42P01", "42501", "3F000"):
                raise RuntimeError(
                    f"MO_STORE=postgres: schema maintops chưa sẵn sàng cho user này; chạy: {UPGRADE_COMMAND}"
                ) from None
            raise
        if revision != HEAD_REVISION:
            raise RuntimeError(
                f"schema maintops ở revision {revision}, code cần {HEAD_REVISION}; chạy: {UPGRADE_COMMAND}"
            )
