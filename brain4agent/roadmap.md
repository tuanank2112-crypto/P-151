# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

## Mục tiêu hiện tại (Active)
- [ ] **MVP online 04/10/2026:** engine CR-03 P0 đã xong (xem Done); còn nối router/UI cho 5 method khẩn cấp + `set_priority` (Châm Anh/Trí — gợi ý ở `planning/01_2026-10-01_cr03-p0-engine/specs/00-ARCHITECTURE.md` §4.1), persistence PostgreSQL/Supabase, deploy Render, gpt-4o thật.
- [ ] **Tích hợp:** rebase/merge nhánh `feature/nhuy-cr03-p0` vào `develop` (Q04; điểm va chạm `engine.py`, `models.py`, `enums.py`), chạy lại G1–G4, G7 trên CI/Render (cột "server" của Exit Gates), rồi bump version app.
- [ ] **Q22 cho Trường (chủ rules/playbook):** "Bóng đèn … bị cháy" qua 2b ra NONE đúng nhưng `rules.py`/`proposer.py` phân loại `OUT_OF_SCOPE` ⇒ ticket đèn phổ biến nhất dừng chờ BPTN.
- [ ] Trường rà nhãn từ vựng `lexicon.yaml` (từ mới của WP3b–WP3d) và danh sách `khet_electric_contexts`; mọi sửa phải chạy bộ dừng.
- [ ] Sơ đồ swimlane khớp CR-03 (thay `docs/Activity Diagram.png`): an toàn trước phân loại, phân loại trước trùng (D-09), có Bậc 2 cho BPTN, gộp → `MERGED` kết thúc, Kho, rating.

## Tương lai (Upcoming)
- [ ] **Bàn giao 19/10/2026 — CR-BPTN-03 P1:** T16/T17/E02 (08/10), gộp an toàn + hoàn tác (09/10), tín hiệu P1 + PRI-U1/U2 (10/10), follow-up + danh sách xác nhận an toàn (11/10); LangGraph trên đường chạy thật (05–07/10), thay boilerplate `src/agents/`; eval: an toàn ≥40 câu, 0 bỏ sót Bậc 1, classification ≥90% held-out, coverage ≥60%.
- [ ] Cập nhật docs `01`–`05`, `data-contract-v1.md`, `playbook-v1.md`, README theo CR-03 (hiện còn ghi v0.3/CR-02, có link gãy tới CR-02).
- [ ] Audit cho `receive_stock` (kho nhập vật tư): hiện không có dòng audit vì `AuditEvent` bắt buộc `ticket_id`.
- [ ] Nếu deploy sau reverse proxy (Render): lấy IP client từ header tin cậy, nếu không khóa đăng nhập sẽ dồn về IP của proxy.

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)
*Nơi lưu trữ các ý tưởng hay, kiến trúc mở rộng chưa ưu tiên làm ngay nhưng cần giữ lại để tham khảo.*
- [ ] Chạy ruff format cho `scripts/` (hiện CI không kiểm).
- [ ] **(2026-10-01) n8n đẩy sự kiện nhập kho vào MaintenanceOps** — NGOÀI scope MVP (CR-03 §1: không tích hợp kho thật); chỉ xét qua change request. Điều kiện tối thiểu: khoá chống trùng (`event_id`) vì `receive_stock` đang cộng dồn, tài khoản máy riêng vai WAREHOUSE (không dùng mật khẩu `kho01`, không bật `MO_ALLOW_ACTOR_HEADER`), tồn kho lưu bền thay vì bộ nhớ, dữ liệu vẫn chỉ mã `SIM-`.
- [ ] **(2026-10-02) Idea Vault từ hồ sơ 01:** `cancel_reason` hiển thị nguyên văn cho cư dân và `cancel` thiếu `AuditEvent` (có từ trước, R05 N-13/N-14); tổng bổ sung của cư dân chưa giới hạn (R07 M8, mỗi bổ sung <= 5000 ký tự); `>=` với đồng hồ cố định có thể chặn gỡ Bậc 2 trong mô phỏng (R07 M12); LLM an toàn raise-only ở P1 (cần chạy ngoài `engine.lock`); giới hạn đã biết của 2b: Cyrillic/leet/ligature/chữ tách rời/lặp đúng 2 chữ, "Tòa KO có khói", tín hiệu P1 (S-06…S-08, S-10…S-13), B-04 trùng tên riêng có dấu.

## Đã hoàn thành (Done)
- [x] **Lắp brain4agent (2026-09-30):** Chạy engine V5.2, tạo các phân vùng nhớ, luật `AGENTS.md`, skill và shim cho agent.
- [x] **Rà soát backend 2026-09-30 (Châm Anh):** an toàn đồng thời cho engine, job không chặn event loop, chặn cư dân lùi ngày ở production, khóa đăng nhập theo username + client, `/chat` không lộ lỗi, `llm.py` nhận `OPENAI_BASE_URL`, ruff sạch toàn repo.
- [x] **Flow 2026-10-01 (Châm Anh, `1e2f42b`):** phân loại (bước 3) trước kiểm tra trùng (bước 4); hàm bước `_step_<số>_<việc>`; `WAITING_MATERIAL` chạy lại từ tra tài sản. 142 test xanh.
- [x] **Chốt CR-BPTN-03 là spec duy nhất (2026-10-01):** xoá `docs/CR-BPTN-01.md`, `docs/CR-BPTN-02.md`; CR-03 thêm D-09 (thứ tự theo `1e2f42b`); sửa README; não chuyển sang MaintenanceOps + CR-03.
- [x] **Hồ sơ 01 — CR-BPTN-03 P0 cho engine (2026-10-02, v1.1.0):** `planning/01_2026-10-01_cr03-p0-engine/` ✅. Tầng an toàn 2b hai bậc (`safety.py`, từ vựng `lexicon.yaml`, luật R1–R10), luồng khẩn cấp (5 method BPTN/BQL, chặn `resume()`/job gỡ khẩn cấp, hạn 4 giờ lịch/12 giờ), priority + `queue_sort_key`, bỏ reopen, `SET_ASSIGNEE` bị từ chối, rating một lần, seed CLN-004/TEC-005 Bậc 1. 1462 test; 3 vòng thẩm định cô lập + holdout (NONE 2/39). Tài liệu: `docs/maintenance.md`.
