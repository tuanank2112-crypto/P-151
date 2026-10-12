Worker · thi công · Sonnet · Bước 0 exit 1 (hub ../brain4agent.release thiếu, MODULE_NOT_FOUND, không sửa) · hiểu việc: phạm vi = ghi P/deliverables/day04, P/evidence/day04, report này; xong khi = results.json hợp lệ + evidence tồn tại + không còn LISTEN 8184; cấm = sửa worktree đo/src/tests/seed, DB chung, commit/push, đổi expected
Handoff: planning/02_2026-10-03_truong-mvp-prep/handoffs/H18_day04-localhost.md
Base: dff898e5cfcfef3ebfe39af9cb83a938ed275fbf (worktree dev3, status sạch)
Head: b937956 (repo chính; không commit, thay đổi chỉ là file chưa theo dõi)

## Lệnh + exit (evidence/day04/*-exit.txt, driver-log.txt)
`evidence/day04/run_case.sh <case>`: uvicorn 127.0.0.1:8184 env ép + harness.py (httpx) + dừng server. 15 case, mỗi case server mới. `persist_ui.sh`: UI-SMOKE + PERSIST-RESTART, exit 0. Sau mọi lượt: LISTEN 8184 = 0.
| case | exit | checks ok/total |
| g1a, g1b, g1r | 0, 0, 0 | 26/26, 26/26, 31/31 |
| g2, g2neg | 0, 0 | 13/13, 10/10 |
| g3 | 1 | 19/21 |
| t2safe, t2escalate | 0, 0 | 17/17, 10/10 |
| t2info | 1 | 7/8 |
| t1close, t1down, neg403, tgen | 0 | 13/13, 13/13, 34/34, 2/2 |
| t2dl, t2dl12 | 0, 0 | 5/5, 3/3 |

## Kết quả (deliverables/day04/results.json: 18 record, 16 PASS, 2 BLOCKED, 0 FAIL)
PASS: DEMO-01A, 01B, 01-RATING, 02-NEED-INFO, 02-ASSET-UNCLEAR, 04 (TIER2, T2-CONFIRM-SAFE, T2-ESCALATE, T2-REQUEST-INFO, DEADLINE-4H, DEADLINE-12H, TIER1, T1-EMERGENCY-CLOSE, T1-EMERGENCY-DOWNGRADE, NEG-403), UI-SMOKE (chỉ HTTP 200, chưa đo UI thao tác).
BLOCKED: DEMO-03-STOCK (Châm Anh: không có GET tồn kho qua HTTP, 2 check số đo trung gian không đo được); PERSIST-RESTART (Châm Anh: cần Postgres/Supabase; đo được 200 trước, 404 sau restart).
T2-REQUEST-INFO: 1 mismatch owner (RESIDENT theo CR-03 vs BPTN theo OPERATIONS §5.2.3), phán PASS như Day03-ter, ghi câu hỏi mở.

## So với Day03 (TestClient)
Cùng bước/expected; đổi tầng gọi sang HTTP thật. Rating/additions/stock đọc qua GET ticket thay vì engine in-process. Kết quả nghiệp vụ trùng Day03-ter; khác biệt duy nhất là tồn kho trung gian. D-01 không đo.

## Bảng phân công
| gói | tầng yêu cầu | họ/model đã dùng |
| Day04 localhost | 🟠 | Sonnet (không phóng thêm agent) |

## Việc KHÔNG làm
Không dựng DB, không đo UI thao tác, không D-01, không sửa spec/expected, không commit/push/stash.

## Câu hỏi cần người
Trường chốt chữ owner NEED_INFO an toàn (BPTN hay cư dân) trong OPERATIONS §5.2.3; Châm Anh: có thêm GET tồn kho không.

## Root đo lại (2026-10-04)

Root chạy lại độc lập 3 nhóm qua uvicorn thật (bản sao harness/run_case.sh ở scratchpad, evidence/root/day04-rerun-*): g1r 31/31, t1close 13/13, neg403 34/34 khớp worker; sau chạy không còn LISTEN 8184. JSON 18 record hợp lệ (11 khoá, evidence tồn tại). Root chưa chạy lại độc lập DEMO-03 và nhóm safety còn lại. Lệch owner NEED_INFO an toàn (RESIDENT theo CR-03 §6.4 vs chữ cũ OPERATIONS) đã được sửa trong OPERATIONS §5.2.3 ở hồ sơ. Đây là localhost, KHÔNG phải online.

✅ DUYỆT (Day04 localhost: 16 PASS, 2 BLOCKED; không khẳng định online/persistence)
