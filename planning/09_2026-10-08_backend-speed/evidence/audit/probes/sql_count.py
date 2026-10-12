"""Read-only: SQL count + time per list handler, in-process against DATABASE_URL (plan 09 audit). Run from repo root."""
import cProfile, pstats, io, time, collections, os, sys
os.environ["MO_JOBS_ENABLED"] = "false"
sys.path.insert(0, os.getcwd())
from sqlalchemy import event
import sqlalchemy as sa
from src.api.routers import maintenance as m
from src.maintenance.store import postgres as pg
engine = m.get_engine()
sql = collections.Counter(); sqltime = [0.0]
eng = pg.sql_engine(m.get_settings().database_url)
@event.listens_for(eng, "before_cursor_execute")
def b(conn, cur, stmt, params, ctx, many): ctx._t = time.perf_counter()
@event.listens_for(eng, "after_cursor_execute")
def a(conn, cur, stmt, params, ctx, many):
    sql[" ".join(stmt.split())[:70]] += 1; sqltime[0] += time.perf_counter() - ctx._t
def run(label, fn):
    sql.clear(); sqltime[0] = 0
    pr = cProfile.Profile(); t = time.perf_counter(); pr.enable(); fn(); pr.disable(); total = (time.perf_counter() - t) * 1000
    print(f"\n=== {label}: total {total:.0f}ms, SQL {sum(sql.values())} queries / {sqltime[0]*1000:.0f}ms")
    for q, n in sql.most_common(5): print(f"   {n:4d}x {q}")
    s = io.StringIO(); pstats.Stats(pr, stream=s).sort_stats("cumulative").print_stats(r"src[\/]", 14); 
    print("\n".join(l for l in s.getvalue().splitlines() if "src" in l)[:2500])
res = "SIM-ACTOR-RESIDENT-01"
run("resident_list", lambda: m.resident_list(res, engine))
run("list_tickets bptn", lambda: m.list_tickets("SIM-ACTOR-BPTN-01", engine))
run("bql_list", lambda: m.bql_list("SIM-ACTOR-BQL-01", engine, None, None, None, None, None, None, None))
tid = next(iter(engine.cases.keys()))
run("read_events (1 ticket)", lambda: m.read_events(tid, "SIM-ACTOR-BPTN-01", engine))
run("warehouse stock_levels", lambda: engine.stock_levels("SIM-ACTOR-WAREHOUSE-01"))
