1. Bạn là worker của repo này. Đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại THẨM ĐỊNH (chỉ đọc + chạy lệnh), tầng 🔴; nhiệm vụ là LÀM ĐỎ WP19, không sửa file nào ngoài report/evidence của mình.
2. Bước 0: từ root `D:/P151` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; ghi exit.
3. Đọc: `brain4agent/memory-distill.txt` dòng 21 → `brain4agent/-known-gotchas.md` mục "⚠ Kiểm trích dẫn bằng chuỗi con" → `planning/06_2026-10-05_reasoning-agent/specs/SPEC-P10-catalog-not-quote.md` TOÀN BỘ → `plan.md` Q01/Q02/Q30/Q33/Q35. KHÔNG đọc `reports/R18_*` hay handoff H18 trước khi tự kết luận (không thừa kế ngữ cảnh worker).

## 1. Bối cảnh
- Bất biến người dùng: ngữ nghĩa do LLM; code CHỈ kiểm danh mục/ứng viên/enum; quote chỉ audit (Q35). AI không tự hạ mức an toàn (Q02/Q33).
- WP19 sửa working tree CHƯA commit trên `feature/nhuy-reasoning-agent` (Base = HEAD hiện tại). Xem bằng `git diff -- src tests` + file mới `tests/test_maintenance/test_p10_catalog_not_quote.py`.

## 2. Phạm vi
- ĐƯỢC GHI: `planning/06_2026-10-05_reasoning-agent/reports/R19_tham-dinh_WP19.md`, `evidence/WP19-review/*.txt`. Script thử đặt trong scratchpad của bạn hoặc `evidence/WP19-review/`.
- CẤM sửa `src/`, `tests/`, SPEC, plan, não; commit/stage/push/stash; gọi mạng/LLM; đọc `.env`. Đột biến tạm phải khôi phục và chứng minh bằng sha256 trước/sau.

## 3. Việc phải làm + xong khi
- Chạy lại: `python -m pytest -q -p no:cacheprovider` (env `LLM_MODE=mock MO_STORE=memory MO_PHOTO_STORE=local PYTHONUTF8=1 PYTHONPATH=.`, `.venv` 3.11), `ruff check src tests`, REF selftest (OPERATIONS §1). Ghi tổng/pass/fail/skip + exit.
- Đối chiếu diff với P10 §3 từng dòng và hàng "CẤM chạm" (file ngoài phạm vi ⇒ 🔁).
- Tự thiết kế ≥3 cách phá, mỗi cách một probe có output máy, ví dụ: (a) còn chỗ nào dưới `src/` so quote/câu cư dân để loại/hạ/giữ đầu ra LLM (tên khác `grounded`, `in`, `find`, fuzzy…); (b) Agent nâng an toàn (PRESENT Bậc 1) với quote lệch chữ/rỗng có còn ra EMERGENCY_PENDING_BQL qua engine thật (không chỉ hàm đơn); (c) có đường nào AI giờ HẠ được mức hoặc xoá tín hiệu luật; (d) Mirror/test helper còn bịa quote; (e) vị trí diễn đạt khác + có trong danh mục được nhận end-to-end; ngoài danh mục bị loại đúng trường; (f) test mới có thật sự đỏ khi khôi phục cổng quote (đột biến của riêng bạn, không lấy m1–m7).
- Xét 2 chỗ worker tự đổi khẳng định test so với P10 §9.1: thay test `test_f3_punctuation_quote…` (khẳng định "không có rejected bắt đầu bằng location" thay `rejected == []`) và `test_engine_with_safety_llm_never_lowers` (bỏ khẳng định `notes`). Có làm yếu test không — chứng minh bằng đột biến.

## 4. Luật
- Đo, không tin. Kết luận phải có lệnh + exit. Hai phép đo mâu thuẫn ⇒ ghi cả hai.

## 5. Tầng
- 🔴, tự làm, không agent con.

## 6. Report
- Dòng 1: `Vai · thẩm định · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4: `Handoff: handoffs/H19_tham-dinh_WP19.md`, `Base: <SHA>`, `Head: <SHA; working tree chưa commit>`.
- Bảng probe (cách phá → lệnh → exit → kết quả), số test, mục §3 đạt/lệch. Dòng cuối đúng một: `✅ DUYỆT` · `🔁 SỬA: <mục>` · `⛔ DỪNG: <vì sao>`.
Report: `planning/06_2026-10-05_reasoning-agent/reports/R19_tham-dinh_WP19.md` · Evidence: `planning/06_2026-10-05_reasoning-agent/evidence/WP19-review/`
