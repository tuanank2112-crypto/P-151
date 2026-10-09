"""Plan 14 mutants: each must turn at least one of the new/changed tests red; every file is restored byte for byte."""
import pathlib
import subprocess
import sys

PY = sys.executable
TESTS = ["tests/test_maintenance/test_area_assets.py", "tests/test_maintenance/test_api.py::test_catalog_feeds_the_ui"]
MUTANTS = {
    "m1-match-exact-location": ("src/maintenance/engine.py",
        "a.asset_type == \"LIGHTING\" and a.active and a.area == area]",
        "a.asset_type == \"LIGHTING\" and a.active and a.location_normalized == location]"),
    "m2-guard-accepts-retired": ("src/maintenance/engine.py",
        "a.asset_id == asset_id and a.active for a in self.catalog.assets",
        "a.asset_id == asset_id for a in self.catalog.assets"),
    "m3-api-lists-retired": ("src/api/routers/maintenance.py",
        "for a in catalog.assets if a.active]", "for a in catalog.assets]"),
    "m4-no-one-per-area-check": ("src/maintenance/catalog.py",
        "        if twice:\n            raise", "        if False:\n            raise"),
}
failed = 0
for name, (path, old, new) in MUTANTS.items():
    p = pathlib.Path(path)
    original = p.read_bytes()
    text = original.decode("utf-8")
    assert text.count(old) == 1, (name, text.count(old))
    try:
        p.write_bytes(text.replace(old, new).encode("utf-8"))
        r = subprocess.run([PY, "-m", "pytest", "-q", "-p", "no:cacheprovider", *TESTS], capture_output=True, text=True, encoding="utf-8", errors="replace")
        red = r.returncode != 0
        print(f"{name}: {'RED' if red else 'GREEN (mutant survived)'} exit={r.returncode} {r.stdout.strip().splitlines()[-1]}")
        failed += not red
    finally:
        p.write_bytes(original)
    assert p.read_bytes() == original
print(f"mutants red: {len(MUTANTS) - failed}/{len(MUTANTS)}")
sys.exit(1 if failed else 0)
