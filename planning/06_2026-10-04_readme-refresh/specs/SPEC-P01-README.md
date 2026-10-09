# SPEC-P01 — Cấu trúc & nội dung README.md

Người đọc: giảng viên chấm, muốn chạy được trong ≤10 phút mà không xin khoá.

## 1. Thứ tự mục BẮT BUỘC
1. Tiêu đề + 1 đoạn mô phỏng (giữ) · Vấn đề · Giải pháp (rút gọn, bỏ chi tiết v0.3; trỏ CR-03 là spec đích).
2. Tech stack (sửa: dữ liệu mặc định in-memory; PostgreSQL local KHÔNG còn là đường chính).
3. **Chạy nhanh (Docker, `MO_STORE=memory`)**: clone → `cp .env.example .env` → `docker compose up -d --build` → `/health`, `/docs`, `/ui/`.
4. **Biến môi trường**: bảng đầy đủ, nhóm theo mục dưới.
5. **Ví dụ truy vấn**: tài khoản demo, 4 câu phản ánh mẫu, chuỗi curl.
6. Tuỳ chọn: chạy ngoài Docker (hot reload); Supabase (`MO_STORE=postgres`).
7. Test & lint.
8. Xử lý sự cố (giữ, sửa dòng lệch).
9. Cấu trúc thư mục (cập nhật) · API (code đang chạy) · Tài liệu · Deliverables · Team · License.

## 2. Bảng biến môi trường (nguồn: `.env.example`, `src/config.py`)
Cột: Biến · Mặc định · Bắt buộc · Ghi chú. Phải phủ:
- LLM: `LLM_MODE` (mock|openai, mặc định mock), `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `MODEL_NAME` (gpt-4o-mini).
- MaintenanceOps: `MO_STORE` (memory|postgres), `MO_SEED_ON_EMPTY`, `MO_ALLOW_RESET`, `MO_PHOTO_STORE` (local|supabase), `MO_UPLOAD_DIR`, `MO_JOBS_ENABLED`, `MO_ALLOW_ACTOR_HEADER` (CẤM bật ở production).
- Supabase (chỉ khi `postgres`/`supabase`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (BÍ MẬT), `SUPABASE_STORAGE_BUCKET`, `DATABASE_URL` (Session pooler), lệnh Alembic một lần.
- App: `APP_PORT`, `APP_ENV`, `CORS_ORIGINS`, `LOG_LEVEL`. DB local: `POSTGRES_*` chỉ cho compose.
- Log AI (rút gọn, 1 đoạn): `AI_LOG_API_KEY`, `LANGCHAIN_*` — ghi "chỉ thành viên nhóm cần; giảng viên không cần".
- Cột "Bắt buộc" cho đường chạy nhanh: KHÔNG biến nào bắt buộc ngoài `cp .env.example .env`.

## 3. Ví dụ truy vấn
- Tài khoản demo (từ `seed/maintenance_v1/accounts.yaml`): `cudan01`, `bptn01`, `vesinh01`, `kythuat01`, `kho01`, `bql01`, `qa01`; mật khẩu chung `Demo@2026` (dữ liệu mô phỏng).
- 4 câu mẫu (nguyên văn từ `tickets.yaml`) kèm kết quả mong đợi LẤY TỪ chạy thật, không từ trí nhớ:
  - `Hành lang tầng 3 tòa SIM-A có nhiều rác và vết bẩn, cần vệ sinh.` (SIM-TKT-CLN-001, thường)
  - `Đèn hành lang tầng 3 tòa SIM-A không sáng từ tối qua.` (kỹ thuật)
  - `Tầng hầm B1 tòa SIM-A có chất lỏng lạ không rõ nguồn gốc, bốc mùi hắc gây khó thở, cần vệ sinh.` (CLN-004, Bậc 1)
  - `Đèn sảnh thang máy tầng 5 tòa SIM-A không sáng, có tia lửa và mùi khét ở hộp đèn.` (TEC-005, Bậc 1)
- Chuỗi curl (prefix `/api/v1`): `POST /auth/login` → token → `POST /resident/tickets` body `{"original_description": "...", "channel": "form"}` → `GET /resident/tickets/{id}` → đăng nhập `bql01` → `GET /bql/tickets`.
- Swagger: `POST /mo/demo/{ticket_id}`, `POST /mo/evaluate` (12 ticket) — giữ.
- Shell: ví dụ curl cho bash VÀ PowerShell (người chấm dùng Windows).

## 4. BẮT BUỘC / CẤM
- BẮT BUỘC: mọi lệnh/curl/kết quả mong đợi đã chạy thật trên Docker sạch; tên endpoint khớp `src/api/routers/maintenance.py` và `src/api/auth.py`.
- BẮT BUỘC: mục API ghi rõ "mô tả code hiện có; spec đích CR-BPTN-03".
- CẤM: dán khoá thật/URL Supabase vào README (URL project có trong `.env.example` — README chỉ trỏ `.env.example`).
- CẤM: ghi URL live, Render, hay gán số test/benchmark không đo.
- CẤM: sao chép nội dung CR-03 vào README. CẤM đổi code/`.env.example` trong gói này (nếu thấy lệch → báo, không sửa).
- Vùng cấm (đã cân nhắc, KHÔNG làm): dịch sang tiếng Anh (người dùng chốt giữ tiếng Việt); viết lại phần API theo CR-03 (code chưa khớp).
- Mục "Chạy server" sai (`log_manual.py`) và số bước trùng → XOÁ/đánh số lại.
- Team: một dòng Lê Thị Châm Anh · Trưởng nhóm · 2A202602846; xoá các dòng `[Tên]` (chưa có dữ liệu) — nhóm bổ sung sau, CẤM bịa tên.

## 5. Phân loại lỗi khi nghiệm thu
| Lỗi | Hành vi |
|---|---|
| Lệnh trong README chạy lỗi | Sửa README (hoặc ghi rõ điều kiện); không sửa code |
| Kết quả mong đợi lệch kết quả thật | Lấy kết quả thật; nếu nghi bug → ghi `-known-gotchas.md`, báo Như Ý |
| Docker không chạy được trên máy kiểm | Ghi "không kiểm được" vào evidence, không báo xanh |

## 6. Nghiệm thu (đo được)
- A1 `docker compose up -d --build` exit 0, `/health` 200.
- A2 `POST /auth/login` cudan01 → 200 + token.
- A3 4 câu mẫu → trạng thái khớp bảng trong README.
- A4 chuỗi curl bash + PowerShell chạy đúng.
- A5 `git diff --stat` chỉ có `README.md` (+ `planning/06_*`, `brain4agent/`).
- A6 mọi biến trong `.env.example` có mặt trong bảng README (kiểm bằng lệnh so khớp, lưu `evidence/`).
- Gate: ✅ local / ⬜ online (không có online → để ⬜ N/A).

## 7. Amendment — correction authorized 2026-10-04
- Scope expands to docs/architecture_diagram.md and existing component/data-flow artifact locations; replaces the README-only restriction for this correction. Runtime code/config and Team facts remain out of scope.
- MUST distinguish current implementation from LangGraph/Phoenix/GPT-4o targets; diagrams follow _run_pipeline order, including BPTN step5, REWORK and persistence on every mutation.
- MUST preserve original diagram paths; components old .drawio.svg remains an SVG alias, editable source is .drawio.
- Static acceptance: zero broken local links; SVG/draw.io/Mermaid edge parity; XML parses; negative broken-link control detected. Evidence: ../evidence/readme/correction-checks.txt.
- Runtime and visual acceptance remain open when Python/Docker or permitted renderer is unavailable; MUST NOT claim complete submission verification.

## 8. Superseding amendment — original layouts restored
- User requested original layouts; section7 implementation-view replacement is superseded. MUST preserve original SVG/draw.io geometry and target labels; explain runtime discrepancies in surrounding text.
- Components restored from original Downloads SVG including embedded mxfile; data-flow artifacts restored byte-for-byte from VS Code history. Hash/XML/link evidence: ../evidence/readme/layout-restoration-checks.txt.
