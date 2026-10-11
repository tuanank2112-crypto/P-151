"""Plan 12 R01 fixes: each mutant re-opens one audit finding; the photo tests must go RED on every one.

Usage (repo root): python planning/12_2026-10-09_backend-latency/evidence/harness/mutate_r01.py
Every file is restored byte for byte (sha256 checked) whatever happens.
"""

import hashlib
import os
import pathlib
import subprocess
import sys

ROUTER = pathlib.Path("src/api/routers/maintenance.py")
PHOTOS = pathlib.Path("src/api/photos.py")
TESTS = ["tests/test_maintenance/test_backend_latency.py", "tests/test_maintenance/test_photo_store.py"]

MUTANTS = {
    "m6-immutable-again (R01 #2)": (
        ROUTER,
        '"Cache-Control": "private, no-cache"',
        '"Cache-Control": "private, max-age=31536000, immutable"',
    ),
    "m7-304-before-access-check (R01 #2)": (
        ROUTER,
        '    record = next((e for e in allowed(case) if e.evidence_id == evidence_id), None)\n    if record is None:\n'
        '        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")\n    etag',
        '    if request.headers.get("if-none-match"):\n        return Response(status_code=304)\n'
        '    record = next((e for e in allowed(case) if e.evidence_id == evidence_id), None)\n    if record is None:\n'
        '        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh")\n    etag',
    ),
    "m8-etag-from-evidence-id (R01 #3)": (
        ROUTER,
        "etag = photos.etag(record.content_or_metadata)",
        "etag = f'\"{record.evidence_id}\"'",
    ),
    "m9-department-route-reads-files-first (R01 #7)": (
        ROUTER,
        "    await run_in_threadpool(_staff_case, engine, actor, ticket_id)\n",
        "",
    ),
    "m10-resident-route-reads-files-first (R01 #7)": (
        ROUTER,
        "    await run_in_threadpool(_own_case, engine, ticket_id, actor)  # 403/404 before judging the files (R01 #7)\n",
        "",
    ),
    "d-gzip-may-touch-photos (R01 #14)": (
        ROUTER,
        '"Cache-Control": "private, no-cache", "Content-Encoding": "identity"}',
        '"Cache-Control": "private, no-cache"}',
    ),
    "f-resident-route-serves-any-photo (R01 #14)": (
        ROUTER,
        "evidence_id, resident_photos)",
        "evidence_id, lambda c: c.evidence)",
    ),
    "g-cache-without-byte-budget (R01 #14)": (
        PHOTOS,
        "            while self._size > self.budget:\n",
        "            while False:\n",
    ),
}


def sha(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_tests() -> tuple[int, str]:
    env = {**os.environ, "LLM_MODE": "mock", "PYTHONUTF8": "1"}
    done = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *TESTS],
        capture_output=True,
        text=True,
        env=env,
    )
    return done.returncode, done.stdout.strip().splitlines()[-1]


originals = {path: path.read_bytes() for path in (ROUTER, PHOTOS)}
before = {path: sha(path) for path in originals}
red = 0
try:
    for name, (path, old, new) in MUTANTS.items():
        text = originals[path].decode("utf-8")
        crlf, lf = chr(13) + chr(10), chr(10)  # the sources are CRLF on Windows checkouts
        newline = crlf if crlf in text else lf
        old, new = old.replace(lf, newline), new.replace(lf, newline)
        assert text.count(old) == 1, f"{name}: anchor found {text.count(old)} times"
        path.write_bytes(text.replace(old, new).encode("utf-8"))
        code, summary = run_tests()
        path.write_bytes(originals[path])
        red += code != 0
        print(f"{'RED ' if code else 'LIVE'} {name}: exit={code} {summary}")
finally:
    for path, data in originals.items():
        path.write_bytes(data)
restored = all(sha(path) == before[path] for path in originals)
code, summary = run_tests()
print(f"restored byte for byte: {'yes' if restored else 'NO'}; green after restore: exit={code} {summary}")
print(f"RESULT: {red}/{len(MUTANTS)} mutants red")
sys.exit(0 if red == len(MUTANTS) and restored and code == 0 else 1)
