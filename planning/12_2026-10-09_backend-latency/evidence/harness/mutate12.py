"""Plan 12 TESTING §2: apply one mutant, run the test that must catch it, restore the file byte for byte.

Usage (repo root): python planning/12_2026-10-09_backend-latency/evidence/harness/mutate12.py <m1..m5> <python>
m4/m5 need MO_TEST_DATABASE_URL (local docker *_test database).
"""

import pathlib
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
LAT = "tests/test_maintenance/test_backend_latency.py"
READ = "tests/test_maintenance/test_read_engine.py"
MUTANTS = {
    # I-4 broken: blocking work called straight from the async route again
    "m1": ("src/api/routers/maintenance.py", "await run_in_threadpool(work)", "work()", 2, [LAT, "-k", "p1"]),
    # G-3 broken: one transaction per photo again
    "m2": (
        "src/maintenance/engine.py",
        "            for file_ref in file_refs:\n                self._append_resident_photo(work, now, ticket_id, actor_id, file_ref)\n\n"
        "        return self._mutate(ticket_id, actor_id, Action.ADD_RESIDENT_PHOTO, op)",
        "            self._append_resident_photo(work, now, ticket_id, actor_id, op.ref)\n\n"
        "        case = None\n        for op.ref in file_refs:\n"
        "            case = self._mutate(ticket_id, actor_id, Action.ADD_RESIDENT_PHOTO, op)\n        return case",
        1,
        [LAT, "-k", "p2"],
    ),
    # G-4 broken: no gzip
    "m3": ("src/main.py", "app.add_middleware(GZipMiddleware, minimum_size=1024)\n", "", 1, [LAT, "-k", "z1"]),
    # I-3 broken: no retry after a dropped connection
    "m4": ("src/maintenance/store/postgres.py", "if attempt == 0 and exc.connection_invalidated:", "if False:", 1, ["--pg", READ, "-k", "t2"]),
    # I-1 broken: the read engine opens transactions again
    "m5": ("src/maintenance/store/postgres.py", '        isolation_level="AUTOCOMMIT",\n', "", 1, ["--pg", READ, "-k", "t1"]),
}

name, python = sys.argv[1], str(pathlib.Path(sys.argv[2]).resolve())
target, old, new, count, test = MUTANTS[name]
path = pathlib.Path(target)
original = path.read_bytes()
text = original.decode("utf-8")
newline = "\r\n" if "\r\n" in text else "\n"
old, new = old.replace("\n", newline), new.replace("\n", newline)
assert text.count(old) == count, f"{name}: anchor found {text.count(old)} times, expected {count}"
try:
    path.write_bytes(text.replace(old, new).encode("utf-8"))
    run = subprocess.run(
        [python, "-m", "pytest", "-q", "-p", "no:cacheprovider", *test],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    print(f"mutant {name} ({target}): pytest {' '.join(test)} exit={run.returncode}")
    print("\n".join(line for line in run.stdout.splitlines() if "passed" in line or "failed" in line or line.startswith("E ")))
finally:
    path.write_bytes(original)
assert path.read_bytes() == original
print(f"restored {target} byte for byte")
sys.exit(0 if run.returncode != 0 else 1)  # exit 0 = the mutant was caught (red), as required
