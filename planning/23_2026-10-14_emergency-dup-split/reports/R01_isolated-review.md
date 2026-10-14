# R01 — Thẩm định cô lập hồ sơ 23
Handoff: (giao trực tiếp trong phiên, nội dung = mục "Việc phải làm" dưới; không có file H01 riêng)
Base: fc434d6
Head: working tree (chưa commit, trước các bản sửa F2–F12)

Vai · thẩm định · Claude/Opus 5.5 · Bước 0 exit=0 (cảnh báo BRN-028 today.md 691 dòng) · chỉ đọc + đo lại.

## Số đo của thẩm định viên
- `pytest tests -q -p no:cacheprovider --ignore=integration` → 3653 passed, 102 deselected, exit 0.
- ruff toàn repo đỏ do nợ cũ (có sẵn ở fc434d6); file hồ sơ 23: check 0, format 0.
- 5 phép phá TESTING §2 đều đỏ; thêm m6/m8/m11/m13/m14 đỏ; SỐNG: m7 (recount), m9 (T07), m10 (loại người ghim), m12 (chuỗi gốc).
- Route merge: 403 cho mọi vai không phải BQL, 401 không header, 422 thiếu `into`/trường lạ, 409 thiếu note, 404 `into` lạ, 409 gộp vào chính nó / gốc không khẩn cấp / ticket thường, 200 hợp lệ.

## Findings
- 🔴 F1 `neighbors.py` `_emergency_kinds` bước luật (SPEC-P03 §2.3, quyết định E02): đoán loại bằng `category_evidence` = khớp từ khoá, trái bất biến kernel; có chiều không an toàn ("nước tràn vào tủ điện, có tia lửa" ⇒ {VE_SINH} ⇒ đèn được giao Kỹ thuật vào chỗ khẩn cấp điện); "Hộp đèn … tóe lửa" ⇒ không biết ⇒ giữ cả ticket rác (trùng L3 FAIL live). Lỗi SPEC ⇒ người dùng duyệt lại E02.
- 🟠 F2 `merge.py` nhánh "gốc của chuỗi": gốc hạ mức ⇒ ca mới trỏ ticket thường (đếm + PRI-U1 sai); gốc đóng/hủy ⇒ ca mới không được đánh dấu.
- 🟠 F3 follow-up hai việc bị tách, con thiếu `follow_up_of` ⇒ chờ chính ca nguồn.
- 🟠 F4 loại của ca gốc không gồm ca đã gộp vào ⇒ thả nhầm ticket đang giữ.
- 🟠 F5 thiếu test: m7, m9, m10, m12; S-02 không có test.
- 🟢 F6 đường dẫn SPEC `/mo/bql/...` sai (thật là `/api/v1/bql/...`). F7 gộp gốc vào ca nghi trùng của nó ⇒ con trỏ vòng. F8 ghi chú blocker giữ mã ca cũ. F9 nhãn portal "liền kề". F10 ca Bậc 2 tạo trước nâng sau ⇒ không nghi trùng (khe hở). F11 nhánh mirror S-03 mất kiểm trạng thái. F12 `into` không cắt khoảng trắng.

Phán quyết: 🔁 SỬA: F2, F3, F4, F5; F1 trả người dùng duyệt lại E02.

## Xử lý của orchestrator (2026-10-14)
- F2/F7: chọn gốc = ca khẩn cấp mở cũ nhất, không theo con trỏ; `_repoint_suspects` khi gốc hạ mức/đóng/hủy/gộp (SPEC-P01 §3).
- F3: con của tách chép `follow_up_of`. F4: `_merged_kinds`. F8: ghi chú đổi theo ca đang giữ. F9: "cùng vị trí". F11: thêm kiểm. F12: `into` có `pattern \S` + `strip()`. F6: sửa SPEC.
- F5: thêm test T07, loại ghim, chuỗi gốc (hạ mức/đóng/hủy), gộp gốc vào ca nghi trùng, loại khi gộp, follow-up tách, S-02 Agent. m7 KHÔNG tới được sau `_repoint_suspects` (ghi SPEC-P01 §3). F10: chấp nhận, ghi SPEC.
- F1: CHỜ người dùng (plan.md "Câu hỏi chờ").
