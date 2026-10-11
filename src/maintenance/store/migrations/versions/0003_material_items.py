"""plan 11: materials added at run time (table only; no existing table changes).

Revision ID: 0003_material_items
Revises: 0002_p1_doc_shape
Create Date: 2026-10-09

`maintops.material_items` holds items that staff add outside the YAML catalog (`SIM-MAT-X-<8 hex>`). Older code never
reads the table, so applying this revision does not require stopping older backends on a shared database. The new
code accepts a database still at 0002 while MO_CUSTOM_MATERIALS is off. No app imports, no `%` in SQL.
"""

from alembic import op

revision = "0003_material_items"
down_revision = "0002_p1_doc_shape"
branch_labels = None
depends_on = None

UPGRADE = [
    """create table maintops.material_items (
        item_code  text primary key check (item_code ~ '^SIM-MAT-X-[A-Z0-9]+$'),
        item_name  text not null check (length(item_name) between 2 and 80),
        unit       text not null check (length(unit) between 1 and 20),
        created_by text not null,
        created_at timestamptz not null default now()
    )""",
    "grant select, insert on maintops.material_items to maintops_dev",
]

# `delete` is granted to the owner only: the app never removes a material (reset uses the owner, like TRUNCATE).
DOWNGRADE = ["drop table if exists maintops.material_items"]


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)
