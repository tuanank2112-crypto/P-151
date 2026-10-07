"""plan 06 marker: cases.doc may hold P1/agent fields; older code must refuse to start.

Revision ID: 0002_p1_doc_shape
Revises: 0001_maintops_initial
Create Date: 2026-10-05

No DDL (01-CONTRACTS §12.3): the JSONB column takes the new fields as they are. The revision only moves the number
so that code which does not know it fails `PostgresRepository.check()` instead of failing mid-request on a new doc.
`downgrade` only moves the number back; it does NOT make P1 docs readable by older code.
"""

revision = "0002_p1_doc_shape"
down_revision = "0001_maintops_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
