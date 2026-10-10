"""WP4 mutants (TESTING §T3): break one plan 16 guard in a private snapshot, then show which oracle turns red.

Usage: python mutants.py <repo> <scratch-dir>
For head and every mutant: builds a snapshot under <scratch-dir> (never inside <repo>), runs
  (a) the WP4 probes (probe_backend.py memory, probe_api.py) and (b) the three plan 16 test files,
and prints exit code + summary. A mutant is KILLED when (a) or (b) gets a new failure versus head.
"""

import subprocess
import sys
from pathlib import Path

repo, scratch = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
assert not str(scratch).startswith(str(repo)), "snapshots stay outside the shared working tree"
WP4 = repo / "planning/16_2026-10-10_material-guards/evidence/wp4"
SNAPSHOT = repo / "planning/16_2026-10-10_material-guards/evidence/harness/snapshot.py"
TESTS = [
    "tests/test_maintenance/test_material_guards.py",
    "tests/test_maintenance/test_material_usage.py",
    "tests/test_maintenance/test_material_usage_store.py",
]
ENGINE, ROUTER = "src/maintenance/engine.py", "src/api/routers/maintenance.py"
OWN = {  # WP4's own mutants, on top of the five of snapshot.py
    "w6-no-in-progress": (ENGINE, "            self._require_in_progress(work)\n            chosen = [(line.item_code, line.used_qty) for line in lines]\n",
                          "            chosen = [(line.item_code, line.used_qty) for line in lines]\n"),
    "w7-no-completion-guard": (ENGINE, "        problem = selection_problem(self.catalog, ticket.department_id, work.material_lines)\n",
                               "        problem = None\n"),
    "w8-extra-allowed": (ROUTER, 'class MaterialUsageRequest(BaseModel):\n    model_config = {"extra": "forbid"}\n',
                         "class MaterialUsageRequest(BaseModel):\n"),
    "w10-no-delta": (ENGINE, "self._issue_stock(code, new_issued.get(code, 0) - old_issued.get(code, 0))",
                     "self._issue_stock(code, new_issued.get(code, 0))"),
}
ENV = {"PYTHONDONTWRITEBYTECODE": "1", "PYTHONUTF8": "1", "LLM_MODE": "mock"}


def sh(args, cwd):
    import os

    out = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                         env={**os.environ, **ENV})
    return out.returncode, out.stdout + out.stderr


def broken_names(text):
    return sorted({line.split("::")[0].strip() for line in text.splitlines() if line.startswith("BROKEN")})


def run(name, dest):
    rc_b, out_b = sh([sys.executable, str(WP4 / "probe_backend.py"), "memory", str(dest)], dest)
    rc_a, out_a = sh([sys.executable, str(WP4 / "probe_api.py"), str(dest)], dest)
    rc_t, out_t = sh([sys.executable, "-m", "pytest", *TESTS, "-q", "-p", "no:cacheprovider"], dest)
    last = [line for line in out_t.splitlines() if line.strip()][-1:]
    failed = sorted({line.split(" - ")[0] for line in out_t.splitlines() if line.startswith("FAILED")})
    return {"probe_backend": (rc_b, broken_names(out_b)), "probe_api": (rc_a, broken_names(out_a)),
            "tests": (rc_t, last, failed)}


def snapshot(dest, mutant=None):
    args = [sys.executable, str(SNAPSHOT), str(repo), str(dest), "head"] + ([mutant] if mutant else [])
    rc, out = sh(args, repo)
    print(f"  snapshot rc={rc} {out.strip().splitlines()[-2:]}")
    return rc == 0


head_dir = scratch / "head"
snapshot(head_dir)
head = run("head", head_dir)
print(f"head: {head}")
mutants = ["m1-no-department", "m2-no-integer", "m3-no-technical-empty", "m4-partial-commit", "m5-norm-block", *OWN]
survived = []
for name in mutants:
    dest = scratch / name
    if name in OWN:
        snapshot(dest)
        rel, old, new = OWN[name]
        path = dest / rel
        text = path.read_text(encoding="utf-8")
        assert text.count(old) == 1, f"{name}: anchor not unique"
        path.write_bytes(text.replace(old, new).encode("utf-8"))
        print(f"  {name}: applied to {rel}")
    elif not snapshot(dest, name):
        print(f"{name}: SNAPSHOT FAILED")
        survived.append(name)
        continue
    got = run(name, dest)
    new_probe = sorted(set(got["probe_backend"][1]) - set(head["probe_backend"][1]))
    new_api = sorted(set(got["probe_api"][1]) - set(head["probe_api"][1]))
    new_tests = got["tests"][2]
    killed_probe = bool(new_probe or new_api)
    killed_tests = got["tests"][0] != 0
    print(f"{name}: probes_killed={killed_probe} tests_killed={killed_tests}")
    print(f"    new probe BROKEN={new_probe + new_api}")
    print(f"    tests rc={got['tests'][0]} {got['tests'][1]} failed={new_tests}")
    if not (killed_probe or killed_tests):
        survived.append(name)
print(f"SUMMARY mutants={len(mutants)} survived={survived}")
sys.exit(1 if survived else 0)
