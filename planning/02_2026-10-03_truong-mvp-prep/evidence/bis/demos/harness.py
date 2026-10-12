"""D3-06 harness: in-process TestClient, isolated env, one fresh interpreter per case.
Usage: python harness.py g1a|g1b|g1r|g2|g2neg|g3|g4a|g4b
Writes machine output to evidence/d3-06/<case>.txt (+ <case>-exit.txt). Passwords/tokens are never logged."""

import os
import sys
import json
import datetime as dt
from pathlib import Path

# Force isolation BEFORE importing the app (do not trust .env)
os.environ.update(
    MO_STORE="memory", LLM_MODE="mock", MO_PHOTO_STORE="local", APP_ENV="development",
    MO_ALLOW_RESET="false", MO_JOBS_ENABLED="false",
)
os.environ.pop("DATABASE_URL", None)
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
                summ = dict(status=t["status"], blocker=(t.get("blocker") or {}).get("code"), department_id=t.get("department_id"), flags=t.get("flags"),
                            assignee_id=t.get("assignee_id"), rating=t.get("rating"), draft_exists=data.get("draft") is not None)
                w("SUMMARY " + json.dumps(summ, ensure_ascii=False, default=str))
            w("BODY " + json.dumps(data, ensure_ascii=False, default=str))
            return r, data

        def full(t: str, label: str, resident: str | None = "cudan01"):
            """E(G,S): GET ticket/events/audit/notifications (QA) + resident allow-list view (owner)."""
            r, d = call("qa01", "GET", f"/mo/tickets/{t}", label=f"{label} / GET ticket (QA)")
            call("qa01", "GET", f"/mo/tickets/{t}/events", label=f"{label} / GET events (QA)")
            call("bptn01", "GET", f"/mo/tickets/{t}/audit", label=f"{label} / GET audit (BPTN)")
            call("bql01", "GET", f"/mo/tickets/{t}/notifications", label=f"{label} / GET notifications (BQL)")
            if resident:
                call(resident, "GET", f"/resident/tickets/{t}", label=f"{label} / GET resident view")
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


# ---------------------------------------------------------------- group 1
BRANCH = {
    "A": dict(T="SIM-TKT-CLN-001", dept="DEPT_CLEANING", user="vesinh01", other="kythuat01",
              chk=["CLN-CHK-01", "CLN-CHK-02", "CLN-CHK-03"],
              mats=[("SIM-MAT-CLEAN-01", dict(issued_qty=2, used_qty=2)),
                    ("SIM-MAT-BAG-01", dict(issued_qty=3, used_qty=3, variance_reason="Khối lượng rác mô phỏng lớn hơn định mức"))],
              ev=dict(requirement_id="CLN-EVD-PROCESSING-NOTE", evidence_type="PROCESSING_NOTE",
                      content_or_metadata="Đã thu gom rác và lau sàn mô phỏng", readability_status="NOT_APPLICABLE")),
    "B": dict(T="SIM-TKT-TEC-001", dept="DEPT_TECHNICAL", user="kythuat01", other="vesinh01",
              chk=["TEC-CHK-01", "TEC-CHK-02", "TEC-CHK-03"],
              mats=[("SIM-MAT-LAMP-01", dict(issued_qty=1, used_qty=1))],
              ev=dict(requirement_id="TEC-EVD-RESULT-NOTE", evidence_type="RESULT_NOTE",
                      content_or_metadata="Đã thay bóng mô phỏng", readability_status="NOT_APPLICABLE")),
}


def happy(branch, call, full, chk, state, w):
    """OPERATIONS 2 steps 1-7 for one branch, with the required negatives. Returns ticket id."""
    b = BRANCH[branch]
    T, U = b["T"], b["user"]
    w(f"# DEMO-01{branch} fixture {T} dept {b['dept']}")
    r, d = full(T, f"1{branch} step1 initial")
    chk("1 http", 200, r.status_code)
    chk("1 ROUTED/blocker null/dept/draft/assignee null", dict(status="ROUTED", reason=None, owner=None, department_id=b["dept"], draft=True, assignee_id=None), state(d))
    if branch == "B":
        chk("1 B asset SIM-ASSET-LIGHT-001", "SIM-ASSET-LIGHT-001", d["draft"]["asset_id"])
    # early-close and role negatives while ROUTED
    r, _ = call("bql01", "POST", f"/bql/tickets/{T}/close", {"note": "đóng sớm"}, label=f"1{branch} neg: BQL close while ROUTED (early close)")
    chk("early close refused 409", 409, r.status_code)
    r, _ = call("bptn01", "POST", f"/mo/tickets/{T}/accept", label=f"1{branch} neg: BPTN accept (wrong role)")
    chk("BPTN accept refused 403", 403, r.status_code)
    # step 2: wrong department, then right one
    r, _ = call(b["other"], "POST", f"/mo/tickets/{T}/accept", label=f"1{branch} step2 neg: wrong department {b['other']} accept")
    chk("wrong dept accept refused (403/409)", True, r.status_code in (403, 409))
    r, d = call("qa01", "GET", f"/mo/tickets/{T}", label=f"1{branch} step2 state after refusal")
    chk("status unchanged ROUTED", "ROUTED", d["ticket"]["status"])
    r, d = call(U, "POST", f"/mo/tickets/{T}/accept", label=f"1{branch} step2 accept by {U}")
    chk("2 accept 200", 200, r.status_code)
    chk("2 IN_PROGRESS/null/assignee null", dict(status="IN_PROGRESS", reason=None, owner=None, department_id=b["dept"], draft=True, assignee_id=None), state(d))
    full(T, f"1{branch} step2 after")
    # step 3 checklist
    for i in b["chk"]:
        r, d = call(U, "POST", f"/mo/tickets/{T}/checklist/{i}", {"status": "COMPLETED", "note": "Đã kiểm tra mô phỏng"}, label=f"1{branch} step3 checklist {i}")
        chk(f"3 checklist {i} 200", 200, r.status_code)
    chk("3 still IN_PROGRESS", "IN_PROGRESS", d["ticket"]["status"])
    full(T, f"1{branch} step3 after")
    # step 4 materials
    for code, body in b["mats"]:
        r, d = call(U, "POST", f"/mo/tickets/{T}/materials/{code}", body, label=f"1{branch} step4 material {code}")
        chk(f"4 material {code} 200", 200, r.status_code)
    chk("4 still IN_PROGRESS", "IN_PROGRESS", d["ticket"]["status"])
    full(T, f"1{branch} step4 after")
    # step 5 evidence
    r, d = call(U, "POST", f"/mo/tickets/{T}/evidence", b["ev"], label=f"1{branch} step5 evidence note")
    chk("5 evidence note 200", 200, r.status_code)
    r, d = call(U, "POST", f"/mo/tickets/{T}/evidence",
                dict(requirement_id=None, evidence_type="SIMULATED_IMAGE", content_or_metadata="Ảnh kết quả mô phỏng", readability_status="READABLE"),
                label=f"1{branch} step5 evidence simulated image (metadata only)")
    chk("5 evidence image 200", 200, r.status_code)
    chk("5 still IN_PROGRESS", "IN_PROGRESS", d["ticket"]["status"])
    full(T, f"1{branch} step5 after")
    # step 6 complete
    r, d = call(U, "POST", f"/mo/tickets/{T}/complete", label=f"1{branch} step6 complete")
    chk("6 complete 200", 200, r.status_code)
    chk("6 READY_FOR_REVIEW/null", dict(status="READY_FOR_REVIEW", reason=None, owner=None, department_id=b["dept"], draft=True, assignee_id=None), state(d))
    re = (d["draft"] or {}).get("readiness_evaluation") or {}
    flags = [v for k, v in re.items() if k not in ("evaluated_at", "failing_items")]
    chk("6 readiness all checks true, failing_items []", [True, []], [all(flags) and len(flags) >= 7, re.get("failing_items")])
    full(T, f"1{branch} step6 after")
    # step 7 close: department / BPTN denied, BQL ok
    r, _ = call(U, "POST", f"/bql/tickets/{T}/close", {"note": "tự đóng"}, label=f"1{branch} step7 neg: department self-close")
    chk("dept close refused 403", 403, r.status_code)
    r, _ = call("bptn01", "POST", f"/bql/tickets/{T}/close", {"note": "BPTN đóng"}, label=f"1{branch} step7 neg: BPTN close")
    chk("BPTN close refused 403", 403, r.status_code)
    r, d = call("qa01", "GET", f"/mo/tickets/{T}", label=f"1{branch} step7 state after denials")
    chk("still READY_FOR_REVIEW", "READY_FOR_REVIEW", d["ticket"]["status"])
    r, d = call("bql01", "POST", f"/bql/tickets/{T}/close", {"note": "Đã kiểm duyệt kết quả mô phỏng"}, label=f"1{branch} step7 BQL close")
    chk("7 close 200", 200, r.status_code)
    chk("7 CLOSED/blocker null/assignee null", dict(status="CLOSED", reason=None, owner=None, assignee_id=None), {k: state(d)[k] for k in ("status", "reason", "owner", "assignee_id")})
    full(T, f"1{branch} step7 after")
    aud = [str(a.get("action")) + ":" + str(a.get("actor_role", "")) for a in d["audit"]] if "audit" in d else []
    w(f"AUDIT (from close response) {json.dumps(aud, ensure_ascii=False)}")
    return T


def g1a(c, call, full, chk, state, stock, w):
    happy("A", call, full, chk, state, w)


def g1b(c, call, full, chk, state, stock, w):
    happy("B", call, full, chk, state, w)


def g1r(c, call, full, chk, state, stock, w):
    T = happy("A", call, full, chk, state, w)
    w(f"# DEMO-01-RATING step 8 on {T} (CLOSED)")
    eng = get_engine()
    call("cudan01", "GET", f"/resident/tickets/{T}", label="8 resident view before rating")
    r1, _ = call("cudan01", "POST", f"/resident/tickets/{T}/rating", {"score": 5}, label="8 rating #1 score=5")
    chk("rating#1 200", 200, r1.status_code)
    chk("rating after #1 == 5", 5, eng.cases[T].ticket.rating)
    n1 = sum(1 for a in call("bptn01", "GET", f"/mo/tickets/{T}/audit", label="8 audit after #1")[1] if "RATE" in str(a.get("action")).upper())
    r2, _ = call("cudan01", "POST", f"/resident/tickets/{T}/rating", {"score": 1}, label="8 rating #2 score=1 (target: 409, rating stays 5)")
    chk("TARGET rating#2 == 409", 409, r2.status_code)
    chk("TARGET rating after #2 stays 5", 5, eng.cases[T].ticket.rating)
    n2 = sum(1 for a in call("bptn01", "GET", f"/mo/tickets/{T}/audit", label="8 audit after #2")[1] if "RATE" in str(a.get("action")).upper())
    chk("TARGET no new rating audit mutation (count #1 == count #2)", n1, n2)
    full(T, "8 final")


# ---------------------------------------------------------------- group 2
def g2(c, call, full, chk, state, stock, w):
    # 3.1 NEED_INFO positive
    T = "SIM-TKT-CLN-003"
    r, d = full(T, "2.1 step1 NEED_INFO initial")
    chk("2.1 NEED_INFO/MISSING_INFO/dept null/draft null", dict(status="NEED_INFO", reason="MISSING_INFO", owner="BPTN", department_id=None, draft=False, assignee_id=None), state(d))
    r, _ = call("bptn01", "POST", f"/mo/tickets/{T}/accept", label="2.1 neg: BPTN tries to accept/route NEED_INFO")
    chk("accept refused 403", 403, r.status_code)
    body = {"location": "Tòa SIM-A / Tầng 6 / Cầu thang bộ", "info": "Có bụi bẩn, cần vệ sinh khu vực chung", "note": "Đã liên hệ cư dân xác nhận nội dung và vị trí"}
    r, d = call("bptn01", "POST", f"/mo/tickets/{T}/bptn-resolve", body, label="2.1 step2 BPTN resolve MISSING_INFO")
    chk("2.1 resolve 200", 200, r.status_code)
    st = state(d)
    w(f"STATE after resolve {json.dumps(st, ensure_ascii=False)}")
    chk("2.1 ROUTED/null (or legitimate duplicate blocker, to be read)", dict(status="ROUTED", reason=None), {k: st[k] for k in ("status", "reason")})
    chk("2.1 raw stays blank", "   ", d["ticket"]["raw"]["original_description"])
    chk("2.1 addition submitted_by BPTN", True, [a["submitted_by"] for a in d.get("additions", [])] == ["SIM-ACTOR-BPTN-01"])
    chk("2.1 locked location", "Tòa SIM-A / Tầng 6 / Cầu thang bộ", d["ticket"]["locked_fields"]["location"])
    full(T, "2.1 step2 after")
    # 3.2 ASSET_UNCLEAR positive
    T2 = "SIM-TKT-TEC-002"
    r, d = full(T2, "2.2 step1 ASSET_UNCLEAR initial")
    chk("2.2 VERIFYING/ASSET_UNCLEAR/dept null/draft null", dict(status="VERIFYING", reason="ASSET_UNCLEAR", owner="BPTN", department_id=None, draft=False, assignee_id=None), state(d))
    r, _ = call("kythuat01", "POST", f"/mo/tickets/{T2}/accept", label="2.2 neg: department accept while VERIFYING")
    chk("accept refused 409", 409, r.status_code)
    body = {"asset_onsite": True, "note": "Sổ mô phỏng chưa có asset, kỹ thuật phải xác định tại hiện trường"}
    r, d = call("bptn01", "POST", f"/mo/tickets/{T2}/bptn-resolve", body, label="2.2 step2 BPTN resolve asset onsite")
    chk("2.2 resolve 200", 200, r.status_code)
    chk("2.2 ROUTED/null/dept TECHNICAL/draft", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d))
    chk("2.2 flag ASSET_CHECK_ONSITE", True, "ASSET_CHECK_ONSITE" in json.dumps(d["ticket"]["flags"]) and "ASSET_CHECK_ONSITE" in json.dumps(d["draft"]["flags"] if "flags" in d["draft"] else d["ticket"]["flags"]))
    chk("2.2 asset_resolution ONSITE_BY_BPTN", "ONSITE_BY_BPTN", str(d["ticket"].get("asset_resolution")).split(".")[-1])
    full(T2, "2.2 step2 after")


def g2neg(c, call, full, chk, state, stock, w):
    # separate fresh process = independent untouched cases for negatives (OPERATIONS 3.1 step3, 3.2 step3)
    T = "SIM-TKT-CLN-003"
    full(T, "2.1 neg initial")
    n0 = len(get_engine().cases[T].ticket.additions) if hasattr(get_engine().cases[T].ticket, "additions") else None
    r, _ = call("bptn01", "POST", f"/mo/tickets/{T}/bptn-resolve", {"location": "Tòa SIM-A / Tầng 6"}, label="2.1 step3 neg: only location, no note/info")
    chk("only location -> 409", 409, r.status_code)
    r, _ = call("bptn01", "POST", f"/mo/tickets/{T}/bptn-resolve", {"info": "Có bụi bẩn", "note": "đã liên hệ"}, label="2.1 step3 neg: info but still missing location")
    chk("info without location -> 409 (still missing)", 409, r.status_code)
    r, d = call("qa01", "GET", f"/mo/tickets/{T}", label="2.1 state after 409s")
    chk("still NEED_INFO/MISSING_INFO", ("NEED_INFO", "MISSING_INFO"), (d["ticket"]["status"], d["ticket"]["blocker"]["code"]))
    n1 = len(get_engine().cases[T].ticket.additions) if hasattr(get_engine().cases[T].ticket, "additions") else None
    chk("no partial addition appended", n0, n1)
    r, _ = call("kythuat01", "POST", f"/mo/tickets/{T}/bptn-resolve", {"location": "Tòa SIM-A / Tầng 6", "info": "x y", "note": "n"}, label="2.1 step3 neg: wrong role bptn-resolve")
    chk("wrong role -> 403", 403, r.status_code)
    r, _ = call("cudan01", "POST", f"/mo/tickets/{T}/bptn-resolve", {"location": "Tòa SIM-A / Tầng 6", "info": "x y", "note": "n"}, label="2.1 step3 neg: resident bptn-resolve")
    chk("resident -> 403", 403, r.status_code)
    full(T, "2.1 neg final")
    T2 = "SIM-TKT-TEC-002"
    full(T2, "2.2 neg initial")
    r, _ = call("bptn01", "POST", f"/mo/tickets/{T2}/bptn-resolve", {"asset_onsite": True}, label="2.2 step3 neg: onsite without note")
    chk("onsite without note -> 409", 409, r.status_code)
    r, d = call("qa01", "GET", f"/mo/tickets/{T2}", label="2.2 state after 409")
    chk("still VERIFYING/ASSET_UNCLEAR", ("VERIFYING", "ASSET_UNCLEAR"), (d["ticket"]["status"], d["ticket"]["blocker"]["code"]))
    r, _ = call("kythuat01", "POST", f"/mo/tickets/{T2}/bptn-resolve", {"asset_onsite": True, "note": "n"}, label="2.2 neg: wrong role onsite resolve")
    chk("wrong role -> 403", 403, r.status_code)
    r, _ = call("bptn01", "POST", f"/mo/tickets/{T2}/bptn-resolve", {"asset_id": "SIM-ASSET-NOPE-999", "note": "bịa asset"}, label="2.2 neg: invented asset id")
    chk("invented asset -> 409", 409, r.status_code)
    full(T2, "2.2 neg final")


# ---------------------------------------------------------------- group 3
def g3(c, call, full, chk, state, stock, w):
    T, I = "SIM-TKT-TEC-003", "SIM-MAT-LAMP-02"
    p = f"/mo/warehouse/stock/{I}"
    b0 = stock(I)
    w(f"STOCK before#0 {I} = {b0}")
    r, d = full(T, "3 step1 initial")
    chk("3.1 ON_HOLD/WAITING_MATERIAL/WAREHOUSE/dept null/draft null", dict(status="ON_HOLD", reason="WAITING_MATERIAL", owner="WAREHOUSE", department_id=None, draft=False, assignee_id=None), state(d))
    chk("3.1 resume_step", 6, d["ticket"]["blocker"]["resume_step"])
    chk("3.1 planned qty2 stock0", [(I, 2.0, 0.0, "INSUFFICIENT")], [(m["item_code"], m["planned_qty"], m["simulated_stock_qty"], m["material_stock_status"]) for m in d["material_lines"]])
    r, _ = call("kythuat01", "POST", f"/mo/tickets/{T}/accept", label="3.1 neg: department accept while ON_HOLD")
    chk("accept refused 4xx", True, 400 <= r.status_code < 500)
    r, d = call("qa01", "POST", f"/mo/tickets/{T}/resume", label="3.2 QA resume stock=0")
    chk("3.2 resume 200", 200, r.status_code)
    chk("3.2 still ON_HOLD/WAITING_MATERIAL, dept null, draft null", dict(status="ON_HOLD", reason="WAITING_MATERIAL", owner="WAREHOUSE", department_id=None, draft=False, assignee_id=None), state(d))
    chk("3.2 stock unchanged by resume", b0, stock(I))
    # negatives (stock must not change)
    r, _ = call("bptn01", "POST", p, {"qty": 1}, label="3.5 neg: BPTN receives stock")
    chk("wrong role 403", 403, r.status_code)
    r, _ = call("kho01", "POST", p, {"qty": 0}, label="3.5 neg: qty=0")
    chk("qty=0 422", 422, r.status_code)
    r, _ = call("kho01", "POST", "/mo/warehouse/stock/SIM-MAT-NOPE-99", {"qty": 1}, label="3.5 neg: unknown item")
    chk("unknown item 404", 404, r.status_code)
    chk("stock unchanged after negatives", b0, stock(I))
    # receipt 1
    bf1 = stock(I); w(f"STOCK before#1 {I} = {bf1}")
    r, _ = call("kho01", "POST", p, {"qty": 1}, label="3.3 receipt #1 qty=1")
    af1 = stock(I); w(f"STOCK after#1 {I} = {af1}")
    chk("receipt#1 200", 200, r.status_code)
    chk("stock before->after #1", [0.0, 1.0], [bf1, af1])
    r, d = full(T, "3.3 after #1")
    chk("3.3 still ON_HOLD/WAITING_MATERIAL, not dispatched", dict(status="ON_HOLD", reason="WAITING_MATERIAL", owner="WAREHOUSE", department_id=None, draft=False, assignee_id=None), state(d))
    # receipt 2
    bf2 = stock(I); w(f"STOCK before#2 {I} = {bf2}")
    r, lst = call("kho01", "POST", p, {"qty": 1}, label="3.4 receipt #2 qty=1")
    af2 = stock(I); w(f"STOCK after#2 {I} = {af2}")
    chk("receipt#2 200", 200, r.status_code)
    chk("stock before->after #2", [1.0, 2.0], [bf2, af2])
    r, d = full(T, "3.4 after #2")
    chk("3.4 ROUTED/null/dept TECHNICAL/draft/assignee null", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d))
    acts = [str(a.get("action")).upper() for a in d["audit"]]
    w(f"AUDIT actions in order: {json.dumps(acts)}")
    li = max(i for i, a in enumerate(acts) if "LOOKUP_ASSET" in a)
    si = max(i for i, a in enumerate(acts) if "CHECK_MATERIAL_STOCK" in a)
    ri = max(i for i, a in enumerate(acts) if "CREATE_DRAFT" in a)  # routing is recorded as CREATE_DRAFT (no ROUTE action name)
    chk("3.4 audit order lookup < stock < create_draft/route (rerun from asset)", True, li < si < ri)
    # resume again
    ev_before = len(d["events"])
    r, d2 = call("qa01", "POST", f"/mo/tickets/{T}/resume", label="3.5 QA resume after ROUTED")
    chk("3.5 resume keeps ROUTED, no duplicate dispatch", dict(status="ROUTED", reason=None, owner=None, department_id="DEPT_TECHNICAL", draft=True, assignee_id=None), state(d2))
    chk("3.5 events length unchanged", ev_before, len(d2["events"]))
    chk("final stock", 2.0, stock(I))
    full(T, "3.5 final")


# ---------------------------------------------------------------- group 4 (TARGET BLOCKED; baseline only)
def g4a(c, call, full, chk, state, stock, w):
    # 4.1 static/OpenAPI scan: do safety routes/fields/actions exist?
    spec = c.get("/openapi.json").json()
    paths = sorted(spec["paths"].keys())
    w(f"## OPENAPI paths ({len(paths)}): {json.dumps(paths)}")
    hits = [p for p in paths if "safety" in p.lower() or "emergency" in p.lower() or "hazard" in p.lower()]
    chk("OpenAPI has no safety/emergency/hazard path", [], hits)
    schemas = json.dumps(spec.get("components", {}).get("schemas", {}), ensure_ascii=False)
    for kw in ("SAFETY_CONFIRM_SAFE", "SAFETY_ESCALATE", "EMERGENCY_CLOSE", "EMERGENCY_DOWNGRADE", "SAFETY_REVIEW_REQUIRED", "EMERGENCY_PENDING_BQL", "safety_cleared_by"):
        chk(f"OpenAPI schemas lack {kw}", False, kw in schemas)
    from src.maintenance import engine as eng_mod
    import inspect
    src_engine = inspect.getsource(eng_mod)
    chk("engine.py does not import/call safety module", False, "safety" in src_engine.lower())
    # CURRENT baseline (labelled BASELINE): resident ingest of the Bậc 2 sentence on isolated memory store
    body = {"original_description": "Hình như có mùi khét ở đèn hành lang tầng 3 tòa SIM-A.", "channel": "form", "simulated_received_at": "2026-10-03T10:00:00+07:00"}
    r, d = call("cudan01", "POST", "/resident/tickets", body, label="4 BASELINE (not target) resident ingest Bậc 2 sentence")
    tid = d.get("ticket_id") or d.get("id")
    w(f"BASELINE ticket id = {tid}")
    r2, dd = call("qa01", "GET", f"/mo/tickets/{tid}", label="4 BASELINE QA read Bậc 2 ticket")
    s = state(dd)
    w(f"BASELINE observed state {json.dumps(s, ensure_ascii=False)}")
    chk("TARGET Bậc 2 -> VERIFYING/SAFETY_REVIEW_REQUIRED owner BPTN, dept/draft null", dict(status="VERIFYING", reason="SAFETY_REVIEW_REQUIRED", owner="BPTN", department_id=None, draft=False, assignee_id=None), s)
    call("cudan01", "GET", f"/resident/tickets/{tid}", label="4 BASELINE resident allow-list view")
    full(tid, "4 BASELINE Bậc 2 E(4,ingest)", resident=None)


def g4b(c, call, full, chk, state, stock, w):
    body = {"original_description": "Đèn hành lang tầng 3 tòa SIM-A có khói và mùi khét.", "channel": "form", "simulated_received_at": "2026-10-03T10:00:00+07:00"}
    r, d = call("cudan01", "POST", "/resident/tickets", body, label="4 BASELINE (not target) resident ingest Bậc 1 sentence")
    tid = d.get("ticket_id") or d.get("id")
    w(f"BASELINE ticket id = {tid}")
    r2, dd = call("qa01", "GET", f"/mo/tickets/{tid}", label="4 BASELINE QA read Bậc 1 ticket")
    s = state(dd)
    w(f"BASELINE observed state {json.dumps(s, ensure_ascii=False)}")
    chk("TARGET Bậc 1 -> VERIFYING/EMERGENCY_PENDING_BQL owner BQL, dept/draft null", dict(status="VERIFYING", reason="EMERGENCY_PENDING_BQL", owner="BQL", department_id=None, draft=False, assignee_id=None), s)
    full(tid, "4 BASELINE Bậc 1 E(4,ingest)", resident=None)
    # notify ghim BQL?
    r3, n = call("bql01", "GET", f"/mo/tickets/{tid}/notifications", label="4 BASELINE BQL notifications (target: immediate emergency notice)")
    chk("TARGET BQL-audience emergency notification present (pinned)", True, any(x.get("audience") == "BQL" for x in n))


CASES = {"g1a": g1a, "g1b": g1b, "g1r": g1r, "g2": g2, "g2neg": g2neg, "g3": g3, "g4a": g4a, "g4b": g4b}

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
