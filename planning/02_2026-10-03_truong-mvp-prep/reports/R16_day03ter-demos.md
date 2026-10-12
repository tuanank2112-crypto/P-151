Worker · thi công · Sonnet · Bước 0 exit 1 (hub C:\brain4agent.release thiếu, MODULE_NOT_FOUND, vẫn tiếp tục) · hiểu việc: phạm vi = ghi chỉ deliverables/ter + evidence/ter + R16, không sửa worktree/src/tests/seed; xong khi = 15 record D3-06 PASS/FAIL/BLOCKED dựa trên đo, JSON hợp lệ, evidence tồn tại; cấm = đổi expected để đạt, commit/push
Handoff: ../handoffs/H16_day03ter-demos.md
Base: 92649a6152737154cca606f3ce94d3f0ec0e0273
Head: 92649a6152737154cca606f3ce94d3f0ec0e0273 (không commit)

## Lệnh + exit
- `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` exit 1 (MODULE_NOT_FOUND) — `evidence/ter/demos/init-brain-exit.txt`.
- Worktree: HEAD 92649a61..., branch detached (chứa trong origin/feature/nhuy-safety-routes) — `evidence/ter/demos/git-head.txt`; `git status --short` worktree = 0 dòng sau đo.
- Env ép + cwd/PYTHONPATH = worktree; `python evidence/ter/demos/harness.py <case>` mỗi ca một process:

| case | exit | checks ok/total |
|---|---|---|
| g1a | 0 | 26/26 |
| g1r | 0 | 31/31 |
| t2safe | 0 | 17/17 |
| t2escalate | 0 | 10/10 |
| t2info | 1 | 7/8 (1 lệch: owner literal OPERATIONS §5.2.3, xem notes) |
| t1close | 0 | 13/13 |
| t1down | 0 | 13/13 |
| neg403 | 0 | 34/34 |
| t2dl | 0 | 5/5 |
| t2dl12 | 0 | 3/3 |
| d01a | 1 | 2/3 (delta 409) |
| d01b | 0 | 4/4 |
| d01c | 1 | 2/3 (delta 409) |
| tgen (quan sát) | 1 | 1/2 (route close chung đóng được emergency) |

## Phán quyết record (`deliverables/ter/D3-06.json`, 15 record, 13 PASS / 2 BLOCKED / 0 FAIL)
PASS: DEMO-04-SAFETY-TIER2, T2-CONFIRM-SAFE, T2-ESCALATE, T2-REQUEST-INFO, T2-DEADLINE-4H, T2-DEADLINE-12H, DEMO-04-SAFETY-TIER1, T1-EMERGENCY-CLOSE, T1-EMERGENCY-DOWNGRADE, NEG-403, D01-B, DEMO-01A-CLEANING, DEMO-01-RATING.
BLOCKED (owner Như Ý): D01-A-AFTER-CONFIRM-SAFE, D01-C-DELTA-ON-EMERGENCY (additions chỉ nhận ở NEED_INFO; không lộ snapshot/delta).
Chi tiết lệch: `deliverables/ter/D3-06-notes.md`. JSON load được, mọi evidence_refs tồn tại (script kiểm khi sinh).

## So với Day03-bis
DEMO-04 Bậc 2/Bậc 1 BLOCKED -> PASS; 01A/01-RATING giữ PASS; D01 vẫn chưa code (A/C BLOCKED).

## Bảng phân công
| gói | tầng yêu cầu | họ/model đã dùng |
|---|---|---|
| DEMO-04 ter (harness + đo + JSON) | 🟠 | Sonnet |

## Việc KHÔNG làm
Không đo persistence restart/online/UI; không đo phần "LLM input = delta+snapshot" (không lộ ra API); không sửa SPEC/OPERATIONS; không phóng thêm agent; không commit.

## Câu hỏi cần người
1. OPERATIONS §5.2.3 (owner NEED_INFO) lệch CR-03 §6.4: sửa SPEC theo CR-03? (Trường)
2. Route `/bql/.../close` chung đóng được ticket khẩn cấp: chủ ý hay cần chặn? (Như Ý/Trường)
3. D01 A/C: mở additions sau clearance/khẩn cấp hay chốt NEED_INFO-only? (Như Ý)

## Root đo lại (2026-10-03)

Root chạy lại độc lập 9 nhóm harness trong scratchpad với worktree 92649a6 (evidence/root/day03ter-rerun-*): khớp worker (t2info 8/7 và tgen 2/1 là lệch expected của harness cũ vs hành vi mới, đã giải thích trong report). JSON 15 record hợp lệ. Lệch OPERATIONS §5.2.3 (chủ cư dân) root đã sửa chữ.

✅ DUYỆT (Day03-ter demos: 13 PASS, 2 BLOCKED D01 owner Như Ý; local cô lập, không khẳng định runtime/online)
