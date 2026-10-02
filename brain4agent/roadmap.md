# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

## Mục tiêu hiện tại (Active)
- [ ] CR-BPTN-02 (v0.5 candidate, trạng thái PROPOSED trên `feature/chamanh`): chờ duyệt để thành baseline.

## Tương lai (Upcoming)
- [ ] Lưu trữ bền vững: engine đang in-memory (restart là mất dữ liệu); Postgres trong compose chưa dùng.
- [ ] Audit cho `receive_stock` (kho nhập vật tư): hiện không có dòng audit vì `AuditEvent` bắt buộc `ticket_id`.
- [ ] Quyết định giữ hay xoá boilerplate LangGraph (`/api/v1/chat`, `src/agents/`, `src/services/llm.py`) — MaintenanceOps không dùng.
- [ ] Nếu deploy sau reverse proxy: lấy IP client từ header tin cậy, nếu không khóa đăng nhập sẽ dồn về IP của proxy.

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)
*Nơi lưu trữ các ý tưởng hay, kiến trúc mở rộng chưa ưu tiên làm ngay nhưng cần giữ lại để tham khảo.*
- [ ] Chạy ruff format cho `scripts/` (hiện CI không kiểm).
- [ ] Biểu đồ flow 2026-10-01 — **nhánh khẩn cấp**: từ bước phân loại chuyển thẳng BQL "Thực hiện task khẩn cấp". Code chưa có
  khái niệm khẩn cấp (không status/cờ/luật nhận diện); cần CR mới (đổi contract trạng thái) trước khi làm.
## Đã hoàn thành (Done)
- [x] **Khởi tạo Bộ Nhớ Não Bộ Chuẩn (v1.0.0):** Thiết lập cấu trúc Đa Tầng brain4agent V5.2 và quy chuẩn quản trị AGENTS.md.
- [x] **Rà soát backend 2026-09-30:** an toàn đồng thời cho engine, job không chặn event loop, chặn cư dân lùi ngày ở production,
  khóa đăng nhập theo username + client, `/chat` không lộ lỗi, `llm.py` nhận `OPENAI_BASE_URL`, ruff sạch toàn repo.
- [x] **Flow 2026-10-01:** phân loại (bước 3) trước kiểm tra trùng (bước 4); hàm bước đặt tên `_step_<số>_<việc>`;
  `WAITING_MATERIAL` chạy lại từ tra tài sản. 142 test xanh.
- [x] **Thiếu dữ liệu giao BPTN (2026-10-01):** `MISSING_INFO` do BPTN gỡ (nhập vị trí/thông tin sau khi gọi cư dân), cư
  dân vẫn tự bổ sung được; UI BPTN có hàng chờ `NEED_INFO`. 146 test xanh.
