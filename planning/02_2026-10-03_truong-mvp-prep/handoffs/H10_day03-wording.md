Bạn là worker của repo này. THI CÔNG D3-05 🟢, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → deliverables/parts/D3-01.md (manifest) → specs/SPEC-P06-DAY03.md §1–§5 (chính §2, §3 D3-05, §4) → specs/OPERATIONS.md.

## 1. Bối cảnh
Day03 Trường = rà wording + quyền cho 4 vai trò (cư dân, BPTN, phòng ban, BQL). Đây là rà soát văn bản trong repo (UI tĩnh src/web/, src/maintenance/messages.py, i18n/, views.py allow-list cư dân, SPEC/OPERATIONS). Runtime/online/UI render chưa nghiệm thu; wording KHÔNG được hứa chức năng chưa tích hợp (safety CR-03, delta D-01, rating-once, cấm reopen là TARGET).

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/parts/D3-05-wording.md, P/deliverables/parts/D3-05.json, P/evidence/d3-05/*, P/reports/R10_day03-wording.md.
- ĐƯỢC đọc code/UI/test; lệnh chỉ đọc (grep, cat). KHÔNG chạy server, KHÔNG mutation.
- CẤM: sửa src/ (kể cả chuỗi UI), tests/, seed/, schema, config, secrets; plan.md, brain4agent/, docs/; stash/commit/push.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
Bốn record (task_id="D3-05"), mỗi record một vai trò; steps = nơi đã rà (file:dòng); input_ref = màn hình/chuỗi nguồn:
1. WORD-01 actor_role RESIDENT: chỉ thấy nhãn/trường public; safety hiển thị "đang kiểm tra", không lộ risk nội bộ.
2. WORD-02 BPTN: wording thiếu thông tin/asset và Bậc 2 (SAFETY_REVIEW_REQUIRED: ba lựa chọn xác nhận an toàn / nâng khẩn cấp / yêu cầu bổ sung).
3. WORD-03 DEPARTMENT: nhận việc, checklist, vật tư, ảnh, báo hoàn thành.
4. WORD-04 BQL: duyệt / trả làm lại / đóng, xử lý khẩn cấp (đóng, hạ báo nhầm).
- Trong deliverables/parts/D3-05-wording.md: bảng theo 4 vai với cột Màn hình · Câu hiện tại (trích đúng nguyên văn + file:dòng) · Câu đề xuất · Role · Lý do. Câu đề xuất chỉ là đề xuất (không sửa UI); không hứa chức năng chưa tích hợp; câu cần đánh dấu "TARGET — chưa tích hợp" nếu mô tả safety/delta/rating-once.
- Ghi rõ riêng 2 phần: (a) UI/wording — đã rà bằng đọc mã; (b) quyền API — chưa đo ở gói này (nút ẩn ≠ chứng minh phân quyền; đo 403 nằm ở D3-02/03/04/06). Màn hình/chuỗi không tồn tại trong repo ⇒ record BLOCKED, owner Trí (UI) hoặc Trường (nội dung).
- result: PASS = văn bản hiện có đúng quyền + không hứa quá mức; FAIL = có câu sai/quá hứa (actual nêu câu, issue_owner: nội dung→Trường, UI→Trí, quyền engine/API→Như Ý/Châm Anh); BLOCKED theo trên. Không ghi NOT_RUN.
- evidence: lưu output máy grep/cat các nguồn chuỗi vào P/evidence/d3-05/*.txt (+ `*-exit.txt`); evidence_refs trỏ tới đó. Không ảnh chụp thật cư dân; không token/password.
- D3-05.json = {"records":[4 record]} đúng schema SPEC §2; hợp lệ (`python -c "import json;json.load(...)"` exit 0).
- Xong khi: đủ 4 vai trò, JSON + wording.md + evidence tồn tại, không wording hứa quá mức.

## 4. Luật
- Ghi branch + full SHA vào report. Không đổi oracle/expected. Chỉ trỏ SPEC. H10 ↔ R10 một cặp.

## 5. Tầng
D3-05: 🟢 (có mẫu chép theo). Gặp quyết định chưa có trong SPEC ⇒ "Câu hỏi mở", không tự quyết.

## 6. Mẫu report (P/reports/R10_day03-wording.md)
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/H10_day03-wording.md` · `Base: <40hex>` · `Head: <40hex> (working tree, không commit)`.
Sau đó: lệnh + exit (trỏ evidence), tổng/PASS/FAIL/BLOCKED 4 record, `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người.
Dòng cuối: ✅ / 🔁 / ⛔ (đề xuất; root phán quyết cuối).
