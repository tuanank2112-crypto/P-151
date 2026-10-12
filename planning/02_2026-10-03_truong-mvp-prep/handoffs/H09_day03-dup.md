Bạn là worker của repo này. THI CÔNG D3-04 🟠, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → deliverables/parts/D3-01.md (manifest) → specs/SPEC-P06-DAY03.md §1–§5 (chính §2, §3 D3-04, §4) → specs/OPERATIONS.md §1, §3.1.2.

## 1. Bối cảnh
Day03 Trường = kiểm thử nghiệp vụ, không coding. Kiểm 4 ca trùng cơ bản (cửa sổ 48 giờ, cùng loại + vị trí) trên bản local cô lập, dùng thời điểm mô phỏng cố định (`simulated_received_at`), KHÔNG chờ 48 giờ thực. Phân loại luôn trước trùng (D-09). Runtime/online chưa nghiệm thu; chức năng thiếu KHÔNG giả lập PASS.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/parts/D3-04.json, P/evidence/d3-04/*, P/reports/R09_day03-dup.md.
- ĐƯỢC đọc mọi thứ. Chạy server riêng: `uvicorn src.main:app --host 127.0.0.1 --port 8164` HOẶC TestClient trong process; ép env MO_STORE=memory, LLM_MODE=mock, MO_PHOTO_STORE=local, APP_ENV=development, MO_ALLOW_RESET=false NGAY TRONG lệnh (không tin .env). Xác nhận cấu hình qua /health trước mutation; không xác nhận được ⇒ dừng, ghi BLOCKED.
- CẤM: sửa src/, tests/, seed/, schema, config, .env, secrets; plan.md, brain4agent/, docs/; DB/hosting chung, reset, deploy; dùng chung state/cổng với worker khác; stash/commit/push. Kết thúc: dừng đúng process của mình.
- CẤM kiểm ngưỡng duplicate priority (D-03, sau MVP); CẤM dùng ca có hazard để lách gate safety.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
Bốn record; mỗi ca process memory MỚI (tránh trùng chéo ca), nội dung mô phỏng không có tín hiệu nguy hiểm:
1. DUP-01 (cư dân gửi 2 phản ánh): cùng loại + vị trí, trong 48 giờ → ticket sau dừng chờ BPTN (blocker trùng), chưa giao.
2. DUP-02 (BPTN): xác nhận trùng (merge) → ticket con MERGED, giữ liên kết cha/audit; ghi event/audit chứng minh quyết định BPTN.
3. DUP-03 (BPTN): bác trùng `{"merge":false,"note":"..."}` → tiếp tục đúng bước tiếp theo (ghi trạng thái thật).
4. DUP-04: khác loại/vị trí HOẶC ngoài cửa sổ 48 giờ → KHÔNG báo trùng, không gộp. Làm cả hai biến thể (khác vị trí; cách >48h) và ghi cả hai trong steps/actual.
- Đọc engine để biết tên blocker/endpoint thật (duplicate step, bptn decision route) và chép file:dòng vào steps; endpoint thiếu ⇒ BLOCKED (owner theo căn nguyên: engine→Như Ý, API→Châm Anh), KHÔNG bịa URL.
- Lưu nguyên output máy mỗi bước (request đã che auth, status/body, timestamp, actor; GET ticket/events/audit của cả hai ticket) vào P/evidence/d3-04/*.txt; `*-exit.txt` cho lệnh CLI. Không ghi tay, không lưu token/password.
- D3-04.json = {"records":[...4 record...]} đúng schema SPEC §2 (task_id="D3-04"); FAIL ⇒ issue_owner (engine→Như Ý, API/storage→Châm Anh, UI→Trí, dữ liệu/oracle→Trường); BLOCKED ⇒ block_reason + owner; PASS/FAIL cần actual + evidence_refs tồn tại.
- Xong khi: 4 record, bằng chứng quyết định BPTN + liên kết; JSON hợp lệ (exit 0); mọi evidence_refs tồn tại.

## 4. Luật
- Ghi branch + full SHA + môi trường trước lượt đo, chép vào report. Lỗi theo SPEC §4. Không đổi expected để code sai đạt.
- Chỉ trỏ SPEC. H09 ↔ R09 một cặp.

## 5. Tầng
D3-04: 🟠. Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở" (🔴 do root).

## 6. Mẫu report (P/reports/R09_day03-dup.md)
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/H09_day03-dup.md` · `Base: <40hex>` · `Head: <40hex> (working tree, không commit)`.
Sau đó: lệnh + exit (trỏ evidence), tổng/PASS/FAIL/BLOCKED của 4 record, `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người.
Dòng cuối: ✅ / 🔁 / ⛔ (đề xuất; root phán quyết cuối).
