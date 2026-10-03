Bạn là worker của repo này. THI CÔNG D3-03 🟠, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → deliverables/parts/D3-01.md (manifest) → specs/SPEC-P06-DAY03.md §1–§5 (chính §2, §3 D3-03, §4) → specs/OPERATIONS.md §1, §4.

## 1. Bối cảnh
Day03 Trường = kiểm thử nghiệp vụ, không coding. Kiểm 4 ca vật tư/tồn kho trên bản local cô lập. D-05 (stock UNKNOWN đi tiếp với STOCK_CHECK_ON_ACCEPT) đã APPROVED theo plan.md; runtime/online chưa nghiệm thu. Chức năng chưa tích hợp KHÔNG được giả lập thành PASS.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/parts/D3-03.json, P/evidence/d3-03/*, P/reports/R08_day03-stock.md.
- ĐƯỢC đọc mọi thứ. Chạy server riêng: `uvicorn src.main:app --host 127.0.0.1 --port 8163` HOẶC TestClient trong process; ép env MO_STORE=memory, LLM_MODE=mock, MO_PHOTO_STORE=local, APP_ENV=development, MO_ALLOW_RESET=false NGAY TRONG lệnh (không tin .env). Xác nhận cấu hình qua /health trước mutation; không xác nhận được ⇒ dừng, ghi BLOCKED.
- CẤM: sửa src/, tests/, seed/ (catalog/stock), schema, config, .env, secrets; plan.md, brain4agent/, docs/; DB/hosting chung, reset, deploy; dùng chung state/cổng với worker khác; thay catalog/DB trực tiếp để ép đạt; stash/commit/push. Kết thúc: dừng đúng process của mình.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
Bốn record, mỗi ca process memory MỚI hoặc ticket/item độc lập; actor đúng role (kho01 nhập kho, QA/BPTN đọc):
1. STOCK-01: ticket đủ vật tư (chọn fixture có stock đủ; ghi chọn cái nào + vì sao) → đi tiếp tới ROUTED.
2. STOCK-02: SIM-TKT-TEC-003 (SIM-MAT-LAMP-02 qty cần 2, stock 0) → ON_HOLD/WAITING_MATERIAL, owner WAREHOUSE, department/draft null, chưa giao; resume khi stock=0 vẫn ON_HOLD (OPERATIONS §4.1–4.2).
3. STOCK-03: kho nhập `{"qty":1}` rồi `{"qty":1}` (OPERATIONS §4.3–4.5): GHI before/after số lượng MỖI lần (đọc stock trước/sau), lần 1 chưa giao, lần 2 tự chạy lại từ asset (audit lookup→stock→route) → ROUTED, chỉ giao khi đủ; resume lần nữa không giao trùng; âm: sai role 403, qty=0 422, item lạ 404.
4. STOCK-04: stock UNKNOWN → đi tiếp, ghi điều kiện nhận việc STOCK_CHECK_ON_ACCEPT (D-05). Nếu không tạo được ca UNKNOWN mà không sửa catalog/DB ⇒ BLOCKED (block_reason cụ thể, owner theo căn nguyên: logic engine→Như Ý, dữ liệu fixture→Trường). Ghi rõ mã nguồn có hay không xử lý STOCK_CHECK_ON_ACCEPT (file:dòng).
- Ghi chú đã biết (OPERATIONS §4.4): docstring API nói bước 7, code dùng bước 6 — ghi nhận actual thực, không đổi expected.
- Lưu nguyên output máy mỗi bước (request đã che auth, status/body, timestamp, actor; GET ticket/events/audit) vào P/evidence/d3-03/*.txt; `*-exit.txt` cho lệnh CLI. Không ghi tay, không lưu token/password.
- D3-03.json = {"records":[...4 record...]} đúng schema SPEC §2 (task_id="D3-03"); FAIL ⇒ issue_owner (engine→Như Ý, API/storage→Châm Anh, UI→Trí, dữ liệu/oracle→Trường); BLOCKED ⇒ block_reason + owner; PASS/FAIL cần actual + evidence_refs tồn tại.
- Xong khi: 4 record + before/after nhập kho + điều kiện nhận việc; JSON hợp lệ (exit 0); mọi evidence_refs tồn tại.

## 4. Luật
- Ghi branch + full SHA + môi trường trước lượt đo, chép vào report. Lỗi theo SPEC §4 (401/403 giữ nguyên vai; 409/422 sửa đầu vào hợp lệ; 5xx dừng mutation). Mất response khi nhập kho ⇒ đọc stock trước khi retry, cấm retry mù.
- Chỉ trỏ SPEC. H08 ↔ R08 một cặp.

## 5. Tầng
D3-03: 🟠. Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở" (🔴 do root).

## 6. Mẫu report (P/reports/R08_day03-stock.md)
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/H08_day03-stock.md` · `Base: <40hex>` · `Head: <40hex> (working tree, không commit)`.
Sau đó: lệnh + exit (trỏ evidence), tổng/PASS/FAIL/BLOCKED của 4 record, `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người.
Dòng cuối: ✅ / 🔁 / ⛔ (đề xuất; root phán quyết cuối).
