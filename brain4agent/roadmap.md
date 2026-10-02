# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

## Mục tiêu hiện tại (Active)
- [ ] Kế hoạch 02 `planning/02_2026-10-02_cr-bptn-03-hybrid/` (đích 0.7.0): code chuyển sang CR-BPTN-03 (tầng an toàn 3b,
  priority, gộp an toàn, T16/T17/E02, bỏ reopen) — xong local (pytest 290 + `--pg` 311, evaluate 12/12, bộ an toàn 0 bỏ
  sót). Còn: người dùng chốt giá trị cấu hình D-02/D-03; cổng server (deploy Supabase).
- [ ] CR-BPTN-03 (v0.6 candidate) vẫn PROPOSED: chưa có Product approver ghi tên. CR-BPTN-02 đã bị CR-03 thay thế.
- [ ] Kế hoạch 01 `planning/01_2026-10-02_supabase-persistence/` (đích 0.6.0): WP1 ✅; WP2–WP4 xong local (R02 chờ duyệt);
  còn WP4b (phiên lưu DB), WP5 (smoke + gate Supabase: owner chạy migration), WP6 (docs, bump).

## Tương lai (Upcoming)
- [ ] Audit cho `receive_stock` (kho nhập vật tư): hiện không có dòng audit vì `AuditEvent` bắt buộc `ticket_id`.
- [ ] Quyết định giữ hay xoá boilerplate LangGraph (`/api/v1/chat`, `src/agents/`, `src/services/llm.py`) — MaintenanceOps không dùng.
- [ ] Nếu deploy sau reverse proxy: lấy IP client từ header tin cậy, nếu không khóa đăng nhập sẽ dồn về IP của proxy.

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)
*Nơi lưu trữ các ý tưởng hay, kiến trúc mở rộng chưa ưu tiên làm ngay nhưng cần giữ lại để tham khảo.*
- [ ] Chạy ruff format cho `scripts/` (hiện CI không kiểm).
- [ ] Màn hình BPTN chưa có nút "Hoàn tác gộp" (API `/mo/tickets/{id}/unmerge` cho BPTN đã có; UI mới đặt ở BQL).
- [ ] Bộ câu an toàn: thêm câu thật (ẩn danh) khi có dữ liệu thử nghiệm để đo báo nhầm sát thực tế hơn 50 câu mô phỏng.
- [ ] Dọn ảnh mồ côi trong bucket (put xong mà tx lỗi và delete cũng lỗi) — non-goal kế hoạch 01.
- [ ] CI chạy `pytest --pg` với service Postgres trong GitHub Actions.
## Đã hoàn thành (Done)
- [x] **Nhánh khẩn cấp của biểu đồ 2026-10-01 (CR-BPTN-03, 2026-10-02):** bước 3b, `EMERGENCY_PENDING_BQL` chỉ BQL xử lý
  (đóng / hạ / ticket tiếp theo / gộp / hủy); Bậc 2 → BPTN 3 lựa chọn. Kế hoạch 02.
- [x] **Khởi tạo Bộ Nhớ Não Bộ Chuẩn (v1.0.0):** Thiết lập cấu trúc Đa Tầng brain4agent V5.2 và quy chuẩn quản trị AGENTS.md.
- [x] **Rà soát backend 2026-09-30:** an toàn đồng thời cho engine, job không chặn event loop, chặn cư dân lùi ngày ở production,
  khóa đăng nhập theo username + client, `/chat` không lộ lỗi, `llm.py` nhận `OPENAI_BASE_URL`, ruff sạch toàn repo.
- [x] **Flow 2026-10-01:** phân loại (bước 3) trước kiểm tra trùng (bước 4); hàm bước đặt tên `_step_<số>_<việc>`;
  `WAITING_MATERIAL` chạy lại từ tra tài sản. 142 test xanh.
- [x] **Thiếu dữ liệu giao BPTN (2026-10-01):** `MISSING_INFO` do BPTN gỡ (nhập vị trí/thông tin sau khi gọi cư dân), cư
  dân vẫn tự bổ sung được; UI BPTN có hàng chờ `NEED_INFO`. 146 test xanh.
