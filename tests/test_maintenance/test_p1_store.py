"""Plan 06 WP4: JSONB compatibility around the doc-shape marker revision (TESTING-ACCEPTANCE §3.12, 01-CONTRACTS §12).

J-01 old docs (frozen at base 82f01f0) are read by the current model, memory store.
J-02 (pg) old docs inserted straight into maintops.cases are read by get / list / get_for_update.
J-03 HEAD_REVISION is the marker revision and equals the alembic head.
J-04 (pg) a DB at 0002 and code that only knows 0001 refuses to start with the upgrade command.
J-05 the 0002 migration carries no SQL: upgrade() and downgrade() are `pass`.

The pg cases use the `STORES` pattern of test_cr03_store: without --pg only the memory side runs.
"""

import ast
import json
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from src.maintenance.catalog import load_catalog
from src.maintenance.engine import initial_stock
from src.maintenance.models import Case
from src.maintenance.store import postgres
from src.maintenance.store.memory import InMemoryRepository
from src.maintenance.store.postgres import ALEMBIC_INI, HEAD_REVISION, PostgresRepository

FIXTURE = Path(__file__).parent / "data" / "case_pre_p1.json"
MIGRATION = Path(postgres.__file__).parent / "migrations" / "versions" / "0002_p1_doc_shape.py"
MARKER = "0002_p1_doc_shape"
STORES = ["memory", pytest.param("postgres", marks=pytest.mark.pg)]

_INSERT_RAW = text(
    "insert into maintops.cases (ticket_id, status, department_id, resident_id, doc) "
    "values (:ticket_id, :status, :department_id, :resident_id, cast(:doc as jsonb))"
)


def old_docs() -> dict[str, dict]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]


@pytest.fixture(params=STORES)
def repo(request):
    if request.param == "postgres":
        return request.getfixturevalue("pg_repo")  # lazy: without --pg nothing touches a database
    return InMemoryRepository(initial_stock(load_catalog()))


def insert_raw(repo, doc: dict) -> None:
    """Write the doc as an older backend left it: no model in between, straight into the JSONB column."""
    ticket = doc["ticket"]
    params = {
        "ticket_id": ticket["ticket_id"],
        "status": ticket["status"],
        "department_id": ticket["department_id"],
        "resident_id": ticket["resident_id"],
        "doc": json.dumps(doc),
    }
    with repo._engine.begin() as conn:
        conn.execute(_INSERT_RAW, params)


# ---------------------------------------------------------------------- J-01 / J-02


def test_j01_pre_p1_docs_load_and_round_trip_with_the_current_model():
    docs = old_docs()
    assert sorted(docs) == ["SIM-TKT-CLN-001", "SIM-TKT-CLN-004", "SIM-TKT-TEC-003"]
    for ticket_id, doc in docs.items():
        case = Case.model_validate(doc)
        assert case.ticket.ticket_id == ticket_id
        assert Case.model_validate_json(case.model_dump_json()) == case


def test_j02_old_docs_are_readable_by_get_list_and_get_for_update(repo):
    docs = old_docs()
    if isinstance(repo, PostgresRepository):
        for doc in docs.values():
            insert_raw(repo, doc)
    else:  # memory: the same docs go in through the model (no JSONB column to write by hand)
        with repo.transaction() as tx:
            for doc in docs.values():
                tx.insert(Case.model_validate(doc))
    expected = {ticket_id: Case.model_validate(doc) for ticket_id, doc in docs.items()}
    for ticket_id, case in expected.items():
        assert repo.get(ticket_id) == case
    assert {case.ticket.ticket_id: case for case in repo.list()} == expected
    with repo.transaction() as tx:
        for ticket_id, case in expected.items():
            assert tx.get_for_update(ticket_id) == case


# ---------------------------------------------------------------------- J-03 / J-04 / J-05


def test_j03_head_revision_is_the_alembic_head_and_the_marker_is_still_accepted():
    # plan 11 added 0003_material_items (a new table only): the marker stays a revision the code accepts
    assert HEAD_REVISION == "0003_material_items"
    assert postgres.PREVIOUS_REVISIONS[HEAD_REVISION] == MARKER
    assert ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head() == HEAD_REVISION


@pytest.mark.pg
def test_j04_db_at_marker_revision_stops_code_that_only_knows_the_old_one(pg_repo, monkeypatch):
    with pg_repo._engine.connect() as conn:
        assert conn.execute(text("select version_num from maintops.alembic_version")).scalar() == HEAD_REVISION
    pg_repo.check()  # current code: starts
    monkeypatch.setattr(postgres, "HEAD_REVISION", "0001_maintops_initial")  # what pre-plan-06 code carries
    with pytest.raises(RuntimeError, match="upgrade head"):
        pg_repo.check()


def test_j05_marker_migration_has_no_sql_only_pass():
    module = ast.parse(MIGRATION.read_text(encoding="utf-8"))
    assignments = {
        node.targets[0].id: ast.literal_eval(node.value)
        for node in module.body
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name)
    }
    assert assignments["revision"] == MARKER
    assert assignments["down_revision"] == "0001_maintops_initial"
    functions = {node.name: node for node in module.body if isinstance(node, ast.FunctionDef)}
    assert set(functions) == {"upgrade", "downgrade"}
    for node in functions.values():
        statements = node.body[1:] if ast.get_docstring(node) is not None else node.body
        assert [type(stmt) for stmt in statements] == [ast.Pass], node.name
    module_doc = ast.get_docstring(module) or ""
    assert "plan 06 marker: cases.doc may hold P1/agent fields; older code must refuse to start" in module_doc
