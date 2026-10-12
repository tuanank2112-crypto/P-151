"""TESTING §8.5 part 1 (NEW code, HEAD): upgrade p151_wp12_test to head and write P1/Agent documents into it."""

import os
import sys

from common import RESIDENT, mirror, out  # noqa: F401 (common puts the repo root on sys.path)
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from src.maintenance.agent.agent import ReasoningAgent
from src.maintenance.catalog import load_catalog, load_lexicon
from src.maintenance.engine import MaintenanceEngine
from src.maintenance.store.postgres import HEAD_REVISION, PostgresRepository
from tests.test_maintenance.helpers import BQL, MONDAY_9AM, Clock

URL = os.environ["MO_TEST_DATABASE_URL"]
assert URL.endswith("/p151_wp12_test") and "127.0.0.1:55433" in URL, "only the local docker WP12 test database"
cfg = Config("src/maintenance/store/alembic.ini")
cfg.attributes["database_url"] = URL
command.upgrade(cfg, "head")
with create_engine(URL).begin() as conn:
    for statement in (
        "truncate maintops.audit_log, maintops.notifications, maintops.cases, maintops.sessions restart identity",
        "delete from maintops.stock",
        "update maintops.meta set value = 0 where key = 'run_number'",
        "select setval('maintops.ticket_number_seq', 1, false)",
    ):
        conn.execute(text(statement))
    revision = conn.execute(text("select version_num from maintops.alembic_version")).scalar()
out("alembic_version after upgrade:", revision, "| code HEAD_REVISION:", HEAD_REVISION)

clock = Clock(MONDAY_9AM)
repo = PostgresRepository(URL)
repo.check()
out("new code check(): OK")
agent = ReasoningAgent(mirror(), catalog=load_catalog(), lexicon=load_lexicon(), model_label="probe", clock=clock)
engine = MaintenanceEngine(clock=clock, agent=agent, repo=repo)
engine.reset(with_fixtures=False)
root = engine.receive("Hành lang tầng 7 tòa S2 nhiều rác, đèn cũng không sáng", resident_id=RESIDENT)
clock.advance(minutes=5)
emergency = engine.receive("Hầm xe tầng B1 tòa S1 có lửa ở thùng rác", resident_id=RESIDENT)
clock.advance(minutes=5)
follow = engine.create_follow_up(emergency.ticket.ticket_id, BQL, note="đã dập lửa, cần dọn")
with create_engine(URL).connect() as conn:
    rows = conn.execute(text("select ticket_id, doc from maintops.cases order by ticket_id")).all()
for ticket_id, doc in rows:
    t = doc["ticket"]
    p1_keys = sorted(k for k in ("split_children", "split_from", "split_category", "follow_up_of", "duplicate_count",
                                 "merged_children", "wrong_department_return_count") if k in t)
    out(ticket_id, "status", t["status"], "| agent_decision:", (doc.get("agent_decision") or {}).get("source"),
        "| P1 ticket keys:", p1_keys, "| split_children", t.get("split_children"), "| follow_up_of", t.get("follow_up_of"))
out(f"RESULT cases={len(rows)} revision={revision}")
sys.exit(0 if revision == HEAD_REVISION == "0002_p1_doc_shape" and rows else 1)
