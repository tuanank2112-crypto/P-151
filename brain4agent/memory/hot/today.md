# 📅 Nhật Ký Làm Việc Ngày 2026-09-30 (Session Memory Log)

> Cập nhật lúc: `2026-09-30T10:03:15.620Z` | Phiên bản: `v1.0.0`

---

## 🏁 Phiên 2026-09-30 — Khởi tạo cấu trúc dự án

## 🎯 Thành Tựu Khởi Tạo:
- Khởi tạo thành công cấu trúc dự án và bộ nhớ Đa Tầng brain4agent V5.2.

---

## 🏁 Phiên 2026-10-01 — Sửa flow theo biểu đồ: phân loại trước kiểm tra trùng
- Đảo bước 3↔4 trong `_run_pipeline`; hàm bước đổi tên `_step_<số>_<việc>` để grep theo số bước.
- `_find_duplicate_ticket_id`: lọc status/category trước, chỉ parse vị trí ticket cùng category trong cửa sổ 48h.
- Resume: CATEGORY_UNCLEAR/OUT_OF_SCOPE → 4, bác DUPLICATE → 5, WAITING_MATERIAL → 6.
- Test: 142 passed (thêm 10d, 10e; 10b đổi tên → step_5). Đảo lại thứ tự cũ ⇒ 3 test mới đỏ (đã kiểm).
- Chưa làm (Idea Vault): nhánh khẩn cấp → BQL; BQL không duyệt → BPTN đối chiếu lại phòng ban.
- Người dùng chốt: BQL trả làm lại → về thẳng phòng ban cũ (giữ hành vi hiện tại), bỏ ô "BPTN đối chiếu lại phòng ban" của biểu đồ. Ghi CR-BPTN-02 §9.3.
- Người dùng chốt: theo biểu đồ của mình, bỏ qua CR-BPTN-03 (Trường).
- Thiếu dữ liệu giao BPTN: MISSING_INFO ∈ BPTN_REASONS, `bptn_resolve` nhận NEED_INFO (`location`/`info` + note, phải đủ mọi phần thiếu); bỏ `sla_config.missing_info`; UI BPTN thêm form. 146 passed; gỡ MISSING_INFO khỏi BPTN_REASONS ⇒ 13 fail + 43 error (đã kiểm đỏ).
- Sửa docs/CR-BPTN-03.md khớp flow đang code (thêm §19, D-09…D-12, AC-19/20); tầng an toàn đề xuất đặt ở bước 3b sau phân loại.

## 🏁 Phiên 2026-10-02 — Kế hoạch 01: WP2–WP4 (Postgres, ảnh Storage, startup không reset)
- WP2: `store/postgres.py` (FOR UPDATE + version, sequence số ticket, advisory lease, dịch lỗi pgcode), Alembic `0001`, C1–C4, `--pg`.
- WP3: `store/photos.py` Local/Supabase (retry 0,5/1 s, Duplicate-ở-lần-retry, key chỉ `SecretStr`); API ảnh trả `Response` bytes.
- WP4: `get_engine` → `build_engine(settings)` + `seed_if_empty`; cổng `RESET_DISABLED`; compose `COMPOSE_DATABASE_URL`; `.env.example`.
- Đo: mặc định 185 passed + 20 deselected; `--pg` 205 passed; ruff sạch; 11 bằng chứng đỏ exit 1; restart uvicorn thật PASS.
- Sự cố: G1 đầu tiên (trước khi ép env trong conftest) mở kết nối Supabase chỉ-đọc — đã chặn, ghi gotcha.
- Còn: WP4b, WP5 (owner chạy migration Supabase + M-SB1/M-SB2), WP6; R02 chờ người duyệt; chưa commit.
- Owner đã migrate Supabase (`0001_maintops_initial`, kiểm chỉ-đọc PASS, TLSv1.3 client). Chạy alembic phải bằng `.venv\Scripts\python.exe` (conda base không có alembic).
