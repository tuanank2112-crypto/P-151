# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [0.7.0-dev] - 2026-10-02: Code chuyển sang CR-BPTN-03 (kế hoạch 02, chưa đổi version app)
### Added
- `src/maintenance/safety.py`: tầng an toàn bước 3b cho MỌI ticket (kể cả loại việc không rõ/ngoài phạm vi). Bậc 1 (S-01…S-14,
  C-01) → `VERIFYING`/`EMERGENCY_PENDING_BQL` chủ BQL, không draft, không phòng ban, thông báo `emergency.created`. Bậc 2
  → `SAFETY_REVIEW_REQUIRED` chủ BPTN, leo thang BQL sau `safety_review.escalate_after_hours`. Bẫy B-01…B-05; so khớp
  theo dấu ("chạy/chảy" ≠ "cháy" khi gõ có dấu). LLM chỉ nâng mức; PRESENT không trích nguyên văn ⇒ UNCLEAR.
- `src/maintenance/priority.py`: PRI-H1/H2/M1/M2/L1/D0 + PRI-U1 (số báo trùng) / PRI-U2 (người dễ tổn thương); danh sách
  BPTN/BQL/phòng ban sắp khẩn cấp → priority → cũ trước. BPTN/BQL sửa tay (bắt buộc lý do), Agent không ghi đè.
- Hành động mới: `safety_review` (CONFIRM_SAFE / ESCALATE / REQUEST_INFO), `emergency_close` (T10, `closure_kind=
  EMERGENCY_HANDLED`), `emergency_downgrade`, `create_follow_up`, `bql_merge`, `undo_merge` (T09), `set_priority`,
  `report_wrong_department` (T16), `bql_wrong_department` (T17 / E02), `material_short` (T18 + T19 khi kho nhập).
- Gộp: liên kết hai chiều, nối bổ sung + ảnh cư dân vào ticket gốc, `duplicate_count`; hủy ticket gốc ⇒ ticket con về
  `RECEIVED` chạy lại. Ghi ticket thứ hai trong CÙNG transaction (`engine._related`).
- Endpoint: `/mo/tickets/{id}/{safety,unmerge,priority,report-wrong-dept,material-short}`,
  `/bql/tickets/{id}/{emergency/close,emergency/downgrade,follow-up,merge,wrong-dept}`, `/bql/safety-clearances`;
  lọc `/bql/tickets?risk_level=&priority=`. UI BPTN/BQL/phòng ban có form tương ứng.
- Test: `test_cr03.py` (AC-01…AC-17), `test_safety.py` + `safety_cases.yaml` (50 câu: 0 bỏ sót Bậc 1, 0 báo nhầm),
  test pg ghi hai ticket. Fixture `maintenanceops-sim-v1.3`: CLN-004, TEC-005 → khẩn cấp.
### Changed
- Bảng chuyển trạng thái theo CR-03 §4.1 (21 dòng T02–T22 + hủy từ 7 trạng thái). SYSTEM/AGENT không gọi `transition()`.
- T15 đếm `wrong_department_return_count`, lần 2 leo thang BQL. Rating đúng một lần; ticket `MERGED` được đánh giá khi
  gốc `CLOSED`. Luật phân loại đèn nhận "cháy / nhấp nháy / nổ bóng / chết" (B-01).
### Removed
- Reopen: `engine.reopen`, `Ticket.reopen_until` (doc cũ vẫn đọc được), `sla_config.reopen_window_days`, endpoint
  `/resident/tickets/{id}/reopen`, nút "Báo chưa xong".
### Decided
- CR-BPTN-03 là spec đích; biểu đồ swimlane của người dùng thắng khi lệch (người dùng chốt 2026-10-02).
- Giá trị cấu hình D-02 (4 h / 12 h) và D-03 (3) dùng tạm theo CR-03, CHỜ người dùng chốt.

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
