# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [docs] - 2026-10-03: Tối ưu brain4agent cho Trường (không đổi version app)
### Changed
- Não định hướng theo phân công Notion "Kế hoạch MaintenanceOps MVP": kernel `<truong_focus>`, roadmap lịch Trường 01/10–19/10,
  index router việc Trường/dataset/deliverables, `state.json` thêm link kế hoạch + 3 mốc.
- Sửa thông tin cũ: nhánh worktree `feature/truong`; project-intro persistence `memory|postgres` (không còn "in-memory, chưa dùng
  Postgres"); CR-BPTN-01/02.md đánh dấu không có trên nhánh này.
### Decided
- Trường không sửa engine/API/UI (chủ việc Như Ý/Châm Anh/Trí); giao bằng fixture, test đích và handoff.

## [0.5.0-candidate] - 2026-10-01: Phân loại trước kiểm tra trùng (chưa đổi version app)
### Changed
- Pipeline theo biểu đồ flow 2026-10-01: bước 3 = phân loại + đề xuất phòng ban, bước 4 = kiểm tra trùng (trước đây ngược lại).
  Ticket loại việc không rõ dừng ở bước 3, không đọc ticket nào khác; bước 4 chỉ đọc vị trí của ticket cùng category, trong cửa sổ.
- Điểm chạy lại: `CATEGORY_UNCLEAR`/`OUT_OF_SCOPE` → bước 4; bác `DUPLICATE` → bước 5; `WAITING_MATERIAL` → bước 6 (tra lại tài sản).
- Hàm bước đổi tên `_step_<số>_<việc>` (`_step_3_classify_and_propose_department`, `_step_4_check_duplicate_ticket`, …);
  bước 7 tách `_plan_materials_for_playbook` + `_check_material_lines_against_stock`; thêm `_find_duplicate_ticket_id`.
- Tài liệu: CR-BPTN-02 §4, lean PRD, data contract §8.4, playbook, product brief, problem statement, wireframe.
- **Thiếu dữ liệu giao BPTN:** `MISSING_INFO` vào `BPTN_REASONS` (chủ blocker BPTN, SLA 1h/4h giờ hành chính, bỏ
  `sla_config.missing_info`). `bptn_resolve` nhận ticket `NEED_INFO` với `location` và/hoặc `info` (bắt buộc lý do, phải đủ
  mọi phần thiếu, nếu không thì không lưu gì); `info` lưu thành `ResidentAddition` với `submitted_by` = BPTN. Cư dân vẫn tự
  bổ sung được. Lời nhắn cư dân: "Ban tiếp nhận thông tin sẽ liên hệ bạn…". UI BPTN thêm hàng chờ `NEED_INFO` + form.
- `docs/CR-BPTN-03.md` sửa cho khớp flow đang code (§19 mới): bước 3 phân loại → 3b an toàn (đề xuất) → 4 trùng; bảng
  chạy lại; `MISSING_INFO` chủ BPTN; phòng ban tự phân công; BQL trả làm lại về chính phòng ban; kho nhập → bước 6.
  Đề xuất chưa code (an toàn, priority, hoàn tác gộp…) giữ nguyên, chỉ đổi số bước.
### Decided
- Theo biểu đồ flow của người dùng; CR-BPTN-03 được sửa theo code, không ngược lại (người dùng chốt 2026-10-01).
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

## Trường MVP preparation — 2026-10-03
### Unreleased — chưa đóng gate nhóm/runtime/online
- Chuẩn bị scope/decisions/demo/rules/target fixtures; không đổi baseline runtime hay startup fixture.
- D-01 đích dùng new addition + persisted structured snapshot; không đưa full old raw vào LLM, safety scan và risk monotone.
- D-02–07 user confirmed defaults, nhóm chưa duyệt chính thức; T16/T17/E02 sau 04/10 theo Notion.
- Chưa phát hành hoặc tăng app version; không ghi bộ chuẩn bị thành runtime đã triển khai.


## D-08 approval recorded — 2026-10-03
- D-08 APPROVED: người dùng thông báo leader Lê Thị Châm Anh duyệt phạm vi MVP 04/10 và D-01–D-07; ngày duyệt được báo là 2026-10-02, chưa cung cấp giờ. Ghi nhận ngày 2026-10-03; commit a5e2705/PR #6 là bản tham chiếu được người dùng xác nhận trong phiên này, không khẳng định commit đã tồn tại ngày 02/10. Nguồn: thông báo người dùng trong phiên; chưa có link biên bản ngoài. Không mở rộng thành duyệt mọi CR/backlog hoặc nghiệm thu runtime.
- Không đổi engine/storage/API, không đóng runtime/online gates; chưa commit/push bản ghi này.

## Day03 tasks planned — 2026-10-03
- 2026-10-03T10:43:10+07:00: tạo SPEC/checklist 7 task, chưa chạy. Phạm vi Trường: nghiệp vụ, dữ liệu/expected, kiểm thử, wording, demo; không sửa app safety/engine/API/UI. Không phát hành, không commit/push.

## Day03 results recorded — 2026-10-03
- Day03 chạy local cô lập, nhánh feature/truong, SHA 0ea04adedd023654947e2e97e645043f0ba89159: 23 record = 17 PASS / 1 FAIL / 5 BLOCKED / 0 NOT_RUN. Asset 3/3, vật tư 4/4, trùng 4/4 PASS; wording WORD-03 PASS, WORD-01/02/04 BLOCKED; demo 5 PASS / 1 FAIL (DEMO-01-RATING, engine.py:548-553) / 2 BLOCKED (DEMO-04).
- Không đổi code/runtime, không tăng version ứng dụng, không đóng plan; runtime/online/group-runtime gates vẫn mở. Chờ người quyết: ASSET-03, STOCK-04, owner reopen/rating-once (Như Ý). Bước 0 vẫn exit 1 (thiếu hub).
