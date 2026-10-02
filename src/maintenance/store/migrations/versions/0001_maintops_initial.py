"""maintops initial schema: cases (JSONB doc), append-only ledgers, stock, meta, sessions, role maintops_dev.

Revision ID: 0001_maintops_initial
Revises:
Create Date: 2026-10-02

Statements are fixed by 01-CONTRACTS §7.3. No app imports, no `%` in SQL.
"""

from alembic import op

revision = "0001_maintops_initial"
down_revision = None
branch_labels = None
depends_on = None

UPGRADE = [
    """create table maintops.cases (
        ticket_id     text primary key check (ticket_id ~ '^SIM-TKT-[A-Z0-9-]+$'),
        version       integer not null default 1 check (version >= 1),
        status        text not null,
        department_id text,
        resident_id   text not null,
        created_at    timestamptz,
        updated_at    timestamptz not null default now(),
        doc           jsonb not null,
        constraint cases_doc_matches check (
            doc->'ticket'->>'ticket_id' = ticket_id
            and doc->'ticket'->>'status' = status
            and doc->'ticket'->>'resident_id' = resident_id
            and (doc->'ticket'->>'department_id') is not distinct from department_id)
    )""",
    "create index cases_status_idx on maintops.cases (status)",
    "create index cases_resident_idx on maintops.cases (resident_id)",
    """create table maintops.audit_log (
        seq         bigint generated always as identity primary key,
        kind        text not null check (kind in ('audit', 'status')),
        event_id    text not null unique,
        ticket_id   text not null references maintops.cases (ticket_id),
        occurred_at timestamptz not null,
        run_id      text,
        payload     jsonb not null,
        recorded_at timestamptz not null default now()
    )""",
    "create index audit_log_ticket_idx on maintops.audit_log (ticket_id, seq)",
    """create table maintops.notifications (
        seq             bigint generated always as identity primary key,
        notification_id text not null unique,
        ticket_id       text not null references maintops.cases (ticket_id),
        type            text not null,
        audience        text not null,
        payload         jsonb not null,
        created_at      timestamptz not null
    )""",
    "create index notifications_ticket_idx on maintops.notifications (ticket_id, seq)",
    """create function maintops.forbid_change() returns trigger language plpgsql as
       $$ begin raise exception using message = tg_table_schema || '.' || tg_table_name || ' is append-only'; end $$""",
    """create trigger audit_log_append_only before update or delete on maintops.audit_log
       for each row execute function maintops.forbid_change()""",
    """create trigger notifications_append_only before update or delete on maintops.notifications
       for each row execute function maintops.forbid_change()""",
    "create table maintops.stock (item_code text primary key, qty double precision check (qty is null or qty >= 0))",
    "create table maintops.meta (key text primary key, value bigint not null)",
    "insert into maintops.meta (key, value) values ('run_number', 0)",
    "create sequence maintops.ticket_number_seq minvalue 1 start with 1",
    """create table maintops.sessions (
        token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
        username   text not null check (username ~ '^[a-z0-9_.-]{3,32}$'),
        created_at timestamptz not null default now(),
        expires_at timestamptz not null
    )""",
    "create index sessions_expires_idx on maintops.sessions (expires_at)",
    """do $$ begin
         if not exists (select from pg_roles where rolname = 'maintops_dev') then
           create role maintops_dev nologin;
         end if;
       end $$""",
    "grant usage on schema maintops to maintops_dev",
    "grant select on maintops.alembic_version to maintops_dev",
    "grant select, insert, update on maintops.cases to maintops_dev",
    "grant select, insert on maintops.audit_log, maintops.notifications to maintops_dev",
    "grant select, insert, update on maintops.stock to maintops_dev",
    "grant select on maintops.meta to maintops_dev",
    "grant select, insert, delete on maintops.sessions to maintops_dev",
    "grant usage, select, update on sequence maintops.ticket_number_seq to maintops_dev",
]

# The schema `maintops` (it holds alembic_version) and the role stay: dropping the schema here breaks Alembic's own
# version bookkeeping (01-CONTRACTS §7.3).
DOWNGRADE = [
    "drop table if exists maintops.sessions, maintops.notifications, maintops.audit_log,"
    " maintops.cases, maintops.stock, maintops.meta",
    "drop sequence if exists maintops.ticket_number_seq",
    "drop function if exists maintops.forbid_change()",
]


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)
