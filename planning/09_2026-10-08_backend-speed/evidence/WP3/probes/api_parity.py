"""Plan 09 G5 (read-only): every list endpoint returns the same JSON with the cache + lookup as with the old reads.

Old = `select doc` of every row on each list() and resident views reading linked tickets one by one (no lookup).
Runs against DATABASE_URL from .env (the shared DB): only SELECTs. Run from the repo root.
"""

import json
import os
import sys

os.environ["MO_JOBS_ENABLED"] = "false"
sys.path.insert(0, ".")
from sqlalchemy import text  # noqa: E402

from src.api.routers import maintenance as m  # noqa: E402
from src.maintenance.models import Case  # noqa: E402
from src.maintenance.store.postgres import _db_errors  # noqa: E402
from src.maintenance.views import resident_view  # noqa: E402

engine = m.get_engine()
repo = engine.repo
now = engine.clock()
engine.clock = lambda: now  # both sides see the same moment (overdue, eta)


def old_list():
    with _db_errors(), repo._engine.connect() as conn:
        docs = conn.execute(text('select doc from maintops.cases order by ticket_id collate "C"')).scalars().all()
    return [Case.model_validate(doc) for doc in docs]


def dump(rows):
    return json.dumps([r.model_dump(mode="json") for r in rows], sort_keys=True, ensure_ascii=False)


new_list = repo.list
actors = sorted({a for a in engine.catalog.actors} if isinstance(engine.catalog.actors, dict) else
                {a.actor_id for a in engine.catalog.actors})
results = []
for actor in actors:
    role = engine.catalog.actor_role(actor)
    if role == "RESIDENT":
        def call(lookup_on, actor=actor):
            snapshot = list(engine.cases.values())
            lookup = {c.ticket.ticket_id: c for c in snapshot}
            own = sorted((c for c in snapshot if c.ticket.resident_id == actor),
                         key=lambda c: c.ticket.raw.created_at, reverse=True)
            if lookup_on:
                return m.resident_list(actor, engine)
            return [resident_view(engine, c, now) for c in own]
        name = f"GET /resident/tickets as {actor}"
    elif role == "BQL":
        call = lambda lookup_on, actor=actor: m.bql_list(actor, engine, None, None, None, None, None, None, None)  # noqa: E731
        name = f"GET /bql/tickets as {actor}"
    elif role in m.STAFF:
        call = lambda lookup_on, actor=actor: m.list_tickets(actor, engine)  # noqa: E731
        name = f"GET /mo/tickets as {actor}"
    else:
        continue
    repo.list = old_list
    before = dump(call(False))
    repo.list = new_list
    after = dump(call(True))
    after_warm = dump(call(True))
    same = before == after == after_warm
    results.append(same)
    print(f"{'SAME' if same else 'DIFF'}  {name:55s} rows={len(json.loads(before))} bytes={len(before)}")
print(f"cache: {repo.cache_stats()}")
print(f"RESULT: {sum(results)}/{len(results)} identical")
sys.exit(0 if all(results) else 1)
