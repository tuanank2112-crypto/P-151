"""Blind review sheet for human reviewers: opaque id + text only, order and ids shuffled deterministically.

Reviewers see `RV-001..` (stored under the key `case_id`), never the real case_id: ids are assigned in a shuffled order
seeded by sha256(cases.json bytes), so neither the id nor the position leaks the original id order. The RV -> case_id
`id-map.json` goes to --map-out (default `<out>/id-map.json`) and is for the orchestrator ONLY, never for a reviewer.
No family/notes/source/proposal/eligibility/split ever reaches the sheet. Exit 0 ok, 1 unusable cases.json.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

EMPTY = {
    "safety_risk": None,
    "signals": [],
    "classification": None,
    "rationale": "",
    "reviewer": "",
    "reviewed_at": None,
    "dispute_note": "",
}
WARNING = "CHỈ cho điều phối, không đưa reviewer"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--out", required=True, help="directory that receives blind-review-sheet.json")
    ap.add_argument("--map-out", help="RV -> case_id map (default <out>/id-map.json); orchestrator only")
    a = ap.parse_args(argv)
    try:
        raw = (Path(a.data_dir) / "cases.json").read_bytes()
        rows = [(r["case_id"], r["text"]) for r in json.loads(raw)["records"]]
        if not all(isinstance(i, str) and isinstance(t, str) for i, t in rows) or len({i for i, _ in rows}) != len(
            rows
        ):
            raise ValueError("case_id/text must be strings and case_id unique")
        if any(i in t for i, _ in rows for _, t in rows):
            raise ValueError("a case text contains a case_id: the sheet cannot be blind")
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"BAD_CASES: {type(exc).__name__}: {exc}")
        return 1
    seed = hashlib.sha256(raw).hexdigest()
    rows.sort(key=lambda r: hashlib.sha256(f"{seed}:{r[0]}".encode()).hexdigest())
    ids = {f"RV-{n:03d}": row for n, row in enumerate(rows, 1)}
    now = datetime.now(UTC).isoformat()
    sheet = {
        "schema_version": "day05-1",
        "created_at": now,
        "records": [{"case_id": rv, "text": text, **EMPTY} for rv, (_, text) in ids.items()],
    }
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "blind-review-sheet.json").write_text(
        json.dumps(sheet, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    id_map = {
        "schema_version": "day05-1",
        "created_at": now,
        "warning": WARNING,
        "map": {k: v[0] for k, v in ids.items()},
    }
    map_out = Path(a.map_out) if a.map_out else out / "id-map.json"
    map_out.parent.mkdir(parents=True, exist_ok=True)
    map_out.write_text(json.dumps(id_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK blind-review-sheet.json records={len(rows)}")
    enc = sys.stdout.encoding or "utf-8"  # a cp1252 console must not crash after the files are written
    print(f"WARNING {map_out}: {WARNING}".encode(enc, "backslashreplace").decode(enc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
