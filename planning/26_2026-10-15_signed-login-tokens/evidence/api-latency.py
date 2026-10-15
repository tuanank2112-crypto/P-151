"""Plan 26: time the backend calls the BQL screen makes (read only), 3 rounds. Usage: python api-latency.py <label>."""

import json
import statistics
import sys
import time
import urllib.error
import urllib.request

B = "https://p151-backend.vercel.app/api/v1"
PATHS = ["/bql/tickets", "/mo/tickets", "/bql/reports/performance", "/mo/warehouse/stock", "/mo/catalog"]


def call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})}
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body else None, headers=headers)
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            status, text = r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode("utf-8")
    return status, text, time.perf_counter() - started


label = sys.argv[1] if len(sys.argv) > 1 else "run"
status, text, login_s = call("POST", "/auth/login", {"username": "quanly", "password": "123456"})
token = json.loads(text)["access_token"]
times, bad = [], []
for _ in range(3):
    for path in PATHS:
        status, _, seconds = call("GET", path, token=token)
        times.append(seconds)
        if status != 200:
            bad.append(f"{status} {path}")
print(f"{label}: login {login_s:.2f}s · {len(times)} GET median {statistics.median(times):.2f}s p90 "
      f"{sorted(times)[int(len(times) * 0.9) - 1]:.2f}s max {max(times):.2f}s · non-200: {bad or 'none'}")
