"""plan 11: staff assignments and rating tags/comments (two new tables; no existing table changes).

Revision ID: 0004_portal_extras
Revises: 0003_material_items
Create Date: 2026-10-09

`maintops.assignments` records which staff member a department gave a ticket to, and `maintops.rating_details` the
tags and comment a resident left with a rating. Neither belongs in the ticket document (`Ticket.assignee_id` stays
None and the document keeps the shape older backends read), and older code never reads these tables, so applying
this revision does not require stopping them. The new code accepts a database still at 0003 while MO_PORTAL_EXTRAS is
off. No app imports, no `%` in SQL.
"""

from alembic import op

revision = "0004_portal_extras"
down_revision = "0003_material_items"
branch_labels = None
depends_on = None

UPGRADE = [
    """create table maintops.assignments (
        ticket_id   text primary key,
        staff_id    text not null,
        assigned_by text not null,
        assigned_at timestamptz not null
    )""",
    """create table maintops.rating_details (
        ticket_id  text primary key,
        tags       text[] not null default '{}',
        comment    text not null default '' check (length(comment) <= 500),
        created_at timestamptz not null
    )""",
    "grant select, insert, update on maintops.assignments to maintops_dev",
    "grant select, insert on maintops.rating_details to maintops_dev",
]

# `delete` is granted to the owner only: the app never removes a row (reset uses the owner, like TRUNCATE).
DOWNGRADE = [
    "drop table if exists maintops.rating_details",
    "drop table if exists maintops.assignments",
]


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)
