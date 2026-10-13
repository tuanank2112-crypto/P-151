"""plan 20 follow-up: which waiting tickets a restock alert is about (one new column, default empty).

Revision ID: 0006_stock_alert_tickets
Revises: 0005_stock_alerts
Create Date: 2026-10-14

Older code never reads `maintops.stock_alerts`, so adding a column with a default does not require stopping them.
No app imports, no `%` in SQL.
"""

from alembic import op

revision = "0006_stock_alert_tickets"
down_revision = "0005_stock_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("alter table maintops.stock_alerts add column ticket_ids text[] not null default '{}'")


def downgrade() -> None:
    op.execute("alter table maintops.stock_alerts drop column if exists ticket_ids")
