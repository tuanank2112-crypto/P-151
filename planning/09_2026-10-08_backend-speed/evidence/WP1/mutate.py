"""Apply one mutant to a source file, run the plan 09 tests, restore the file byte for byte (from memory)."""
import os, pathlib, subprocess, sys
MUTANTS = {
    "a-keep-deleted-rows": ("src/maintenance/store/postgres.py",
        "        cache: dict[str, tuple[str, Case]] = {}\r\n",
        "        cache: dict[str, tuple[str, Case]] = dict(known)\r\n"),
    "b-skip-sql-when-warm": ("src/maintenance/store/postgres.py",
        "        ids = list(known)\r\n",
        "        ids = list(known)\r\n        if known:\r\n            return [case for _, case in known.values()]\r\n"),
    "c-no-lookup-in-resident-list": ("src/api/routers/maintenance.py",
        "    return [resident_view(engine, c, now, lookup) for c in own]",
        "    return [resident_view(engine, c, now) for c in own]"),
    "d-cache-before-validate": ("src/maintenance/store/postgres.py",
        "                cache[row.ticket_id] = (row.v, Case.model_validate(row.doc))\r\n",
        "                self._list_cache.pop(row.ticket_id, None)\r\n                cache[row.ticket_id] = (row.v, Case.model_validate(row.doc))\r\n"),
}
name = sys.argv[1]
path, old, new = MUTANTS[name]
p = pathlib.Path(path); original = p.read_bytes(); src = original.decode()
assert src.count(old) == 1, f"{name}: anchor not found once"
try:
    p.write_bytes(src.replace(old, new).encode())
    r = subprocess.run([sys.executable, "-m", "pytest", "tests/test_maintenance/test_list_cache.py", "--pg", "-q",
                        "-p", "no:cacheprovider"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = [l for l in r.stdout.splitlines() if l.startswith("FAILED") or " passed" in l or " failed" in l]
    print(f"mutant {name}: pytest exit={r.returncode}"); print("\n".join(lines))
finally:
    p.write_bytes(original)
assert p.read_bytes() == original
