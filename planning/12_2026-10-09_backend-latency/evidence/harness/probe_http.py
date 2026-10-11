"""Plan 12 TESTING §2: GET-only latency probe, run INSIDE the backend container (no Docker port-forward, no Windows
client overhead). Logs in demo accounts, times each read endpoint, logs out. Never writes tickets.

Usage: MSYS_NO_PATHCONV=1 docker exec -i -w /app p151-backend-1 python - < planning/12_.../evidence/harness/probe_http.py
"""

import gzip
import json
import statistics
import time
import urllib.request

BASE = "http://127.0.0.1:8000/api/v1"
RUNS = 9


def call(method, path, body=None, token=None, encoding=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if encoding:
        headers["Accept-Encoding"] = encoding
    req = urllib.request.Request(BASE + path, method=method, data=None if body is None else json.dumps(body).encode(), headers=headers)
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read()
        return (time.perf_counter() - t0) * 1000, raw, resp.headers.get("Content-Encoding", "-")


def login(user):
    return json.loads(call("POST", "/auth/login", {"username": user, "password": "Demo@2026"})[1])["access_token"]


tokens = {u: login(u) for u in ["cudan01", "bql01", "bptn01", "vesinh01", "kho01"]}
rows = json.loads(call("GET", "/mo/tickets", token=tokens["bptn01"])[1])
mine = json.loads(call("GET", "/resident/tickets", token=tokens["cudan01"])[1])
photo = None
for r in rows:
    doc = json.loads(call("GET", f"/mo/tickets/{r['ticket_id']}", token=tokens["bptn01"])[1])
    ev = next((e for e in doc["evidence"] if len(e["content_or_metadata"]) == 36 and e["content_or_metadata"][-4:] in (".jpg", ".png")), None)
    if ev:
        photo = f"/mo/tickets/{r['ticket_id']}/photos/{ev['evidence_id']}"
        break

CASES = [
    ("GET /resident/tickets", "cudan01", "/resident/tickets"),
    ("GET /resident/tickets/{id}", "cudan01", f"/resident/tickets/{mine[0]['ticket_id']}"),
    ("GET /bql/tickets", "bql01", "/bql/tickets"),
    ("GET /mo/tickets (bptn)", "bptn01", "/mo/tickets"),
    ("GET /mo/tickets (department)", "vesinh01", "/mo/tickets"),
    ("GET /mo/tickets/{id}", "bptn01", f"/mo/tickets/{rows[0]['ticket_id']}"),
    ("GET /mo/warehouse/stock", "kho01", "/mo/warehouse/stock"),
]
if photo:
    CASES.append(("GET photo (2nd+ view)", "bptn01", photo))

print(f"{'endpoint':30s} {'median':>8s} {'max':>7s} {'body':>9s} {'on wire (gzip asked)':>22s}")
for label, user, path in CASES:
    times = [call("GET", path, token=tokens[user])[0] for _ in range(RUNS)]
    _, plain, _ = call("GET", path, token=tokens[user])
    _, wire, enc = call("GET", path, token=tokens[user], encoding="gzip")
    print(f"{label:30s} {statistics.median(times):6.0f}ms {max(times):5.0f}ms {len(plain) / 1024:7.1f}KB {len(wire) / 1024:9.1f}KB enc={enc}")
    if enc == "gzip":
        assert json.loads(gzip.decompress(wire)) == json.loads(plain), f"{label}: gzip body differs"
for t in tokens.values():
    call("POST", "/auth/logout", token=t)
