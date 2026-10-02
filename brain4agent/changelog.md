# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [v1.1.0] - 2026-10-02: CR-BPTN-03 P0 cho engine MaintenanceOps (hồ sơ 01)
### Added
- Tầng an toàn bước 2b (`src/maintenance/safety.py`) với từ vựng là dữ liệu (`seed/maintenance_v1/lexicon.yaml`): Bậc 1 → `VERIFYING`/`EMERGENCY_PENDING_BQL` (chủ BQL), Bậc 2 → `SAFETY_REVIEW_REQUIRED` (chủ BPTN, hạn 4 giờ lịch); LLM chỉ nâng mức (P0 không bật).
- Năm method công khai `safety_confirm_safe`, `safety_escalate`, `safety_request_info`, `emergency_downgrade`, `emergency_close` + `set_priority`; `priority.py` (PRI-H1/H2/M1/M2/L1/D0); `queue_sort_key` (EMERGENCY trước); outbox `emergency.created`, `safety.review_escalated`.
- `docs/maintenance.md` (tài liệu module); bộ dừng an toàn `tests/test_maintenance/data/safety_stop_sets_p0.yaml`.
### Changed
- `TRANSITIONS` 25 dòng (+T06/T07/T10, bỏ CLOSED→READY_FOR_REVIEW); `sla_config` thêm `safety_review`, `missing_info.safety_context`, `priority`, bỏ `reopen_window_days`; CLN-004 và TEC-005 thành Bậc 1; mô tả cư dân > 5000 ký tự bị từ chối (422).
- CR-03 §5.2: gỡ blocker an toàn chạy lại từ bước 2 (2b tự bỏ qua) — đồng bộ theo code (Q17).
### Decided
- Q23: BPTN trên blocker chủ BQL = 403 + audit cho mọi hành động kể cả `bptn_resolve`. Q19: BQL chỉ dùng 3 lựa chọn Bậc 2 sau khi leo thang. Q29–Q31: thiết kế phạm vi tầng an toàn R1–R10 sau 3 vòng thẩm định cô lập (judge Opus); không bật LLM an toàn ở P0 (`receive` giữ `engine.lock`). Q33: brain 1.0.1 → 1.1.0; KHÔNG đổi version app trong `src/` (đổi khi tích hợp `develop`).
### Not changed
- Router `src/api`, UI `src/web`, persistence/deploy chưa nối; `rules.py`/`proposer.py` giữ (Q22 chuyển Trường); docs `01`–`05`, README vẫn ghi v0.3 (CR-03 thắng).

## [v1.0.1] - 2026-10-01: CR-BPTN-03 là spec duy nhất
### Changed
- Quyết định (Như Ý, 2026-10-01): mọi việc build Agent theo `docs/CR-BPTN-03.md`; bỏ hẳn CR-BPTN-01/02 (xoá file, kể cả bản CR-02 vừa sửa ở `1e2f42b`).
- CR-03: header đổi baseline thành code; thêm **D-09** — phân loại (3) trước kiểm tra trùng (4) theo code `1e2f42b`, tầng an toàn 2b vẫn trước phân loại; sửa §1, §5.1, §5.2, §8, §14 cho khớp.
- README trỏ CR-03. Não bộ chuyển sang MaintenanceOps + CR-03, gộp ghi chú kỹ thuật của não Châm Anh (concurrency, bảo mật, môi trường).
### Not changed
- Comment code, seed, test và docs `01`–`05`/`data-contract-v1`/`playbook-v1` vẫn ghi CR-BPTN-02/v0.3; sẽ đổi khi cài CR-03.
- Quyết định "BQL trả làm lại → về thẳng phòng ban" (Châm Anh ghi ở CR-02 §9.3) vẫn đúng: khớp CR-03 T22.

## [0.5.0-candidate] - 2026-10-01: Phân loại trước kiểm tra trùng (Châm Anh, `1e2f42b`)
### Changed
- Pipeline: bước 3 = phân loại + đề xuất phòng ban, bước 4 = kiểm tra trùng. Điểm chạy lại: `CATEGORY_UNCLEAR`/`OUT_OF_SCOPE` → 4; bác `DUPLICATE` → 5; `WAITING_MATERIAL` → 6.
- Hàm bước đổi tên `_step_<số>_<việc>`; bước 7 tách `_plan_materials_for_playbook` + `_check_material_lines_against_stock`; thêm `_find_duplicate_ticket_id`.
### Decided
- BQL trả làm lại → về thẳng phòng ban đang giữ (`IN_PROGRESS` + `REWORK`), không qua BPTN đối chiếu lại phòng ban.

## [0.5.0-candidate] - 2026-09-30: Backend hardening (Châm Anh)
### Fixed
- `engine.at()` đổi đồng hồ theo thread; `engine.lock` (RLock) bao mọi thao tác ghi; job retry/leo thang chạy qua `asyncio.to_thread`.
- Cư dân không được gửi `simulated_received_at` khi `APP_ENV=production`; khóa đăng nhập theo (username, client); `/api/v1/chat` không trả `str(e)`.
- `src/services/llm.py` dùng `OPENAI_BASE_URL`; `.dockerignore` loại `data/`, `node_modules/`, `tests/`; ruff sạch cả `scripts/`.

## [v1.0.0] - 2026-09-30: Brain4agent installation
### Added
- Lắp hệ thống bộ nhớ `brain4agent/` V5.2.
