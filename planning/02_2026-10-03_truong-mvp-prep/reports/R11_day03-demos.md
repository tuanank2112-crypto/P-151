Worker · thi công (D3-06) · Sonnet · Bước 0 exit 1 (MODULE_NOT_FOUND, hub ../brain4agent.release thiếu, không sửa managed rules) · hiểu việc: phạm vi = chỉ ghi P/deliverables/parts/D3-06.json + D3-06-notes.md, P/evidence/d3-06/*, report này; xong khi = 4 nhóm demo tái hiện được hoặc BLOCKED nêu rõ, đủ hai nhánh happy path, safety nêu rõ, JSON hợp lệ exit 0, evidence_refs tồn tại; cấm = sửa src/tests/seed/schema/config/.env/plan/brain4agent/docs, DB/hosting chung, reset, deploy, upload ảnh, stash/commit/push, thay demo baseline rồi đánh PASS cho safety.
Handoff: ../handoffs/H11_day03-demos.md
Base: 0ea04adedd023654947e2e97e645043f0ba89159
Head: 0ea04adedd023654947e2e97e645043f0ba89159 (working tree, không commit)

Branch: feature/truong · Môi trường: local, in-process FastAPI TestClient (không bind cổng nên không có process để dừng), mỗi nhóm một interpreter Python mới. Ép env trước khi import app: MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false (bỏ DATABASE_URL); mỗi nhóm assert `GET /health` 200 `{"status":"ok","env":"development"}` + settings hiệu lực trước mutation (evidence/d3-06/git-head.txt, đầu mỗi `<nhóm>.txt`). Dữ liệu SIMULATED. Runtime/online chưa nghiệm thu.

## Lệnh + exit (evidence trong P/evidence/d3-06/)
| Lệnh | Exit | Evidence |
| --- | --- | --- |
| node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check | 1 (MODULE_NOT_FOUND) | init-brain-exit.txt, init-brain-stdout.txt |
| PYTHONPATH=. python .../d3-06/harness.py g1a (DEMO-01A vệ sinh) | 0 (26/26) | g1a.txt, g1a-exit.txt |
| harness.py g1b (DEMO-01B đèn) | 0 (26/26) | g1b.txt, g1b-exit.txt |
| harness.py g1r (DEMO-01-RATING) | 1 (28/31, 3 TARGET mismatch) | g1r.txt, g1r-exit.txt |
| harness.py g2 (NEED_INFO + ASSET_UNCLEAR, dương) | 0 (13/13) | g2.txt, g2-exit.txt |
| harness.py g2neg (âm 409/403, process riêng) | 0 (10/10) | g2neg.txt, g2neg-exit.txt |
| harness.py g3 (vật tư/nhập kho/resume) | 0 (21/21) | g3.txt, g3-exit.txt |
| harness.py g4a (OpenAPI/code scan + baseline Bậc 2) | 1 (9/10; mismatch = target không có) | g4a.txt, g4a-exit.txt |
| harness.py g4b (baseline Bậc 1) | 1 (0/2; mismatch = target không có) | g4b.txt, g4b-exit.txt |
| build + validate D3-06.json | 0 | json-validate.txt, json-validate-exit.txt |

Harness (`evidence/d3-06/harness.py`) là script tái hiện, không phải output máy; sửa một lần trong phiên vì lỗi code đối chiếu của chính nó (tên trường readiness, vị trí `additions`, tên action audit), không đổi expected; các nhóm sau đó chạy lại toàn bộ.

## Kết quả: 8 record · PASS 5 · FAIL 1 · BLOCKED 2 · NOT_RUN 0
| Record | Kết quả | Owner | Ghi chú đo |
| --- | --- | --- | --- |
| DEMO-01A-CLEANING | PASS | - | accept sai department bị từ chối (trạng thái giữ ROUTED), BPTN accept 403, close sớm 409, department/BPTN close 403, BQL CLOSED, assignee null |
| DEMO-01B-LIGHT | PASS | - | như 01A; asset SIM-ASSET-LIGHT-001 |
| DEMO-01-RATING | FAIL | Như Ý | lần 2 trả 200 (mong đợi 409), rating 5 -> 1, audit RATE_TICKET 1 -> 2; engine.rate ghi đè (src/maintenance/engine.py:548-553) |
| DEMO-02-NEED-INFO | PASS | - | resolve -> ROUTED, raw vẫn trắng, addition do BPTN, 409 không append dở, 403 sai role |
| DEMO-02-ASSET-UNCLEAR | PASS | - | onsite -> ROUTED/DEPT_TECHNICAL/ASSET_CHECK_ONSITE/ONSITE_BY_BPTN; thiếu note 409; bịa asset 409 |
| DEMO-03-STOCK | PASS | - | stock 0 -> 1 (vẫn ON_HOLD) -> 2 (ROUTED); audit lookup < stock < create_draft; 403/422/404 |
| DEMO-04-SAFETY-TIER2 | BLOCKED | Như Ý | OpenAPI: 0 path safety/emergency/hazard, 0 giá trị SAFETY_*/EMERGENCY_*; engine.py không tham chiếu safety; baseline ingest = VERIFYING/OUT_OF_SCOPE (không phải SAFETY_REVIEW_REQUIRED). Script ba lựa chọn Bậc 2 ghi trong steps/notes, KHÔNG chạy mutation |
| DEMO-04-SAFETY-TIER1 | BLOCKED | Như Ý | baseline = VERIFYING/OUT_OF_SCOPE owner BPTN, không thông báo audience BQL. Script EMERGENCY_CLOSE/DOWNGRADE (cổng MVP) và CREATE_FOLLOW_UP (sau MVP) ghi dự kiến, KHÔNG chạy |

Nhận xét ngoài phạm vi chấm: API docstring `receive_stock` nói chạy lại từ bước 7, code dùng bước 6 (drift tài liệu, không ảnh hưởng PASS).

## git diff --stat + SHA
`git diff --stat` (tracked) = rỗng; SHA = 0ea04adedd023654947e2e97e645043f0ba89159. Chỉ có file untracked mới trong P/deliverables/parts/ (D3-06.json, D3-06-notes.md), P/evidence/d3-06/, P/reports/R11_day03-demos.md; `git status` ngoài thư mục package không có thay đổi từ worker này.

## Bảng phân công
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| --- | --- | --- |
| D3-06 (harness 4 nhóm, đo, JSON, notes, report) | 🟠 | Sonnet (một mình, không phóng agent con) |

## Việc KHÔNG làm + lý do
- Không chạy mutation safety Bậc 2/Bậc 1, D01 delta/snapshot, deadline jobs target: chưa có route/body/field (OPERATIONS §5.1, SPEC §4 TARGET BLOCKED); chỉ baseline ingest gắn nhãn BASELINE.
- Không chạy reopen, upload ảnh thật, UI, online/persistence restart: ngoài phạm vi/gate ngày 04.
- Không sửa src/tests/seed/config; không sửa `engine.rate`; không commit/push/stash; không ghi nhận brain compliant (Bước 0 exit 1).

## Câu hỏi cần người
1. Như Ý: ai chốt route/body CR03 safety (SAFETY_CONFIRM_SAFE/ESCALATE/T06, EMERGENCY_CLOSE/DOWNGRADE) trong CONTRACTS để DEMO-04 chạy được? Hiện BLOCKED.
2. Như Ý: xác nhận hướng sửa rating-once (409 ở lần hai, không mutation audit) để chạy lại DEMO-01-RATING.
3. Hub `../brain4agent.release` thiếu trên máy này; cần người cung cấp trước khi Bước 0 đạt.

## Root đo lại (2026-10-03)

Root đo lại độc lập: chạy lại harness.py (bản sao ở scratchpad, env ép memory/mock/local) cho g1r/g4a/g4b → checks 31/28/3, 10/9/1, 2/0/2 khớp bản worker; rating cuối = 1 (ghi đè, audit RATE_TICKET tăng); OpenAPI không có route safety. Output: evidence/root/day03-rerun-*.txt. JSON 8 record hợp lệ. DEMO-04 chưa chạy mutation (đúng: TARGET BLOCKED).

✅ DUYỆT (D3-06: 5 PASS, 1 FAIL rating-once owner Như Ý, 2 BLOCKED safety owner Như Ý; kịch bản tái hiện được nhưng safety demo chưa chạy được)
