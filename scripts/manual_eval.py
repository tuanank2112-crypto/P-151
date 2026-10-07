#!/usr/bin/env python3
"""
Manual eval — 6 kịch bản qua HTTP API thật, ghi output thực tế ra một file Markdown.

Usage:
  # Local (app chạy trong tiến trình, store memory, LLM mock)
  LLM_MODE=mock MO_STORE=memory PYTHONUTF8=1 python scripts/manual_eval.py

  # Online (gọi bản đã deploy)
  python scripts/manual_eval.py --base-url https://<host> --out <file.md>

File md là output máy: KHÔNG sửa tay, muốn đổi thì chạy lại.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VN_TZ = timezone(timedelta(hours=7))
PASSWORD = "Demo@2026"  # mật khẩu chung của tài khoản mô phỏng (seed/maintenance_v1/accounts.yaml)
DEFAULT_OUT = ROOT / "planning/02_2026-10-03_truong-mvp-prep/evidence/manual-eval/manual-eval-local.md"

# (id, tên, input cư dân, kỳ vọng {http, status, reason_code, risk_level, category})
CASES = [
    (
        "TC-01",
        "Vệ sinh bình thường",
        "Hành lang tầng 4 tòa SIM-B có nhiều rác và vết bẩn, cần vệ sinh.",
        {"http": 201, "status": "ROUTED", "reason_code": None, "category": "VE_SINH"},
    ),
    (
        "TC-02",
        "Đèn hỏng, thiết bị không có trong sổ tài sản",
        "Đèn hành lang tầng 8 tòa SIM-B không sáng từ tối qua.",
        {"http": 201, "status": "VERIFYING", "reason_code": "ASSET_UNCLEAR", "category": "KY_THUAT"},
    ),
    (
        "TC-03",
        "An toàn Bậc 1 (tia lửa, mùi khét)",
        "Đèn sảnh thang máy tầng 4 tòa SIM-B có tia lửa và mùi khét ở hộp đèn.",
        {"http": 201, "status": "VERIFYING", "reason_code": "EMERGENCY_PENDING_BQL", "risk_level": "EMERGENCY"},
    ),
    (
        "TC-04",
        "Thiếu vị trí",
        "Có rác, cần dọn.",
        {"http": 201, "status": "NEED_INFO", "reason_code": "MISSING_INFO"},
    ),
    (
        "TC-05",
        "Trùng với TC-01",
        "Hành lang tầng 4 tòa SIM-B nhiều rác bẩn, nhờ dọn giúp.",
        {"http": 201, "status": "VERIFYING", "reason_code": "DUPLICATE", "category": "VE_SINH"},
    ),
]


def _git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()
    except Exception:
        return "unknown"


def _client(base_url: str | None):
    if base_url:
        import httpx

        return httpx.Client(base_url=base_url.rstrip("/"), timeout=120)
    sys.path.insert(0, str(ROOT))
    from fastapi.testclient import TestClient

    from src.main import app

    return TestClient(app)


def _login(c, username: str) -> dict[str, str]:
    r = c.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _json(r):
    try:
        return r.json()
    except ValueError:
        return r.text


def _block(obj) -> str:
    return "```json\n" + json.dumps(obj, ensure_ascii=False, indent=2, default=str) + "\n```"


def _verdict(expected: dict, actual: dict) -> tuple[str, list[str]]:
    misses = [f"`{k}`: kỳ vọng `{v}`, thực tế `{actual.get(k)}`" for k, v in expected.items() if actual.get(k) != v]
    return ("PASS" if not misses else "FAIL"), misses


def run(c) -> list[dict]:
    resident, qa = _login(c, "cudan01"), _login(c, "qa01")
    results = []
    for case_id, name, text, expected in CASES:
        r = c.post("/api/v1/resident/tickets", headers=resident, json={"original_description": text})
        public = _json(r)
        actual = {"http": r.status_code}
        internal = None
        if r.status_code == 201:
            actual["status"] = public.get("status")
            full = c.get(f"/api/v1/mo/tickets/{public['ticket_id']}", headers=qa).json()
            ticket, proposal = full["ticket"], full.get("proposal") or {}
            internal = {
                "reason_code": (ticket.get("blocker") or {}).get("code"),
                "risk_level": ticket.get("risk_level"),
                "category": proposal.get("service_category_proposed"),
                "playbook_id": proposal.get("playbook_id"),
                "checklist_items": len(full.get("checklist_items") or []),
            }
            actual.update(internal)
        verdict, misses = _verdict(expected, actual)
        results.append(
            {
                "id": case_id,
                "name": name,
                "request": f"POST /api/v1/resident/tickets (cudan01)\n{json.dumps({'original_description': text}, ensure_ascii=False)}",
                "expected": expected,
                "public": public,
                "internal": internal,
                "verdict": verdict,
                "misses": misses,
            }
        )

    # TC-06: quyền — cư dân không được tự đóng ticket của TC-01
    target = results[0]["public"].get("ticket_id") if isinstance(results[0]["public"], dict) else None
    r = c.post(f"/api/v1/mo/tickets/{target}/transition", headers=resident, json={"to": "CLOSED"})
    body = _json(r)
    detail = body.get("detail", {}) if isinstance(body, dict) else {}
    actual = {"http": r.status_code, "code": detail.get("code") if isinstance(detail, dict) else None}
    expected = {"http": 403, "code": "ACTION_DENIED"}
    verdict, misses = _verdict(expected, actual)
    results.append(
        {
            "id": "TC-06",
            "name": "Phân quyền: cư dân tự đóng ticket",
            "request": f'POST /api/v1/mo/tickets/{target}/transition (cudan01)\n{{"to": "CLOSED"}}',
            "expected": expected,
            "public": body,
            "internal": None,
            "verdict": verdict,
            "misses": misses,
        }
    )
    return results


def render(results: list[dict], base_url: str | None) -> str:
    passed = sum(r["verdict"] == "PASS" for r in results)
    env = (
        f"online `{base_url}`"
        if base_url
        else f"local (LLM_MODE={os.getenv('LLM_MODE', '?')}, MO_STORE={os.getenv('MO_STORE', '?')})"
    )
    lines = [
        "# Manual Eval — MaintenanceOps Agent",
        "",
        "> Output máy sinh bởi `scripts/manual_eval.py`. KHÔNG sửa tay — muốn đổi thì chạy lại.",
        "",
        f"- **Observed at:** {datetime.now(VN_TZ).isoformat(timespec='seconds')}",
        f"- **Branch:** {_git('rev-parse', '--abbrev-ref', 'HEAD')}",
        f"- **Commit:** {_git('rev-parse', 'HEAD')}",
        f"- **Working tree:** {'dirty' if _git('status', '--porcelain') else 'clean'}",
        f"- **Environment:** {env}",
        f"- **Result:** {passed}/{len(results)} PASS",
        "",
        "## Tổng hợp",
        "",
        "| # | Kịch bản | Kỳ vọng | Kết quả |",
        "| :--- | :--- | :--- | :--- |",
    ]
    for r in results:
        exp = ", ".join(f"{k}={v}" for k, v in r["expected"].items())
        lines.append(
            f"| {r['id']} | {r['name']} | `{exp}` | {'✅' if r['verdict'] == 'PASS' else '❌'} {r['verdict']} |"
        )
    for r in results:
        lines += ["", f"## {r['id']} — {r['name']}", "", "**Request**", "", "```http", r["request"], "```", ""]
        lines += ["**Kỳ vọng**", "", _block(r["expected"]), "", "**Response (API trả về)**", "", _block(r["public"])]
        if r["internal"] is not None:
            lines += ["", "**Trạng thái nội bộ (đọc lại bằng qa01)**", "", _block(r["internal"])]
        lines += ["", f"**Kết quả:** {r['verdict']}"]
        lines += [f"- {m}" for m in r["misses"]]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", help="URL bản online; bỏ trống = chạy app local trong tiến trình")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="file Markdown đầu ra")
    args = parser.parse_args()

    with _client(args.base_url) as c:
        results = run(c)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(render(results, args.base_url), encoding="utf-8")
    passed = sum(r["verdict"] == "PASS" for r in results)
    print(f"{passed}/{len(results)} PASS -> {args.out}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
