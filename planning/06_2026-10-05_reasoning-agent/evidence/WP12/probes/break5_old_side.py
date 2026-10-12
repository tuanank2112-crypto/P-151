"""TESTING §8.5 part 2 (OLD code 82f01f0, run with sys.argv[1] = the base worktree): the old code meets the P1 DB.

(a) the startup check must refuse (RuntimeError naming `upgrade head`), (b) for the record: what the old code would
hit WITHOUT the marker (reading a P1 document)."""

import os
import sys

root = os.path.abspath(sys.argv[1])
sys.path.insert(0, root)
os.chdir(root)
URL = os.environ["MO_TEST_DATABASE_URL"]
assert URL.endswith("/p151_wp12_test") and "127.0.0.1:55433" in URL

from src.maintenance.store import postgres  # noqa: E402

print("old code HEAD_REVISION:", postgres.HEAD_REVISION)
repo = postgres.PostgresRepository(URL)
refused = False
try:
    repo.check()
    print("(a) old code check(): PASSED (no refusal)")
except RuntimeError as exc:
    refused = "upgrade head" in str(exc)
    print(f"(a) old code check(): RuntimeError: {exc}")
try:
    cases = repo.list()
    print(f"(b) old code list() without the check: read {len(cases)} cases (no error)")
except Exception as exc:  # noqa: BLE001
    print(f"(b) old code list() without the check: {type(exc).__name__}: {str(exc).splitlines()[0][:200]}")
print(f"RESULT old_code_refused_at_check={refused}")
sys.exit(0 if refused else 1)
