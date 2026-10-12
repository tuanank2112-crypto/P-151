Bạn là worker của repo này. THI CÔNG D3-06 🟠, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → deliverables/parts/D3-01.md, D3-02/03/04.json (kết quả phụ thuộc) → specs/SPEC-P06-DAY03.md §1–§5 (chính §2, §3 D3-06, §4) → specs/OPERATIONS.md §1–§7.

## 1. Bối cảnh
Day03 Trường = chạy thử 4 nhóm script demo trên bản local cô lập. Nhóm 1 happy path có HAI nhánh độc lập (vệ sinh A, đèn B) và BQL đóng. Nhóm 4 safety là TARGET BLOCKED — chưa tích hợp: nếu D3-01 xác nhận chưa có thì BLOCKED owner Như Ý, CẤM thay bằng demo baseline rồi đánh PASS. Runtime/online chưa nghiệm thu.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/parts/D3-06.json, P/deliverables/parts/D3-06-notes.md, P/evidence/d3-06/*, P/reports/R11_day03-demos.md.
- ĐƯỢC đọc mọi thứ. Chạy server riêng: `uvicorn src.main:app --host 127.0.0.1 --port 8166` (MỖI nhóm một process memory mới) HOẶC TestClient; ép env MO_STORE=memory, LLM_MODE=mock, MO_PHOTO_STORE=local, APP_ENV=development, MO_ALLOW_RESET=false NGAY TRONG lệnh (không tin .env). Xác nhận /health trước mutation; không xác nhận được ⇒ BLOCKED.
- CẤM: sửa src/, tests/, seed/, schema, config, .env, secrets; plan.md, brain4agent/, docs/; DB/hosting chung, reset, deploy, upload ảnh vào đường dẫn dùng chung (chỉ evidence JSON mô phỏng); dùng chung state/cổng với worker khác; stash/commit/push. Kết thúc: dừng đúng process của mình.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
Chạy đúng các bước OPERATIONS; record (task_id="D3-06"), case_id cố định:
1. DEMO-01A (§2, vệ sinh SIM-TKT-CLN-001) và DEMO-01B (§2, đèn SIM-TKT-TEC-001): bước 1–7 tới BQL CLOSED; kiểm accept sai department bị từ chối, department không tự close. Đủ hai nhánh độc lập.
2. DEMO-01-RATING (§2 bước 8): rating lần 1 thành công; lần 2 mong đợi 409 và rating giữ 5. Actual hiện hành (ghi đè) ⇒ FAIL, owner Như Ý — đo trên process cô lập, KHÔNG gọi là PASS vì "đã chạy".
3. DEMO-02 (§3): NEED_INFO (SIM-TKT-CLN-003) + ASSET_UNCLEAR (SIM-TKT-TEC-002), kèm âm 409/403. Có thể tham chiếu kết quả D3-02 cho nhánh asset nhưng PHẢI chạy lại trong script này.
4. DEMO-03 (§4): vật tư thiếu → kho nhập → resume; ghi stock before/after.
5. DEMO-04 (§5): kiểm xem route/field/action safety có thật (đọc code + OpenAPI). Chưa có ⇒ BLOCKED + block_reason + owner Như Ý, steps ghi script dự kiến (Bậc 2 ba lựa chọn, Bậc 1 BQL) nhưng KHÔNG chạy mutation giả. Chỉ chạy phần CURRENT thật sự tồn tại và gắn nhãn baseline, không ghi PASS cho target.
- Mỗi nhóm ghi actor, input, thao tác, expected, actual, evidence, prerequisite (cột prerequisite trong D3-06-notes.md, kèm trạng thái chạy thử riêng từng nhóm).
- Lưu nguyên output máy mỗi bước E(G,S) (request che auth, status/body, timestamp, actor; GET ticket/events/audit/notifications; GET /resident/tickets/T) vào P/evidence/d3-06/*.txt; `*-exit.txt` cho lệnh CLI. Không ghi tay, không lưu token/password.
- D3-06.json = {"records":[...]} đúng schema SPEC §2 (5 nhóm → ≥6 record theo trên); FAIL ⇒ issue_owner (engine→Như Ý, API/storage→Châm Anh, UI→Trí, oracle/script→Trường); BLOCKED ⇒ block_reason + owner.
- Xong khi: 4 script tái hiện được (hoặc BLOCKED nêu rõ), đủ hai nhánh happy path, lựa chọn safety bắt buộc nêu rõ; JSON hợp lệ (exit 0); evidence_refs tồn tại.

## 4. Luật
- Ghi branch + full SHA + môi trường trước lượt đo, chép vào report. Lỗi theo SPEC §4 (409/422 sửa đầu vào hợp lệ, không bypass guard; mất response nhập kho ⇒ đọc state trước retry). Không đổi expected để đạt.
- Chỉ trỏ SPEC. H11 ↔ R11 một cặp.

## 5. Tầng
D3-06: 🟠. Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở" (🔴 do root).

## 6. Mẫu report (P/reports/R11_day03-demos.md)
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/H11_day03-demos.md` · `Base: <40hex>` · `Head: <40hex> (working tree, không commit)`.
Sau đó: lệnh + exit (trỏ evidence), tổng/PASS/FAIL/BLOCKED các record, `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người.
Dòng cuối: ✅ / 🔁 / ⛔ (đề xuất; root phán quyết cuối).
