# R02 — Thẩm định cô lập vòng cuối (hồ sơ 23 + 24)
Handoff: giao trực tiếp trong phiên (không có file H riêng)
Base: fc434d6
Head: working tree (chưa commit, sau bản sửa R01 + SPEC-P04)

Vai · thẩm định · Claude/Opus 5.5 · Bước 0 exit=0 (BRN-028 today.md) · chỉ đọc + đo lại.

## Số đo của thẩm định viên
- pytest toàn bộ: 3681 passed, 102 deselected, EXIT=0; p23+p24: 50 passed.
- portal typecheck EXIT=0, vitest 159 passed; `node --check` mobile: không lỗi; ruff file đã sửa: EXIT=0.
- Không tìm thấy khớp từ khoá/regex mới trong diff `src/` (bất biến Q30) — XANH.
- `read_emergency`: BQL hạ mức/đóng giữa lúc đọc, mô hình nói NONE, mô hình lỗi — đều XANH (không hạ mức, không ghi khi BQL đã xử lý).
- Fuzz 150 seed × 25 thao tác: 0 lệch `duplicate_count`; 7/150 seed sinh chuỗi con trỏ (F-A).

## Findings
- 🟠 F-A `merge.py` chọn gốc = ca cũ nhất kể cả khi nó đang là ca nghi trùng ⇒ chuỗi, BQL gộp bị chặn "gộp dây chuyền".
- 🟢 F-B `read_emergency` bỏ bản đọc trong `_mutate` vẫn trả Case + ghi lại ticket không đổi.
- 🟢 F-C `_activate` để record trên `_active_map` của luồng.
- 🟢 F-D chỉ `_ingest` kích hoạt đọc (đường chạy lại không đọc) — chiều an toàn.
- 🟢 F-E hồ sơ 24: báo thiếu mã còn hàng vẫn dừng nếu một dòng cũ đang thiếu.

Phán quyết: hồ sơ 23 🔁 SỬA: F-A (+F-B); hồ sơ 24 ✅ DUYỆT (F-E chờ chốt).

## Xử lý của orchestrator
- F-A: gốc = ca cũ nhất KHÔNG có con trỏ; test `test_r02_merge_into_a_newer_ticket_never_makes_a_chain`; phép phá m12 đỏ.
- F-B/F-C: `_ReadDropped` hủy giao dịch, trả None; dùng `_activated`. Test `test_r02_a_dropped_reading_writes_nothing`.
- F-D: ghi SPEC-P04 + Idea Vault (job đọc bù).
- F-E: agent chốt (kỹ thuật, AGENTS L.2): chỉ xét các mã được báo; test `test_r03b_…`; phép phá m13 đỏ.
- Phép phá toàn bộ: 13/13 đỏ (`evidence/mutation.txt`).
