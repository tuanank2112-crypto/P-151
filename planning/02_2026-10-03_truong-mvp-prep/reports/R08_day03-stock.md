Worker · thi công (D3-03, một gói, không phóng agent) · Claude Sonnet · Bước 0 exit 1 (MODULE_NOT_FOUND, hub `../brain4agent.release` thiếu, không sửa managed rules) · hiểu việc: phạm vi chỉ ghi D3-03.json + evidence/d3-03/* + R08, cấm sửa src/tests/seed/schema/config/.env/plan/brain/docs, không catalog/DB trực tiếp, không commit; xong khi đủ 4 record STOCK-01..04 kèm before/after nhập kho + điều kiện nhận việc, JSON hợp lệ exit 0, mọi evidence_refs tồn tại; cấm giả lập PASS, cấm retry nhập kho mù.
Handoff: ../handoffs/H08_day03-stock.md
Base: 0ea04adedd023654947e2e97e645043f0ba89159
Head: 0ea04adedd023654947e2e97e645043f0ba89159 (working tree, không commit)

## Môi trường (đo 2026-10-03T11:04:26+07:00 → 11:07:07+07:00, đồng hồ máy)
- Branch `feature/truong`, local, TestClient trong process (không mở cổng, không process nền để dừng). Mỗi ca = process Python mới (memory store mới, seed mới).
- Ép env trong lệnh và `os.environ` trước import app: MO_STORE=memory, LLM_MODE=mock, MO_PHOTO_STORE=local, APP_ENV=development, MO_ALLOW_RESET=false, thêm MO_JOBS_ENABLED=false (chặn job nền để không đổi state giữa phép đo; không đổi contract). `/health` = `{"status":"ok","env":"development"}` và settings hiệu lực khớp, assert trước mutation (đầu mỗi `s0x.txt`).
- Stock đọc bằng `get_engine().repo.stock_of()` (chỉ đọc) vì không có endpoint GET stock; thêm `material_lines[].simulated_stock_qty` trong GET ticket.
- Password/token không lưu (evidence ghi `<redacted>`).

## Lệnh + exit (output máy trong evidence)
| Lệnh (từ root, env ép như trên) | Exit | Evidence |
| --- | --- | --- |
| `node ../brain4agent.release/.../init_brain.js --check` | 1 | evidence/d3-03/init-brain-exit.txt |
| `python planning/02_2026-10-03_truong-mvp-prep/evidence/d3-03/harness.py s01` | 0 (7/7 check) | evidence/d3-03/s01.txt, s01-exit.txt |
| `... harness.py s02` | 0 (11/11) | evidence/d3-03/s02.txt, s02-exit.txt |
| `... harness.py s03` | 0 (17/17) | evidence/d3-03/s03.txt, s03-exit.txt |
| `... harness.py s04` | 0 (7/7) | evidence/d3-03/s04.txt, s04-exit.txt |
| validate D3-03.json (4 record, evidence_refs tồn tại) | 0 | evidence/d3-03/json-validate.txt |

Lưu ý: harness chạy lần đầu có 3 MISMATCH do lỗi harness (đọc `owner` thay vì `owner_role`); đã sửa harness (không sửa oracle), chạy lại toàn bộ 4 ca, evidence là lần chạy lại.

## Kết quả: tổng 4 · PASS 4 · FAIL 0 · BLOCKED 0 · NOT_RUN 0 (deliverables/parts/D3-03.json)
- STOCK-01 PASS: SIM-TKT-TEC-001 (chọn vì LAMP-01 stock 5 ≥ planned 1, đúng fixture B runbook). ROUTED, dept TECHNICAL, draft có, assignee null, flags [], stock 5→5.
- STOCK-02 PASS: SIM-TKT-TEC-003. ON_HOLD/WAITING_MATERIAL, owner_role WAREHOUSE, resume_step 6, dept/draft null; dept accept bị từ chối 4xx; resume x2 khi stock=0 vẫn ON_HOLD, stock 0→0.
- STOCK-03 PASS: before/after nhập kho `SIM-MAT-LAMP-02`: lần 1 **0→1** (ON_HOLD, audit không đổi, chưa giao); lần 2 **1→2** (tự chạy lại LOOKUP_ASSET→CHECK_MATERIAL_STOCK→CREATE_DRAFT, ROUTED, DEPT_TECHNICAL); resume thêm: ROUTED giữ nguyên, events 4→4 (không giao trùng). Âm: sai role 403, qty=0 422, item lạ 404, stock không đổi sau âm tính.
- STOCK-04 PASS (phạm vi "đi tiếp + cờ"): SIM-TKT-TEC-006, SIM-MAT-STARTER-01 stock null=UNKNOWN (fixture có sẵn, không sửa catalog). ROUTED, dept TECHNICAL, draft có, flags ["STOCK_CHECK_ON_ACCEPT"]. Điều kiện nhận việc = phòng ban tự kiểm tồn khi nhận.
- Mã nguồn xử lý STOCK_CHECK_ON_ACCEPT: CHỈ đặt cờ (`src/maintenance/engine.py:1916-1919`, enum `src/maintenance/enums.py:76`). KHÔNG có logic kiểm/chặn lúc accept (`engine.py:709-711` accept là transition ROUTED→IN_PROGRESS thường; đo: accept 200, cờ vẫn còn sau accept); grep `src/` không có chỗ dùng khác (kể cả UI). Việc "kiểm khi nhận" hiện chỉ là chỉ dẫn con người; runtime/online chưa nghiệm thu.
- Ghi nhận OPERATIONS §4.4: docstring `src/api/routers/maintenance.py:550` nói "bước 7", code dùng bước 6 (`engine.py:1587`, `1922`; audit thực: lookup trước stock). Actual ghi đúng bước 6, expected không đổi; đề xuất Châm Anh sửa docstring (không FAIL vì hành vi đúng SPEC §4.4).

## git diff --stat + SHA
`git diff --stat` = rỗng (0 file tracked đổi); toàn bộ thay đổi của gói này là file mới untracked trong P/deliverables/parts/D3-03.json, P/evidence/d3-03/*, P/reports/R08_day03-stock.md. SHA = 0ea04adedd023654947e2e97e645043f0ba89159. Không đụng src/, tests/, seed/, config, .env, plan, brain4agent, docs.

## Bảng phân công thực tế
| Gói | Tầng yêu cầu | Họ/model đã dùng |
| --- | --- | --- |
| D3-03 (đo 4 ca + JSON + report) | 🟠 | Claude Sonnet (worker tự làm, không agent con) |

## Việc KHÔNG làm + lý do
- Không chạy uvicorn/cổng riêng: dùng TestClient trong process (handoff cho phép), nên không có process để dừng.
- Không sửa docstring API / không thêm logic STOCK_CHECK_ON_ACCEPT: ngoài phạm vi (cấm sửa src/).
- Không đo online/persistence/UI: ngoài phạm vi D3-03, vẫn là gate ngày 04.
- Không tạo ca UNKNOWN mới: dùng fixture seed TEC-006 nên không cần sửa catalog.

## Câu hỏi cần người
1. Root/🔴: coi "chỉ đặt cờ, không có xử lý lúc accept" đã đủ cho D-05 hay cần yêu cầu Như Ý thêm hiển thị/chặn mềm ở accept? (tôi không đổi contract.)
2. Châm Anh: sửa docstring "bước 7" → "bước 6" ở `src/api/routers/maintenance.py:550`?
3. Schema `actor_role` không có QA_INTERNAL nên STOCK-02 ghi WAREHOUSE (chủ blocker); resume do qa01 gọi. Root xác nhận cách ghi.

## Root đo lại (2026-10-03)

Root đo lại: JSON D3-03 hợp lệ, evidence tồn tại, engine.py:1916-1919 khớp (cờ STOCK_CHECK_ON_ACCEPT chỉ đặt, accept không xử lý — engine.py:709-711). STOCK-04 PASS theo chữ D-05 'đi tiếp với cờ'; việc cờ có đủ làm điều kiện nhận việc hay không chuyển người quyết. DEMO-03 của worker D3-06 báo nhập kho 0→1→2 cũng PASS (root chưa chạy lại nhóm đó).

✅ DUYỆT (D3-03: 4 PASS; điều kiện nhận việc STOCK-04 còn câu hỏi mở cho người)
