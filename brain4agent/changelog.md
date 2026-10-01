# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [0.5.0-candidate] - 2026-10-01: Phân loại trước kiểm tra trùng (chưa đổi version app)
### Changed
- Pipeline theo biểu đồ flow 2026-10-01: bước 3 = phân loại + đề xuất phòng ban, bước 4 = kiểm tra trùng (trước đây ngược lại).
  Ticket loại việc không rõ dừng ở bước 3, không đọc ticket nào khác; bước 4 chỉ đọc vị trí của ticket cùng category, trong cửa sổ.
- Điểm chạy lại: `CATEGORY_UNCLEAR`/`OUT_OF_SCOPE` → bước 4; bác `DUPLICATE` → bước 5; `WAITING_MATERIAL` → bước 6 (tra lại tài sản).
- Hàm bước đổi tên `_step_<số>_<việc>` (`_step_3_classify_and_propose_department`, `_step_4_check_duplicate_ticket`, …);
  bước 7 tách `_plan_materials_for_playbook` + `_check_material_lines_against_stock`; thêm `_find_duplicate_ticket_id`.
- Tài liệu: CR-BPTN-02 §4, lean PRD, data contract §8.4, playbook, product brief, problem statement, wireframe.
### Decided
- BQL trả làm lại → về thẳng phòng ban đang giữ (`IN_PROGRESS` + `REWORK`), KHÔNG qua BPTN đối chiếu lại phòng ban như
  biểu đồ vẽ. Chốt với người dùng 2026-10-01; ghi tại CR-BPTN-02 §9.3. Không đổi bảng TRANSITIONS.

## [0.5.0-candidate] - 2026-09-30: Backend hardening (chưa đổi version app)
### Fixed
- `engine.at()` đổi đồng hồ theo thread (trước đây toàn cục ⇒ request khác thấy giờ giả).
- `engine.lock` (RLock) bao mọi thao tác ghi: hết mất cập nhật, trùng số ticket, lỗi duyệt dict khi ghi song song.
- Job retry/leo thang chạy qua `asyncio.to_thread`; một ticket lỗi không dừng cả vòng; bỏ qua ticket không đến hạn.
- Cư dân không được gửi `simulated_received_at` khi `APP_ENV=production`.
- Engine tạo sẵn trong lifespan, có khóa khởi tạo; session hết hạn được dọn khi đăng nhập.
- Khóa đăng nhập theo (username, client) và giới hạn bảng lỗi; `/api/v1/chat` không trả `str(e)`.
- `src/services/llm.py` dùng `OPENAI_BASE_URL`; `.dockerignore` loại `data/`, `node_modules/`, `tests/`.
- Ruff sạch cả `scripts/` (giữ `timezone.utc` vì hook có thể chạy Python < 3.11).

## [v1.0.0] - 2026-09-30: Initial Project Scaffolding
### Added
- Khởi tạo kiến trúc dự án và thiết lập hệ thống Bộ Nhớ Não Bộ `brain4agent/` Đa Tầng thế hệ mới.
