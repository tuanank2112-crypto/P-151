Vai: Bạn là worker của repo này — loại THI CÔNG, chủ việc API/backend (Châm Anh), tầng 🟠 (có bản vá + test sẵn; còn vài mục cần thiết kế nhỏ).
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (exit 0 là đủ).
Đọc theo thứ tự: `planning/04_2026-10-04_logic-review-fix/plan.md` §1 (A1–A4, L1, L2) và §2 Q10, Q16; `docs/maintenance.md` §12; `src/api/routers/maintenance.py`, `src/api/auth.py`.

## 1. Bối cảnh
Rà soát 2026-10-04 (engine + 2 thẩm định Opus + kiểm thử end-to-end qua HTTP) tìm ra lỗi ở tầng API. Như Ý chỉ giữ phần Agent/engine nên đã TÁCH phần sửa router/auth ra khỏi PR của plan 04. Phần engine liên quan đã vào PR: lỗi 403 cho người ngoài phạm vi không còn `unchanged_status`, giá trị ghi audit khi bị từ chối cắt ở 500 ký tự (`engine.DENIED_TEXT_MAX`), REWORK cần ảnh mới (`Case.evidence_round_start`).

## 2. Phạm vi
- ĐƯỢC sửa: `src/api/routers/maintenance.py`, `src/api/auth.py`, thêm `tests/test_maintenance/test_backend_review_fixes.py`.
- CẤM chạm: `src/maintenance/` (engine/Agent — Như Ý), `src/web/` (Trí), `seed/`.

## 3. Việc phải làm
(a) Áp bản vá có sẵn: `git apply planning/04_2026-10-04_logic-review-fix/handoffs/H03_backend-api.patch` (đã kiểm áp sạch trên nhánh plan 04). Bản vá gồm:
- A2: `POST /evidence` từ chối `SIMULATED_IMAGE`/`RESIDENT_ORIGINAL` (422) — hiện gửi "ảnh" dạng chữ qua được cổng ≥1 ảnh (CR §9.4(4), AC-14).
- A3: hai route upload ảnh đọc tệp async rồi chạy phần chặn (store, `engine.lock`) bằng `run_in_threadpool` — hiện làm đứng event loop (/health 0,02 s → 2,5 s).
- A4: `/mo/ai-logs` chỉ BPTN/BQL/QA (log chứa nguyên văn phản ánh mọi ticket); lọc status/since/until trước rồi mới cắt `limit`. LƯU Ý: UI hiện tab AI Logs cho mọi staff ⇒ phối hợp Trí (H04 mục c) trước khi bật.
- L2: `/mo/tickets` sắp theo `views.queue_sort_key` như `/bql/tickets` (SPEC-P03: priority trống xếp cuối).
- Giới hạn chữ tự do `TEXT_MAX` = 2000 ở các body; `new_value` của `/attempt` ≤ 2000 ký tự JSON (chặn phình audit).
- L1: `AuthService` khoá khi sửa `sessions`/`failures` (đã đo: 300k session → mất session + `RuntimeError`).
(b) Lỗi mới từ kiểm thử E2E, CHƯA có bản vá:
- `GET /mo/ai-logs?since=2026-10-04T00:00:00` (không timezone) ⇒ 500 TypeError — trả 422 hoặc gắn timezone.
- `/materials` với `NaN` ⇒ 500; `Infinity`/`1e400` ở `/materials`, `/warehouse/stock` ⇒ 200, tồn kho vô cực — dùng `Field(allow_inf_nan=False)`.
- Chữ mẫu Swagger "string" lọt vào `original_description`, `additions.content`, `cancel_reason` (đã hủy ticket thật) — áp `_no_placeholder` như `NoteBody`.
- Upload ảnh vào ticket ngoài phạm vi/không tồn tại trả 415/413 và đọc tới 25 MB rồi mới kiểm quyền — kiểm `_staff_case`/`_own_case` trước khi đọc tệp.
- `GET /bql/tickets?blocker_owner_role=…` bị bỏ qua (CR §13) — truyền xuống `bql_rows`.
- Kho (`kho01`) POST lên ticket không chờ vật tư vẫn nhận 403 kèm `unchanged_status` (`engine._scope_error` không xét WAREHOUSE; test acceptance 08 khoá 403+audit) — nếu muốn ẩn, sửa ở router hoặc nhờ Như Ý.
- Cư dân thấy câu BPTN gõ (`bptn_resolve info`) như phần bổ sung của chính mình (`views.py` lọc theo `submitted_by`) — `views.py` thuộc engine: báo Như Ý nếu cần.
- Cấu hình: `APP_ENV` mặc định `development` ⇒ `/auth/demo-accounts` lộ mật khẩu chung, cư dân đặt được `simulated_received_at`; `/mo/catalog` mở cho cư dân; `/mo/jobs/run` (now tùy ý) và `/mo/demo` chạy trên DB chung không bị `MO_ALLOW_RESET` chặn.
(c) Cần nhóm quyết (Q10): người ngoài phạm vi trả 404 thay vì 403 + audit (chặn dò ticket, chặn phình audit do gọi lặp) — đổi 8 test đã duyệt.

Xong khi: `python -m pytest -q -p no:cacheprovider` exit 0 (≥ 1843 + 5 test của bản vá + test bạn thêm, 0 fail); `ruff check` + `ruff format --check src tests` exit 0; mỗi lỗi (b) có test từng ĐỎ trước khi sửa.

## 4. Luật
Conventional Commits tiếng Anh; không đổi contract đã duyệt khi chưa có quyết định nhóm; mọi commit cập nhật `brain4agent/memory/hot/` (hook chặn).

## 5. Tầng
(a) 🟢 áp bản vá + chạy test · (b) 🟠 · (c) 🔴 cần người.

## 6. Mẫu report (ghi `planning/04_2026-10-04_logic-review-fix/reports/R03_backend-api.md`)
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: H03_backend-api.md` / `Base:` / `Head:`; rồi lệnh + exit code, test tổng/pass/fail/skip, `git diff --stat`, việc KHÔNG làm + lý do; dòng cuối phán quyết.
