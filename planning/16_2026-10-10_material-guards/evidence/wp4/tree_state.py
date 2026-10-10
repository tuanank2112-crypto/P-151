"""WP4: fingerprint of the shared working tree (runtime/test/spec files) so a run can prove it changed nothing.

Usage: python tree_state.py <repo>   -> prints HEAD, porcelain status, sha256(git diff HEAD) and one tree hash.
"""
import hashlib
import subprocess
import sys
from pathlib import Path

repo = Path(sys.argv[1])
run = lambda *a: subprocess.run(a, cwd=repo, capture_output=True).stdout  # noqa: E731
print("HEAD", run("git", "rev-parse", "HEAD").decode().strip())
status = run("git", "status", "--porcelain").decode()
print("status_lines", len(status.splitlines()), "status_sha256", hashlib.sha256(status.encode()).hexdigest())
print("diff_head_sha256", hashlib.sha256(run("git", "diff", "HEAD")).hexdigest())
total = hashlib.sha256()
count = 0
roots = ["src", "tests", "seed", "planning/16_2026-10-10_material-guards/specs"]
for root in roots:
    for path in sorted((repo / root).rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
            total.update(str(path.relative_to(repo)).encode() + b"\0" + hashlib.sha256(path.read_bytes()).digest())
            count += 1
print("tree_files", count, "tree_sha256", total.hexdigest())
