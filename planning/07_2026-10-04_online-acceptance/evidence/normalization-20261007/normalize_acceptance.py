"""Normalize existing evidence only; no HTTP, database, or application execution."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
PLAN = ROOT / "planning/07_2026-10-04_online-acceptance"
OUT = PLAN / "deliverables"
EVIDENCE = PLAN / "evidence/normalization-20261007"
SCHEMA = "day04-3"
ACTIVE = ["H01", "H02", "I01", "A01", "M01", "U01", "S04", "G03", "R01"]
REMOVED = ["S01", "S02", "S03", "S05", "G01", "G02"]
LEGACY = "local-ui-20261004-05"
LIVE = "local-supabase-20261007"
NOW = datetime.now(UTC).isoformat()


def ref(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(name: str, value: dict) -> None:
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def issue(number, run, cases, owner, expected, actual, evidence, next_step, status="OPEN", severity="MINOR"):
    return {
        "issue_id": f"D4-{number:02d}",
        "run_id": run,
        "case_ids": cases,
        "severity": severity,
        "owner": owner,
        "expected": expected,
        "actual": actual,
        "reproduce": ["Đọc evidence và đối chiếu expected của ca; chưa chạy lại trong lượt chuẩn hóa."],
        "evidence_refs": evidence,
        "status": status,
        "retest_ref": None,
        "next_step": next_step,
    }


def build():
    evaluation = ROOT / "evaluation.md"
    machine = PLAN / "evidence/supabase-demo-20261007/result.json"
    report = OUT / "shared-supabase-demo-20261007.md"
    raw = json.loads(read(machine))
    sections = {}
    for section in re.split(r"(?m)^### ", read(evaluation))[1:]:
        match = re.search(r"\b([HIA MUSGR]\d{2})\b", section.splitlines()[0].replace(" ", ""))
        if match:
            sections[match[1]] = section
    assert set(sections) == set(ACTIVE), sorted(sections)
    manifests = []
    common = {"environment": "local-qa", "confirmed_at": None}
    manifests.append(
        common
        | {
            "run_id": LEGACY,
            "base_url": "http://localhost:8000",
            "build_sha": "3efb660",
            "dirty_worktree": None,
            "build_identity_status": "REPORT_ONLY",
            "configuration_source": ref(evaluation),
            "llm_mode": "mock",
            "model": None,
            "store_mode": "memory",
            "photo_store_mode": None,
            "confirmed_by": "Cao Văn Trường (báo cáo lịch sử)",
            "confirmation_source": ref(evaluation),
            "confirmation_status": "REPORT_ONLY",
            "mutation_scope": "Ticket/vật tư SIM-* của lượt demo local lịch sử",
            "photo_scope": "Ảnh minh họa trên UI; chưa có bằng chứng Storage của lượt cũ",
            "evidence_refs": [ref(evaluation)],
        }
    )
    manifests.append(
        common
        | {
            "run_id": LIVE,
            "base_url": "http://127.0.0.1:8001",
            "build_sha": "8dd6baa5e733fd9dd917b30522b131d520471e05",
            "dirty_worktree": True,
            "build_identity_status": "BASE_SHA_ONLY",
            "configuration_source": ref(machine),
            "llm_mode": "openai",
            "model": raw["configuration"]["model"],
            "store_mode": raw["configuration"]["store"],
            "photo_store_mode": raw["configuration"]["photos"],
            "confirmed_by": "Trường (cho phép demo trong phiên)",
            "confirmation_source": "User authorized shared-Supabase demo; result.json confirms configuration and scope",
            "confirmation_status": "EXECUTION_EVIDENCE",
            "mutation_scope": "Chỉ SIM-TKT-0042; jobs/seed/reset false; 53 ticket cũ và tồn kho không đổi",
            "photo_scope": "Hai PNG mô phỏng trong private maintenance-photos, hash khớp API/Storage",
            "evidence_refs": [ref(machine), ref(report)],
        }
    )
    manifest = {
        "schema_version": SCHEMA,
        "normalized_at": NOW,
        "active_case_ids": ACTIVE,
        "scope_decision": {
            "authorized_by": "Cao Văn Trường",
            "authorized_on": "2026-10-07",
            "source": "User explicitly requested removal of six NOT_RUN cases and normalization of valid evidence",
            "removed_case_ids": REMOVED,
        },
        "runs": manifests,
    }
    tickets = {
        "H01": ["SIM-TKT-0001"],
        "H02": ["SIM-TKT-0002"],
        "I01": ["SIM-TKT-0003"],
        "A01": ["SIM-TKT-TEC-002"],
        "M01": ["SIM-TKT-TEC-003"],
        "U01": ["SIM-TKT-0004", "SIM-TKT-0005"],
        "S04": ["SIM-TKT-0006"],
        "G03": ["SIM-TKT-TEC-005"],
        "R01": [],
    }
    tasks = {
        "H01": "D4-02",
        "H02": "D4-02",
        "I01": "D4-03",
        "A01": "D4-03",
        "M01": "D4-04",
        "U01": "D4-04",
        "S04": "D4-05",
        "G03": "D4-06",
        "R01": "D4-07",
    }
    actual = {
        "H01": "Báo cáo cũ: giao Vệ sinh, checklist/vật tư/ảnh, READY_FOR_REVIEW -> CLOSED và timeline cư dân.",
        "H02": "Báo cáo cũ: giao Kỹ thuật, SIM-ASSET-LIGHT-001, đủ vật tư/ảnh, CLOSED và timeline.",
        "I01": "Báo cáo cũ: thiếu tòa -> NEED_INFO; BPTN bổ sung -> ROUTED; raw giữ nguyên.",
        "A01": "Báo cáo cũ: BPTN xác nhận onsite, ROUTED Kỹ thuật với ASSET_CHECK_ONSITE.",
        "M01": "Báo cáo cũ: kho nhập1 vẫn dừng, nhập1 nữa đủ thì giao. Chưa kiểm resume lần hai.",
        "U01": "Báo cáo cũ: cảnh báo trùng, BPTN chọn không gộp rồi đi tiếp.",
        "S04": "Báo cáo cũ: EMERGENCY_PENDING_BQL -> BQL đóng. Một số ảnh hiển thị ticket khác.",
        "G03": "Báo cáo cũ: BPTN hạ bậc và phòng sai accept đều403; chưa có GET sau thao tác độc lập.",
        "R01": "Store memory; không chứng minh dữ liệu/ảnh lưu bền sau restart.",
    }
    defaults = {
        "M01": "Thiếu vật tư dừng; nhập chưa đủ vẫn dừng; đủ thì tự giao; resume không giao trùng.",
        "G03": "BPTN không được hạ/đóng Bậc1; department sai không accept; state nghiệp vụ không đổi.",
    }
    limits = {
        "A01": "Ảnh A01_02 hiển thị ticket khác; đối chiếu A01_01/A01_03.",
        "M01": "Thiếu kiểm resume lần hai và thông báo chạy tiếp có thể xuất hiện sớm.",
        "S04": "S04_02/S04_04 lệch ticket; chưa có bằng chứng thay thế đủ để tái xác nhận.",
        "G03": "Ảnh G03_03 không phải GET state độc lập sau cả hai thao tác.",
    }
    ids = {
        "R01": ["D4-01"],
        "M01": ["D4-02"],
        "S04": ["D4-03"],
        "G03": ["D4-04"],
        "A01": ["D4-05"],
        "H01": ["D4-09"],
        "H02": ["D4-09"],
        "U01": ["D4-10"],
    }
    legacy = []
    for cid in ACTIVE:
        s = sections[cid]
        expected = re.search(r"- \*\*Expected[^\n]*", s)
        references = [ref(evaluation)] + re.findall(r"\]\((planning/[^)]+)\)", s)
        legacy.append(
            {
                "case_id": cid,
                "task_id": tasks[cid],
                "actor_role": "RESIDENT/BPTN/DEPARTMENT/BQL/QA",
                "ticket_ids": tickets[cid],
                "started_at": None,
                "ended_at": None,
                "time_precision": "not_recorded",
                "expected": expected.group(0) if expected else defaults.get(cid, "Theo SPEC-P01 của ca"),
                "actual": actual[cid],
                "result": "BLOCKED" if cid == "R01" else "PASS",
                "evidence_basis": "HISTORICAL_REPORT",
                "evidence_refs": list(dict.fromkeys(references)),
                "issue_ids": ids.get(cid, []),
                "limitations": [
                    "PASS là kết luận báo cáo lịch sử; chưa đo lại trên build hiện tại.",
                    "Không có thời điểm bắt đầu/kết thúc chính xác từng ca.",
                ]
                + ([limits[cid]] if cid in limits else []),
            }
        )
    live = [
        {
            "case_id": "H01",
            "task_id": "D4-02",
            "actor_role": "RESIDENT/DEPARTMENT/BQL/QA",
            "ticket_ids": [raw["ticket_id"]],
            "started_at": raw["initial_case"]["ticket"]["raw"]["created_at"],
            "ended_at": raw["final_case"]["ticket"]["closed_at"],
            "time_precision": "exact",
            "expected": "Tạo phản ánh thành công201 rồi ROUTED -> IN_PROGRESS -> READY_FOR_REVIEW -> CLOSED, thiếu ảnh bị chặn.",
            "actual": "POST create422 sau ingest RECEIVED; sửa merged_children và recovery cùng ticket; luồng xử lý đạt CLOSED, thiếu ảnh chặn đúng.",
            "result": "FAIL",
            "evidence_basis": "MACHINE_EVIDENCE",
            "evidence_refs": [ref(machine), ref(report)],
            "issue_ids": ["D4-06", "D4-07"],
            "limitations": [
                "Recovery thành công không thay thế retest POST create trả201.",
                "Chạy API/script, không walkthrough UI theo vai.",
            ],
        },
        {
            "case_id": "R01",
            "task_id": "D4-07",
            "actor_role": "QA/SERVER_OPERATOR",
            "ticket_ids": [raw["ticket_id"]],
            "started_at": None,
            "ended_at": None,
            "time_precision": "not_recorded",
            "expected": "Postgres giữ ticket CLOSED, ảnh, audit và tồn kho sau restart; ảnh tải lại đúng bytes/hash.",
            "actual": "CLOSED sau restart, hai ảnh API/Storage khớp; ledger24, notifications7, stock không đổi, 53 ticket cũ không đổi.",
            "result": "PASS",
            "evidence_basis": "MACHINE_EVIDENCE",
            "evidence_refs": [ref(machine), ref(report)],
            "issue_ids": ["D4-07"],
            "limitations": ["Chưa ghi timestamp từng bước stop/start; không dùng mtime thay event time."],
        },
    ]
    run_results = []
    for run_id, rows, observed in [(LEGACY, legacy, None), (LIVE, live, "2026-10-07T04:11:12.207497+00:00")]:
        counts = Counter(x["result"] for x in rows)
        recorded = [x["case_id"] for x in rows]
        run_results.append(
            {
                "run_id": run_id,
                "observed_at": observed,
                "records": rows,
                "coverage": {
                    "recorded_case_ids": recorded,
                    "unmeasured_active_case_ids": [c for c in ACTIVE if c not in recorded],
                },
                "counts": {k: counts[k] for k in ["PASS", "FAIL", "BLOCKED"]},
                "interpretation": "Separate run evidence; do not aggregate across builds. Historical PASS is reported, not newly measured.",
            }
        )
    issues = [
        issue(
            1,
            LEGACY,
            ["R01"],
            "Châm Anh / persistence",
            "Postgres persistence",
            "Legacy memory cannot establish persistence",
            [ref(evaluation)],
            "Dùng R01 của run Supabase riêng; không sửa kết quả memory thành PASS",
        ),
        issue(
            2,
            LEGACY,
            ["M01"],
            "Trường / Châm Anh",
            "Resume lặp không giao trùng",
            "Lượt cũ chỉ đo nhập1+1, chưa resume lần hai",
            [ref(evaluation)],
            "Đo idempotency trên QA cô lập; không nhập kho chung để tạo fixture",
        ),
        issue(
            3,
            LEGACY,
            ["S04"],
            "Trường / Trí",
            "Evidence cùng ticket trước/sau BQL đóng",
            "S04_02/S04_04 hiển thị ticket khác",
            [ref(evaluation)],
            "Bổ sung evidence cùng ticket hoặc chạy lại S04 trên QA phù hợp",
            severity="MAJOR",
        ),
        issue(
            4,
            LEGACY,
            ["G03"],
            "Trường / Châm Anh",
            "403 + state không đổi",
            "Thiếu GET độc lập sau cả hai thao tác",
            [ref(evaluation)],
            "Đo GET trước/sau guard trên QA, giữ audit denial",
        ),
        issue(
            5,
            LEGACY,
            ["A01"],
            "Trường / Trí",
            "Ảnh xác nhận onsite cùng ticket",
            "A01_02 hiển thị ticket khác",
            [ref(evaluation)],
            "Kiểm A01_01/A01_03 và bổ sung evidence đúng ticket",
        ),
        issue(
            6,
            LIVE,
            ["H01"],
            "Như Ý / Châm Anh",
            "POST resident/tickets201 xuyên suốt",
            "422 do shared merged_children absent locally; fix applied, same ticket recovered; no clean create retest",
            [ref(machine), ref(PLAN / "evidence/supabase-demo-20261007/agent-recovery.json")],
            "Đo create mới trên QA cô lập hoặc trong scope ghi shared được cho phép; giữ FIXED_PENDING_RETEST đến201",
            status="FIXED_PENDING_RETEST",
            severity="MAJOR",
        ),
        issue(
            7,
            LIVE,
            ["H01", "R01"],
            "Trường / integration",
            "Build/source fingerprint và thời gian từng bước được ghi",
            "Base SHA known, dirty source not fingerprinted at execution; exact per-step restart times missing",
            [ref(machine), ref(report)],
            "Lượt sau ghi manifest/source hash và UTC trước/sau restart; không bịa lượt cũ",
        ),
        issue(
            8,
            None,
            [],
            "Leader / Châm Anh",
            "Public deployment and group sign-off if claimed",
            "Only localhost; no documented leader acceptance",
            [ref(evaluation), ref(report)],
            "Bàn giao hồ sơ giới hạn local; chỉ xác nhận online/leader khi có bằng chứng thật",
        ),
        issue(
            9,
            LEGACY,
            ["H01", "H02"],
            "Châm Anh / backend",
            "Thông báo ngoài giờ phù hợp hành vi nhận việc",
            "Báo cáo cũ: báo xử lý từ06:00 nhưng phòng ban vẫn nhận và hoàn tất trước06:00",
            [ref(evaluation)],
            "Owner xác nhận hành vi theo thiết kế và wording; chưa tự kết luận đây là bug",
        ),
        issue(
            10,
            LEGACY,
            ["U01"],
            "Trí / UI, Như Ý / rules",
            "Wording thời hạn thống nhất và cư dân hiểu được",
            "Báo cáo cũ: thẻ4h nhưng ghi chú2 days; form cư dân còn chữ Agent",
            [ref(evaluation)],
            "Rà wording build hiện hành, lưu evidence trước/sau sửa",
        ),
    ]
    safety_probe = EVIDENCE / "safety-child-trapped.json"
    if safety_probe.exists():
        safety_issue = issue(
            11,
            None,
            ["S04"],
            "Như Ý / engine safety; Châm Anh phối hợp tích hợp và retest API",
            "Có trẻ con bị kẹt phải được S-09 nhận diện EMERGENCY, VERIFYING/EMERGENCY_PENDING_BQL, owner BQL",
            "Local probe exact screenshot text gives NONE/OUT_OF_SCOPE/BPTN; S1 variant also fails; adding mắc routes emergency correctly",
            [ref(safety_probe), "seed/maintenance_v1/lexicon.yaml", "docs/CR-BPTN-03.md"],
            "Mở rộng nhận diện person+trapped có ngữ cảnh, test phủ định/đa nghĩa và safety regression; retest pipeline/API/UI trước CLOSED",
            severity="CRITICAL",
        )
        safety_issue["reproduce"] = [
            "Run assess and memory/mock engine.receive for: có trẻ con bị kẹt ở sảnh chung cư tòa S5",
            "Compare S1 variant and bị mắc kẹt variant; inspect local machine probe JSON",
            "User screenshot ticket TK-0046 was not queried or modified; live backend build is not identified",
        ]
        issues.append(safety_issue)
    write("manifest.json", manifest)
    write(
        "results.json", {"schema_version": SCHEMA, "normalized_at": NOW, "active_case_ids": ACTIVE, "runs": run_results}
    )
    write("issues.json", {"schema_version": SCHEMA, "normalized_at": NOW, "issues": issues})
    sources = [evaluation, machine, report]
    if safety_probe.exists():
        sources.extend([safety_probe, ROOT / "seed/maintenance_v1/lexicon.yaml", ROOT / "docs/CR-BPTN-03.md"])
    (EVIDENCE / "source-hashes.json").write_text(
        json.dumps({ref(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "normalized_at": NOW,
                "active_cases": ACTIVE,
                "legacy_counts": run_results[0]["counts"],
                "supabase_counts": run_results[1]["counts"],
                "issues": len(issues),
                "shared_writes": False,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    build()
