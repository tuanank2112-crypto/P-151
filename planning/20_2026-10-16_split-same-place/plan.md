# 20 — Một vị trí hai việc luôn tách cho Vệ sinh và Kỹ thuật

## Metadata

| Trường | Giá trị |
|---|---|
| Trạng thái | ✅ ĐÃ HOÀN THÀNH local (2026-10-16 16:07:31 +07:00); server ⬜ không áp dụng (chỉ đổi luật trong `src/`) |
| Ngày tạo | 2026-10-16, Asia/Saigon |
| Loại / phiên bản đích | PATCH `1.13.0 → 1.13.1` (≤1 ngày công, một hàm luật + test; ngoại lệ AGENTS.md §3 mục 2.5: chỉ có `plan.md`) |
| Nhánh / base | `feature/chamanh`, HEAD `eb7c005` |
| Yêu cầu | Người dùng, 2026-10-16: "ticket có một vị trí nhưng có hai vấn đề thì phải chia để chuyển cho hai phòng ban là kỹ thuật và vệ sinh" |
| Điều kiện đóng | pytest 0 fail, ruff sạch, probe hai chế độ `mirror`/`rules` tách đúng |

## Nhật ký quyết định

| ID | Thời điểm +07:00 | Quyết định / lý do |
|---|---|---|
| D01 | 2026-10-16 | Đo hiện trạng: cơ chế tách đã có (`coordination/split.py`, `rules.split_verdict`, cờ `auto_split_mixed_reports` bật). Ca một vị trí hai việc vẫn dừng `CATEGORY_UNCLEAR` khi câu có từ nhân quả / do dự / dấu `?` (R-S3, R-S4 của SPEC-P05 plan 06) |
| D02 | 2026-10-16 | BỎ hai chốt R-S3 (`CAUSAL_*`, `HEDGE_*`) và R-S4 (`?`) khỏi `split_verdict`. Lý do: "…vì sắp có khách", "…do xe đẩy", "…ai xử lý giúp với?" không biến hai việc thành một; tách nhầm rẻ hơn bỏ sót vì có `undo_split` (BPTN/BQL) |
| D03 | 2026-10-16 | GIỮ nguyên mọi chốt còn lại: `electrical-hazard`, `not-both`, `two-places` (người dùng chỉ nói "một vị trí"), và điều kiện engine (an toàn Bậc 1/2 ⇒ không tách, vị trí đủ tòa/tầng/khu vực, cờ bật, chưa tách). Ca "đèn nhấp nháy xèo xèo" vẫn dừng `SAFETY_REVIEW_REQUIRED` |
| D04 | 2026-10-16 | Không sửa `planning/06_…/specs/REF-split-verdict.py` (Path Invariant, tài liệu lịch sử); test phân biệt câu REF bị chặn bởi luật đã bỏ (`marker:`/`question`) và đổi kỳ vọng sang tách |

### Quyết định bị thay thế

- **SPEC-P05 plan 06 §2.2 R-S3, R-S4** ("dấu hiệu nhân quả/nghi ngờ", "có `?`") bị D02 thay thế. R-S1, R-S2, R-S5 còn hiệu lực. Câu "Bảo thủ đã đo… 'Sàn trơn vì nước đọng, đèn lại tối om' không tách" không còn đúng: nay tách.

## Vùng cấm (đã cân nhắc, KHÔNG làm)

- Không nới `two-places`: hai vị trí cần gán vị trí riêng cho từng ticket con, ngoài phạm vi PATCH.
- Không nới guard an toàn / `risk_level != NONE`: tách không được che cảnh báo Bậc 1/2.
- Không làm mô hình "một ticket, hai phòng ban cùng xử lý": đổi mô hình dữ liệu (nhiều assignee), cần MINOR + bộ SPEC.

## Phân công

| WP | Việc | Tầng |
|---|---|---|
| WP1 | `rules.py` bỏ R-S3/R-S4; cập nhật test (`test_rule_evidence`, `test_p1_split`, `test_acceptance`, `test_agent_unit`) | 🟠 |

## Checklist

- [x] Đo hiện trạng bằng probe `receive` hai chế độ (10 câu): 6 câu một vị trí bị chặn
- [x] Sửa `src/maintenance/rules.py` (`split_verdict`)
- [x] Test: câu một vị trí có `nên/vì/do/hình như/hoặc/?` tách thành hai ticket (S-02b); câu hai vị trí / một việc vẫn không tách
- [x] Probe lại: 9/10 câu tách, 1 câu còn `SAFETY_REVIEW_REQUIRED` (đúng)
- [x] `pytest tests`: 3768 passed, 102 pg deselected, 34 xfailed, 0 fail
- [x] `ruff check src tests`: sạch
- [x] Đồng bộ docs/não + tăng version 1.13.1
- [ ] Chạy `--pg` (Docker) và kiểm bằng ticket thật của người dùng

## Bảng trỏ SPEC

PATCH nên không có `specs/`. Hợp đồng gốc: [SPEC-P05 plan 06](../06_2026-10-05_reasoning-agent/specs/) §2.2, §3.
