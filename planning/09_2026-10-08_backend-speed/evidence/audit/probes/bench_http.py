import json, statistics, sys, time, urllib.request
B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/api/v1"
def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(B + path, data=data, method=method, headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    t = time.perf_counter()
    with urllib.request.urlopen(r, timeout=120) as resp:
        raw = resp.read()
    return (time.perf_counter() - t) * 1000, raw
def login(u):
    _, raw = req("POST", "/auth/login", body={"username": u, "password": "Demo@2026"})
    return json.loads(raw)["token"] if "token" in json.loads(raw) else json.loads(raw)["access_token"]
def bench(label, path, tok, n=5):
    ms, size = [], 0
    for _ in range(n):
        t, raw = req("GET", path, tok); ms.append(t); size = len(raw)
    print(f"{label:38s} median={statistics.median(ms):7.0f}ms  min={min(ms):6.0f}  max={max(ms):6.0f}  size={size/1024:7.1f}KB")
    return raw
t_login, _ = req("POST", "/auth/login", body={"username": "bptn01", "password": "Demo@2026"})
print(f"{'POST /auth/login':38s} {t_login:7.0f}ms")
bp, cd, bq, kh = login("bptn01"), login("cudan01"), login("bql01"), login("kho01")
raw = bench("GET /mo/tickets (bptn01)", "/mo/tickets", bp)
tickets = json.loads(raw); print("   tickets:", len(tickets))
tid = tickets[0]["ticket_id"]
bench("GET /mo/tickets/{id}", f"/mo/tickets/{tid}", bp)
bench("GET /mo/tickets/{id}/events", f"/mo/tickets/{tid}/events", bp)
bench("GET /mo/catalog", "/mo/catalog", bp)
bench("GET /mo/ai-logs", "/mo/ai-logs", bp, n=3)
bench("GET /mo/warehouse/stock (kho01)", "/mo/warehouse/stock", kh)
bench("GET /resident/tickets (cudan01)", "/resident/tickets", cd)
bench("GET /bql/tickets (bql01)", "/bql/tickets", bq)

