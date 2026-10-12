"""Day03-bis core harness (copy of d3-03 + asset/dup cases): in-process TestClient, isolated env. Usage: python harness.py s01|s02|s03|s04
Writes machine output to evidence/d3-03/<case>.txt (+ <case>-exit.txt). Passwords/tokens are never logged."""

import os
import sys
import json
import datetime as dt
from pathlib import Path

# Force isolation BEFORE importing the app (do not trust .env)
os.environ.pop("DATABASE_URL", None)
os.environ.update(
    MO_STORE="memory", LLM_MODE="mock", MO_PHOTO_STORE="local", APP_ENV="development",
    MO_ALLOW_RESET="false", MO_JOBS_ENABLED="false",
)
sys.stdout.reconfigure(encoding="utf-8")
from fastapi.testclient import TestClient  # noqa: E402
from src.main import app  # noqa: E402
from src.api.routers.maintenance import get_engine  # noqa: E402

OUT = Path(__file__).parent
API = "/api/v1"
case = sys.argv[1]
log = open(OUT / f"{case}.txt", "w", encoding="utf-8")
checks: list[dict] = []


def now() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def w(s: str) -> None:
    log.write(s + "\n")


def stock(item: str):
    """Authoritative simulated stock, read-only from the in-process repo (no stock GET endpoint exists)."""
    return get_engine().repo.stock_of(item)


def run() -> None:
    with TestClient(app) as c:
        tokens: dict[str, str] = {}
        actors: dict[str, str] = {}
        r = c.get("/health")
        w(f"## [{now()}] GET /health -> {r.status_code} {r.text}")
        env = {k: os.environ[k] for k in ("MO_STORE", "LLM_MODE", "MO_PHOTO_STORE", "APP_ENV", "MO_ALLOW_RESET", "MO_JOBS_ENABLED")}
        w(f"## forced env: {json.dumps(env)}")
        from src.config import get_settings
        s = get_settings()
        cfg = dict(mo_store=s.mo_store, llm_mode=s.llm_mode, mo_photo_store=s.mo_photo_store, app_env=s.app_env, mo_allow_reset=s.mo_allow_reset)
        w(f"## effective settings: {json.dumps(cfg)}")
        assert r.json() == {"status": "ok", "env": "development"} and cfg == dict(
            mo_store="memory", llm_mode="mock", mo_photo_store="local", app_env="development", mo_allow_reset=False
        ), "BLOCKED: isolated config not confirmed"
        pw = c.get(f"{API}/auth/demo-accounts").json()["shared_test_password"]

        def login(user: str) -> None:
            r = c.post(f"{API}/auth/login", json={"username": user, "password": pw})
            body = r.json()
            tokens[user] = body["access_token"]
            actors[user] = body["user"]["actor_id"]
            w(f"## [{now()}] POST /auth/login user={user} body={{password:<redacted>}} -> {r.status_code} role={body['user']['role']} actor={body['user']['actor_id']} token=<redacted>")

        def call(user: str, method: str, path: str, body=None, label: str = ""):
            if user not in tokens:
                login(user)
            hdr = {"Authorization": "Bearer <redacted>"}
            ts = now()
            r = c.request(method, API + path, json=body, headers={"Authorization": f"Bearer {tokens[user]}"})
            try:
                data = r.json()
            except Exception:
                data = r.text
            w(f"\n=== [{ts}] {label}\nactor={user} ({actors[user]})\nREQUEST {method} {API}{path} headers={json.dumps(hdr)} body={json.dumps(body, ensure_ascii=False)}\nRESPONSE {r.status_code}")
            if isinstance(data, dict) and "ticket" in data:
                t = data["ticket"]
                summ = dict(status=t["status"], blocker=t.get("blocker"), department_id=t.get("department_id"), flags=t.get("flags"),
                            assignee_id=t.get("assignee_id"), draft_exists=data.get("draft") is not None,
                            material_lines=[(m["item_code"], m["planned_qty"], m["simulated_stock_qty"], m["material_stock_status"]) for m in data["material_lines"]])
                w("SUMMARY " + json.dumps(summ, ensure_ascii=False, default=str))
            w("BODY " + json.dumps(data, ensure_ascii=False, default=str))
            return r, data

        def full(user: str, t: str, label: str):
            """GET ticket, events, audit."""
            r, d = call(user, "GET", f"/mo/tickets/{t}", label=f"{label} / GET ticket")
            call(user, "GET", f"/mo/tickets/{t}/events", label=f"{label} / GET events")
            call(user, "GET", f"/mo/tickets/{t}/audit", label=f"{label} / GET audit")
            return r, d

        def chk(name: str, expected, actual) -> bool:
            ok = expected == actual
            checks.append(dict(name=name, expected=expected, actual=actual, ok=ok))
            w(f"CHECK [{now()}] {name}: expected={json.dumps(expected, default=str, ensure_ascii=False)} actual={json.dumps(actual, default=str, ensure_ascii=False)} -> {'OK' if ok else 'MISMATCH'}")
            return ok

        def state(d) -> dict:
            t = d["ticket"]
            b = t.get("blocker")
            return dict(status=t["status"], reason=(b or {}).get("code"), owner=(b or {}).get("owner_role"),
                        department_id=t.get("department_id"), draft=d.get("draft") is not None, assignee_id=t.get("assignee_id"))

        CASES[case](c, call, full, chk, state, stock, w)
    log.write(f"\nCHECKS_SUMMARY {json.dumps(checks, ensure_ascii=False, default=str)}\n")


# ---------------------------------------------------------------- cases
def s01(c, call, full, chk, state, stock, w):
    T, I = "SIM-TKT-TEC-001", "SIM-MAT-LAMP-01"
    w(f"# STOCK-01 fixture {T} planned {I} qty 1 (catalog stock 5, sufficient)")
    w(f"STOCK before {I} = {stock(I)}")
    r, d = full("qa01", T, "STOCK-01 QA")
    chk("http", 200, r.status_code)
    s = state(d)
    chk("status ROUTED / blocker null / dept TECHNICAL / draft / assignee null", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), s)
    chk("material_stock_status SUFFICIENT, stock>=planned", [(I, 1.0, 5.0, "SUFFICIENT")], [(m["item_code"], m["planned_qty"], m["simulated_stock_qty"], m["material_stock_status"]) for m in d["material_lines"]])
    chk("no STOCK_CHECK_ON_ACCEPT flag", [], d["ticket"]["flags"])
    chk("audit has check_material_stock then route", True, "CHECK_MATERIAL_STOCK" in json.dumps(d["audit"]).upper())
    r2, _ = call("bptn01", "GET", f"/mo/tickets/{T}", label="STOCK-01 BPTN read")
    chk("BPTN read 200", 200, r2.status_code)
    w(f"STOCK after {I} = {stock(I)}")
    chk("stock unchanged", 5.0, stock(I))


def s02(c, call, full, chk, state, stock, w):
    T, I = "SIM-TKT-TEC-003", "SIM-MAT-LAMP-02"
    w(f"STOCK before {I} = {stock(I)}")
    r, d = full("qa01", T, "STOCK-02 QA read")
    chk("http", 200, r.status_code)
    chk("ON_HOLD/WAITING_MATERIAL/owner WAREHOUSE/dept null/draft null", dict(status="ON_HOLD", reason="WAITING_MATERIAL", owner="WAREHOUSE", department_id=None, draft=False, assignee_id=None), state(d))
    chk("resume_step", 6, (d["ticket"]["blocker"] or {}).get("resume_step"))
    chk("planned LAMP-02 qty2 stock0 INSUFFICIENT", [(I, 2.0, 0.0, "INSUFFICIENT")], [(m["item_code"], m["planned_qty"], m["simulated_stock_qty"], m["material_stock_status"]) for m in d["material_lines"]])
    r, _ = call("bptn01", "GET", f"/mo/tickets/{T}", label="STOCK-02 BPTN read"); chk("BPTN read 200", 200, r.status_code)
    r, dk = call("kho01", "GET", f"/mo/tickets/{T}", label="STOCK-02 WAREHOUSE read"); chk("WAREHOUSE read 200", 200, r.status_code)
    r, _ = call("kythuat01", "POST", f"/mo/tickets/{T}/accept", label="STOCK-02 dept accept while ON_HOLD (must be refused)")
    chk("accept refused (4xx)", True, 400 <= r.status_code < 500)
    r, d2 = call("qa01", "POST", f"/mo/tickets/{T}/resume", label="STOCK-02 QA resume with stock=0")
    chk("resume http 200", 200, r.status_code)
    chk("still ON_HOLD/WAITING_MATERIAL, dept null, draft null", dict(status="ON_HOLD", reason="WAITING_MATERIAL", owner="WAREHOUSE", department_id=None, draft=False, assignee_id=None), state(d2))
    r, d3 = call("qa01", "POST", f"/mo/tickets/{T}/resume", label="STOCK-02 QA resume again (retry)")
    chk("second resume still ON_HOLD", "ON_HOLD", d3["ticket"]["status"])
    w(f"STOCK after {I} = {stock(I)}")
    chk("stock unchanged by resume", 0.0, stock(I))
    full("qa01", T, "STOCK-02 QA final")


def s03(c, call, full, chk, state, stock, w):
    T, I = "SIM-TKT-TEC-003", "SIM-MAT-LAMP-02"
    p = f"/mo/warehouse/stock/{I}"
    b0 = stock(I); w(f"STOCK before#0 {I} = {b0}")
    r, d = full("qa01", T, "STOCK-03 initial")
    chk("initial ON_HOLD", "ON_HOLD", d["ticket"]["status"])
    # negatives first (must not change stock)
    r, _ = call("bptn01", "POST", p, {"qty": 1}, label="STOCK-03 neg: BPTN receives stock (wrong role)"); chk("wrong role 403", 403, r.status_code)
    r, _ = call("kho01", "POST", p, {"qty": 0}, label="STOCK-03 neg: qty=0"); chk("qty=0 422", 422, r.status_code)
    r, _ = call("kho01", "POST", "/mo/warehouse/stock/SIM-MAT-NOPE-99", {"qty": 1}, label="STOCK-03 neg: unknown item"); chk("unknown item 404", 404, r.status_code)
    chk("stock unchanged after negatives", b0, stock(I))
    # receipt 1
    before1 = stock(I); w(f"STOCK before#1 {I} = {before1}")
    r, lst = call("kho01", "POST", p, {"qty": 1}, label="STOCK-03 receipt #1 qty=1")
    after1 = stock(I); w(f"STOCK after#1 {I} = {after1}")
    chk("receipt1 200", 200, r.status_code)
    chk("stock before->after #1", [0.0, 1.0], [before1, after1])
    r, d1 = full("qa01", T, "STOCK-03 QA read after #1")
    chk("after #1 still ON_HOLD/WAITING_MATERIAL, dept null, draft null (not dispatched)", dict(status="ON_HOLD", reason="WAITING_MATERIAL", owner="WAREHOUSE", department_id=None, draft=False, assignee_id=None), state(d1))
    # receipt 2
    before2 = stock(I); w(f"STOCK before#2 {I} = {before2}")
    r, lst2 = call("kho01", "POST", p, {"qty": 1}, label="STOCK-03 receipt #2 qty=1")
    after2 = stock(I); w(f"STOCK after#2 {I} = {after2}")
    chk("receipt2 200", 200, r.status_code)
    chk("stock before->after #2", [1.0, 2.0], [before2, after2])
    r, d2 = full("qa01", T, "STOCK-03 QA read after #2")
    chk("after #2 ROUTED/blocker null/dept TECHNICAL/draft", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d2))
    aud = d2["audit"]
    acts = [a.get("action") for a in aud]
    w(f"AUDIT actions in order: {json.dumps(acts, ensure_ascii=False)}")
    w(f"AUDIT detail (lookup/stock/route rows): " + json.dumps([a for a in aud if str(a.get('action')).upper() in ("LOOKUP_ASSET", "CHECK_MATERIAL_STOCK", "ROUTE_TO_DEPARTMENT", "RUN_PIPELINE")], ensure_ascii=False, default=str))
    up = [str(a).upper() for a in acts]
    def idx(k, start=0):
        for i in range(start, len(up)):
            if k in up[i]:
                return i
        return -1
    # last occurrence order after first receipt: lookup -> stock -> route
    last_lookup = max(i for i, a in enumerate(up) if "LOOKUP_ASSET" in a)
    last_stock = max(i for i, a in enumerate(up) if "CHECK_MATERIAL_STOCK" in a)
    chk("audit last lookup_asset < last check_material_stock (rerun from asset)", True, last_lookup < last_stock)
    chk("returned list from receipt #2 has this ticket", [T], [x["ticket"]["ticket_id"] for x in lst2])
    # resume again
    r, d3 = call("qa01", "POST", f"/mo/tickets/{T}/resume", label="STOCK-03 QA resume after ROUTED")
    chk("resume keeps ROUTED, no duplicate dispatch", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d3))
    n_disp_before = sum(1 for e in d2["events"] if e.get("to_status") == "ROUTED")
    n_disp_after = sum(1 for e in d3["events"] if e.get("to_status") == "ROUTED")
    chk("ROUTED events count unchanged", n_disp_before, n_disp_after)
    chk("events length unchanged by resume", len(d2["events"]), len(d3["events"]))
    chk("final stock", 2.0, stock(I))
    full("qa01", T, "STOCK-03 QA final")
    call("qa01", "GET", f"/mo/tickets/{T}/notifications", label="STOCK-03 notifications")


def s04(c, call, full, chk, state, stock, w):
    T, I = "SIM-TKT-TEC-006", "SIM-MAT-STARTER-01"
    w(f"STOCK before {I} = {stock(I)}  (None = UNKNOWN)")
    r, d = full("qa01", T, "STOCK-04 QA read")
    chk("http", 200, r.status_code)
    chk("stock unknown (catalog null)", None, stock(I))
    chk("ROUTED/null/dept TECHNICAL/draft", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d))
    chk("flags has STOCK_CHECK_ON_ACCEPT", ["STOCK_CHECK_ON_ACCEPT"], [str(f.value if hasattr(f, 'value') else f) for f in d["ticket"]["flags"]])
    chk("material line UNKNOWN", [(I, 1.0, None, "UNKNOWN")], [(m["item_code"], m["planned_qty"], m["simulated_stock_qty"], m["material_stock_status"]) for m in d["material_lines"]])
    r, dd = call("kythuat01", "GET", f"/mo/tickets/{T}", label="STOCK-04 department technical read (acceptor)")
    chk("department sees flag", True, "STOCK_CHECK_ON_ACCEPT" in json.dumps(dd["ticket"]["flags"]))
    r, da = call("kythuat01", "POST", f"/mo/tickets/{T}/accept", label="STOCK-04 department accepts (flag present)")
    chk("accept 200 -> IN_PROGRESS (no stock gate at accept)", [200, "IN_PROGRESS"], [r.status_code, da["ticket"]["status"]])
    w(f"FLAGS after accept = {da['ticket']['flags']}")
    w(f"STOCK after {I} = {stock(I)}")


def a12(c, call, full, chk, state, stock, w):
    w("# ASSET-01 fixture SIM-TKT-TEC-001 / ASSET-02 fixture SIM-TKT-TEC-002 (read + denied accept)")
    r, d = full("qa01", "SIM-TKT-TEC-001", "ASSET-01 QA")
    chk("A01 http", 200, r.status_code)
    chk("A01 ROUTED/null/DEPT_TECHNICAL/draft/assignee null", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d))
    chk("A01 draft asset_id", "SIM-ASSET-LIGHT-001", (d.get("draft") or {}).get("asset_id"))
    r, d = full("bptn01", "SIM-TKT-TEC-002", "ASSET-02 BPTN")
    chk("A02 http", 200, r.status_code)
    chk("A02 VERIFYING/ASSET_UNCLEAR/BPTN/dept null/draft null/assignee null", dict(status="VERIFYING", reason="ASSET_UNCLEAR", owner="BPTN", department_id=None, draft=False, assignee_id=None), state(d))
    r, _ = call("kythuat01", "POST", "/mo/tickets/SIM-TKT-TEC-002/accept", label="ASSET-02 dept accept (must be refused)")
    chk("A02 dept accept refused 4xx", True, 400 <= r.status_code < 500)
    r, _ = call("bptn01", "POST", "/mo/tickets/SIM-TKT-TEC-002/accept", label="ASSET-02 BPTN accept (must be refused)")
    chk("A02 bptn accept refused 4xx", True, 400 <= r.status_code < 500)
    r, d = full("bptn01", "SIM-TKT-TEC-002", "ASSET-02 after")
    chk("A02 state unchanged", dict(status="VERIFYING", reason="ASSET_UNCLEAR", owner="BPTN", department_id=None, draft=False, assignee_id=None), state(d))


def a3p(c, call, full, chk, state, stock, w):
    T = "SIM-TKT-TEC-002"
    full("bptn01", T, "ASSET-03 before")
    r, d = call("bptn01", "POST", f"/mo/tickets/{T}/bptn-resolve", {"asset_onsite": True, "note": "So mo phong chua co asset, ky thuat xac dinh tai hien truong"}, label="ASSET-03 bptn-resolve onsite (OPERATIONS 3.2.2)")
    chk("A03 http", 200, r.status_code)
    chk("A03 ROUTED/null/DEPT_TECHNICAL/draft/assignee null", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d))
    chk("A03 flag ASSET_CHECK_ONSITE", True, "ASSET_CHECK_ONSITE" in json.dumps(d["ticket"]["flags"], default=str))
    chk("A03 no invented asset_id on draft", None, (d.get("draft") or {}).get("asset_id"))
    chk("A03 resolution ONSITE_BY_BPTN present", True, "ONSITE_BY_BPTN" in json.dumps(d, default=str))
    full("bptn01", T, "ASSET-03 after")
    call("bptn01", "GET", f"/mo/tickets/{T}/notifications", label="ASSET-03 notifications")


def a3n(c, call, full, chk, state, stock, w):
    T = "SIM-TKT-TEC-002"
    full("bptn01", T, "ASSET-03neg before")
    r, _ = call("bptn01", "POST", f"/mo/tickets/{T}/bptn-resolve", {"asset_onsite": True}, label="ASSET-03neg onsite WITHOUT note (3.2.3 expect 409)")
    chk("A03neg 409", 409, r.status_code)
    r, d = full("bptn01", T, "ASSET-03neg after")
    chk("A03neg state stays VERIFYING/ASSET_UNCLEAR, no draft", dict(status="VERIFYING", reason="ASSET_UNCLEAR", owner="BPTN", department_id=None, draft=False, assignee_id=None), state(d))
    chk("A03neg no BPTN_RESOLVE audit", False, "BPTN_RESOLVE" in json.dumps(d["audit"]).upper())


A = "Hành lang tầng 4 tòa SIM-C có nhiều rác và vết bẩn, cần vệ sinh."
A5 = A.replace("tầng 4", "tầng 5")
T1, T2, T3 = "2026-10-05T09:00:00+07:00", "2026-10-06T09:00:00+07:00", "2026-10-08T09:30:00+07:00"


def ing(call, desc, at, label):
    r, d = call("cudan01", "POST", "/resident/tickets", {"original_description": desc, "simulated_received_at": at}, label=label)
    assert r.status_code == 201, f"ingest {r.status_code}"
    return d["ticket_id"]


def mo(call, who, t, label):
    r, d = call(who, "GET", f"/mo/tickets/{t}", label=label)
    call(who, "GET", f"/mo/tickets/{t}/events", label=label + " events")
    call(who, "GET", f"/mo/tickets/{t}/audit", label=label + " audit")
    return d


def dstate(d):
    t = d["ticket"]; b = t.get("blocker") or {}
    return dict(status=t["status"], dept=t.get("department_id"), blocker=b.get("code"), related=b.get("related_ticket_id"), draft=d.get("draft") is not None)


def dup_pair(call, w):
    p = ing(call, A, T1, "DUP resident first T1")
    ch = ing(call, A, T2, "DUP resident second T2 (+24h same type+location)")
    return p, ch


def dup01(c, call, full, chk, state, stock, w):
    p, ch = dup_pair(call, w)
    dp, dc = mo(call, "bptn01", p, "parent"), mo(call, "bptn01", ch, "child")
    chk("parent ROUTED", "ROUTED", dstate(dp)["status"])
    chk("child VERIFYING/DUPLICATE->parent, dept null, draft null", dict(status="VERIFYING", dept=None, blocker="DUPLICATE", related=p, draft=False), dstate(dc))
    r, _ = call("bptn01", "POST", f"/mo/tickets/{ch}/accept", label="DUP-01 BPTN accept attempt (not assigned)")
    chk("accept refused 4xx", True, 400 <= r.status_code < 500)
    chk("child still VERIFYING after", "VERIFYING", dstate(mo(call, "bptn01", ch, "child after"))["status"])


def dup02(c, call, full, chk, state, stock, w):
    p, ch = dup_pair(call, w)
    r, _ = call("bptn01", "POST", f"/mo/tickets/{ch}/bptn-resolve", {"merge": True, "note": "Xac nhan trung phan anh truoc trong mo phong"}, label="DUP-02 BPTN merge")
    chk("merge 200", 200, r.status_code)
    dp, dc = mo(call, "bptn01", p, "parent"), mo(call, "bptn01", ch, "child")
    chk("child MERGED", "MERGED", dstate(dc)["status"])
    chk("child merged_into parent in audit", True, p in json.dumps(dc["audit"]))
    chk("audit BPTN_RESOLVE", True, "BPTN_RESOLVE" in json.dumps(dc["audit"]).upper())
    chk("parent unchanged ROUTED", "ROUTED", dstate(dp)["status"])
    call("cudan01", "GET", f"/resident/tickets/{ch}", label="DUP-02 resident view child")


def dup03(c, call, full, chk, state, stock, w):
    p, ch = dup_pair(call, w)
    r, _ = call("bptn01", "POST", f"/mo/tickets/{ch}/bptn-resolve", {"merge": False, "note": "Xac nhan la phan anh khac trong mo phong"}, label="DUP-03 BPTN reject duplicate")
    chk("reject 200", 200, r.status_code)
    dp, dc = mo(call, "bptn01", p, "parent"), mo(call, "bptn01", ch, "child")
    s = dstate(dc)
    chk("child ROUTED/DEPT_CLEANING/no blocker/draft", dict(status="ROUTED", dept="DEPT_CLEANING", blocker=None, related=None, draft=True), s)
    chk("not MERGED", False, s["status"] == "MERGED")
    chk("audit BPTN_RESOLVE", True, "BPTN_RESOLVE" in json.dumps(dc["audit"]).upper())


def dup04(c, call, full, chk, state, stock, w):
    p = ing(call, A, T1, "DUP-04 first T1")
    a = ing(call, A5, T2, "DUP-04 variant a: different floor (+24h)")
    b = ing(call, A, T3, "DUP-04 variant b: same location +72.5h (>48h)")
    for t, n in ((p, "parent"), (a, "variant-a"), (b, "variant-b")):
        d = mo(call, "bptn01", t, n)
        w("DSTATE " + n + " " + json.dumps(dstate(d), default=str))
        if t != p:
            chk(f"{n} not duplicate/merged", True, dstate(d)["blocker"] != "DUPLICATE" and dstate(d)["status"] != "MERGED")
            chk(f"{n} ROUTED", "ROUTED", dstate(d)["status"])


CASES = {"s01": s01, "s02": s02, "s03": s03, "s04": s04, "a12": a12, "a3p": a3p, "a3n": a3n,
         "dup01": dup01, "dup02": dup02, "dup03": dup03, "dup04": dup04}

if __name__ == "__main__":
    try:
        run()
        code = 0 if all(x["ok"] for x in checks) else 1
    except AssertionError as e:
        w(f"BLOCKED/ASSERT: {e}")
        code = 2
    except Exception as e:  # noqa
        import traceback
        w("EXCEPTION " + traceback.format_exc())
        code = 3
    log.close()
    (OUT / f"{case}-exit.txt").write_text(f"{now()} python harness.py {case} exit={code}\nchecks_total={len(checks)} ok={sum(x['ok'] for x in checks)} mismatch={sum(not x['ok'] for x in checks)}\n", encoding="utf-8")
    print(case, "exit", code, "checks", len(checks), "mismatch", sum(not x["ok"] for x in checks))
    sys.exit(code)
