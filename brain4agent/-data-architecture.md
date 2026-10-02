# Master Data Architecture & Flow

Tài liệu thiết kế về cấu trúc dữ liệu, cơ chế lưu trữ bền vững (Persistence Layer) và luồng luân chuyển dữ liệu đa tầng.

## 1. Các Tầng Lưu Trữ (Data Persistence Stores)
- **Hiện tại (code `a305fc0`):** ticket, tồn kho, audit, status event, outbox giữ IN-MEMORY trong engine; khởi động nạp lại từ `seed/maintenance_v1/` (`catalog.yaml` = danh mục tĩnh + `sla_config`; `tickets.yaml` = 12 ticket mẫu kèm expected outcome; `accounts.yaml` = tài khoản mô phỏng). Restart là mất dữ liệu.
- **Kế hoạch MVP 04/10:** PostgreSQL (Supabase) lưu case dạng snapshot JSONB có phiên bản + stock + audit + status event + outbox trong cùng transaction; ảnh trong Supabase Storage bucket riêng tư, chỉ cấp qua backend kiểm quyền. Seed chỉ nạp khi DB rỗng.
- `.ai-log/session.jsonl` là log dùng công cụ AI của thành viên, không phải dữ liệu ứng dụng.

- **Từ vựng là DỮ LIỆU (2026-10-02):** `seed/maintenance_v1/lexicon.yaml` (`safety` + `priority`) nạp bởi `catalog.load_lexicon()` với validator V-01…V-12; `catalog.yaml` `sla_config` có `safety_review`, `missing_info.safety_context`, `priority`. Cả hai nạp lúc khởi tạo engine (`lru_cache`; sửa YAML phải khởi động lại process). Dữ liệu test an toàn ở `tests/test_maintenance/data/` (bộ dừng, ca nhãn).

## 2. Schema & Data Flow (theo `docs/CR-BPTN-03.md`)
- **Trạng thái (10, CR-03 §3.1):** `RECEIVED`, `VERIFYING`, `NEED_INFO`, `ON_HOLD`, `ROUTED`, `IN_PROGRESS`, `READY_FOR_REVIEW`, `MERGED`, `CLOSED`, `CANCELLED`. Một ticket chỉ có MỘT blocker mở (`ReasonCode` + `BlockerOwner`, §3.2).
- **Chuyển trạng thái:** chỉ các dòng T01–T23 (§4.1) hợp lệ; ngoài bảng → `INVALID_TRANSITION` (409); sai vai trò → `ACTION_DENIED` (403) + audit. Sự kiện đổi chủ blocker không đổi status: E01–E03 (§4.2).
- **Pipeline Agent (§5.1):** 1 toàn vẹn → 2 dữ liệu tối thiểu → **2b tầng an toàn (mọi ticket)** → 3 phân loại + phòng ban + priority → 4 trùng (D-09) → 5 review → 6 asset → 7 vật tư/kho → 8 `can_route` rồi `ROUTED` → 10 `report_complete` (6 điều kiện, ≥1 ảnh). Chạy lại sau gỡ blocker theo bảng §5.2.
- **Đã cài ở P0 (v1.1.0):** `risk_level`, `risk_signals[]` (kết quả 2b gần nhất), `safety_cleared_by/at/reason`, `safety_context`, `related_ticket_ids[]`, `priority`, `priority_source`, `priority_rule_id`, `priority_reason`, `closure_kind`; `assignee_id` kiểu `None`; bỏ `reopen_until`. Còn lại ở dòng dưới là P1.
- **Ticket mới trường (§12.1):** `priority*`, `risk_level`, `risk_signals[]`, `safety_cleared_*`, `duplicate_count`, `merged_children[]`, `related_ticket_ids[]`, `duplicate_rejected_of[]`, `follow_up_of`, `closure_kind`, `wrong_department_return_count`. `assignee_id` luôn `null`.
- Nội dung gốc và ảnh gốc của cư dân bất biến; bổ sung chỉ append. Cư dân chỉ thấy view allow-list (`views.py`), không thấy `risk_*`, `reason_code`, ghi chú nội bộ.
