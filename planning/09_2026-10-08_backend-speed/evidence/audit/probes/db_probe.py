"""Read-only probe of the shared DB: round trip, full-list cost, doc sizes (plan 09 audit). Run from the repo root."""
import statistics
import sys
import time

sys.path.insert(0, ".")
from sqlalchemy import text  # noqa: E402

from src.config import get_settings  # noqa: E402
from src.maintenance.store.postgres import sql_engine  # noqa: E402

e = sql_engine(get_settings().database_url)
with e.connect() as c:

    def t(q, n=7):
        ms = []
        for _ in range(n):
            s = time.perf_counter()
            c.execute(text(q)).all()
            ms.append((time.perf_counter() - s) * 1000)
        return f"median={statistics.median(ms):6.0f}ms min={min(ms):6.0f} max={max(ms):6.0f}"

    print("select 1                              ", t("select 1"))
    print("select doc (all, = repo.list())       ", t('select doc from maintops.cases order by ticket_id collate "C"'))
    print("select ticket_id, xmin (all)          ", t("select ticket_id, xmin::text from maintops.cases"))
    print("select doc - audit - notifications    ", t("select doc - 'audit' - 'notifications' from maintops.cases"))
    r = c.execute(text("select count(*), sum(length(doc::text)), max(length(doc::text)) from maintops.cases")).one()
    print(f"cases={r[0]} json_text_total={r[1] / 1024:.0f}KB max_doc={r[2] / 1024:.0f}KB")
    rows = c.execute(
        text("select k, sum(length(v::text)) s from maintops.cases, jsonb_each(doc) j(k, v) group by k order by s desc")
    ).all()
    print("doc keys by size:", ", ".join(f"{k}={s / 1024:.0f}KB" for k, s in rows))
