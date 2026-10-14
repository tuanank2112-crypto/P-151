"""plan 20: department alerts when the warehouse restocks a material that had run out (one new table).

Revision ID: 0005_stock_alerts
Revises: 0004_portal_extras
Create Date: 2026-10-14

`maintops.stock_alerts` is append-only (only the two `acknowledged_*` columns are set, once). It is separate from
`maintops.notifications` because that outbox needs a ticket. Older code never reads the table, so applying this
revision does not require stopping them; the new code accepts a database still at 0004 while MO_STOCK_ALERTS is off.
No app imports, no `%` in SQL.
"""

from alembic import op

revision = "0005_stock_alerts"
down_revision = "0004_portal_extras"
branch_labels = None
depends_on = None

UPGRADE = [
    """create table maintops.stock_alerts (
        alert_id        text primary key,
        item_code       text not null,
        item_name       text not null,
        unit            text,
        department_id   text not null,
        qty_added       double precision not null check (qty_added > 0),
        qty_before      double precision not null,
        qty_after       double precision not null,
        received_by     text not null,
        created_at      timestamptz not null,
        acknowledged_by text,
        acknowledged_at timestamptz,
        check ((acknowledged_by is null) = (acknowledged_at is null))
    )""",
    """create index stock_alerts_dept_unread on maintops.stock_alerts (department_id, created_at desc)
        where acknowledged_at is null""",
    "grant select, insert, update on maintops.stock_alerts to maintops_dev",
]

DOWNGRADE = [
    "drop table if exists maintops.stock_alerts",
]


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)
