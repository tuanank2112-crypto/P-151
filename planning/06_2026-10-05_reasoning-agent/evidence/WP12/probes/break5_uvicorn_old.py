"""TESTING §8.5 part 3: start the OLD app (82f01f0) with uvicorn on the P1 database; it must exit 3 at startup."""

import os
import subprocess
import sys

root = os.path.abspath(sys.argv[1])
URL = os.environ["MO_TEST_DATABASE_URL"]
assert URL.endswith("/p151_wp12_test") and "127.0.0.1:55433" in URL
env = {k: v for k, v in os.environ.items() if not k.startswith(("OPENAI", "DATABASE", "MO_", "LLM_"))}
env.update({"MO_STORE": "postgres", "DATABASE_URL": URL, "LLM_MODE": "mock", "MO_JOBS_ENABLED": "false",
            "PYTHONUTF8": "1"})
cmd = [sys.executable, "-m", "uvicorn", "src.main:app", "--host", "127.0.0.1", "--port", "8799"]
print("$ (cwd=<scratchpad>/old82) MO_STORE=postgres DATABASE_URL=<p151_wp12_test> LLM_MODE=mock", " ".join(cmd[1:]))
try:
    proc = subprocess.run(cmd, cwd=root, env=env, capture_output=True, text=True, encoding="utf-8", timeout=120)
    code = proc.returncode
    lines = (proc.stdout + proc.stderr).splitlines()
except subprocess.TimeoutExpired as exc:
    code, lines = "TIMEOUT (app kept running)", ((exc.stdout or "") + (exc.stderr or "")).splitlines()
for line in lines:
    if any(k in line for k in ("RuntimeError", "revision", "Application startup", "ERROR", "Starting", "upgrade")):
        print("   ", line[:300])
print(f"RESULT uvicorn_exit={code}")
sys.exit(0 if code == 3 else 1)
