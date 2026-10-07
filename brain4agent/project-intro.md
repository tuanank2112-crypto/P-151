# Giới Thiệu Dự Án (Project Overview)

## 1. Mục tiêu (Goals & Objectives)
Repo P-151 (AI20K Build Phase) xây **MaintenanceOps Agent** cho BQL một cụm dân cư, chạy trên **dữ liệu mô phỏng** (`SIM-*`), không phải vận hành thật. Cư dân gửi phản ánh về vệ sinh khu vực chung (`PB-CLN-01`) hoặc đèn chiếu sáng khu vực chung (`PB-TEC-01`). Agent kiểm tra dữ liệu, chạy tầng an toàn hai bậc, phát hiện trùng, phân loại và đề xuất phòng ban + mức ưu tiên, tra asset/vật tư rồi giao phòng ban. Phòng ban thực hiện và nộp hồ sơ; BQL kiểm duyệt, đóng hoặc trả làm lại. Agent dừng đúng chỗ cần con người (BPTN, BQL) và không bao giờ tự đóng hay gỡ khẩn cấp.

- **Spec đích duy nhất:** [`docs/CR-BPTN-03.md`](../docs/CR-BPTN-03.md). CR-BPTN-01/02 đã bỏ ngày 2026-10-01. **Trạng thái 2026-10-02 (v1.1.0):** engine đã cài CR-03 P0 (tầng an toàn hai bậc, đường khẩn cấp do BQL xử lý, priority, chốt chặn reopen/gán người/rating) — tài liệu module `docs/maintenance.md`; router/UI/persistence chưa nối.
- **Vai trò:** Cư dân · Agent · BPTN (bộ phận tiếp nhận) · Phòng ban (Vệ sinh/Kỹ thuật) · Kho (actor mô phỏng) · BQL.
- **Mốc:** MVP online 04/10/2026; bàn giao đủ 10 deliverables 19/10/2026 (kế hoạch nhóm trên Notion "Kế hoạch MaintenanceOps MVP").
- Hướng ResidentGPT (hỏi-đáp nội quy, `Problem_Card.md` trên `main`) là hướng cũ, không còn dùng.

## 2. Công nghệ cốt lõi (Tech Stack)
- **Frontend / Web:** UI tĩnh `src/web/` (index.html, app.js, theme.css), FastAPI phục vụ chung; đăng nhập tài khoản mô phỏng theo vai trò. Từ v1.3.0 (plan 07) mang cùng design với `portal/` (Be Vietnam Pro, header gradient xanh, card/pill).
- **Backend / Engine:** Python 3.11, FastAPI, Pydantic. Lõi `src/maintenance/`: `engine.py` (state machine + pipeline), luật `rules.py` + LLM `proposer.py` (LangChain/OpenAI; `LLM_MODE=mock` cho test). LangGraph ở `src/agents/` vẫn là mẫu; kế hoạch đưa lên đường chạy thật trước 19/10.
- **Data Persistence:** `MO_STORE=memory` (mặc định) | `postgres` (schema `maintops`, Alembic, Supabase); ảnh `MO_PHOTO_STORE=local|supabase`. Seed `seed/maintenance_v1/` chỉ nạp khi DB rỗng. Fixture đích CR-03: `seed/maintenance_cr03/`.
- **Kiểm thử và vận hành:** pytest, ruff, Docker Compose, GitHub Actions.

**Mốc (kế hoạch Notion của nhóm):** 23:59 04/10 — MVP online, LLM thật, UI theo vai trò, dữ liệu bền, 4 kịch bản demo;
23:59 19/10 — đủ flow CR-03, LangGraph trên đường chạy thật, eval + bằng chứng UX, 10 deliverables `docs/guide/chapter-09.md`.

**Nhóm & chủ việc:** Như Ý (engine/safety integration/LangGraph) · Trường (nghiệp vụ, dataset/nhãn, rules/playbook, quyết
định CR, architecture, user test, pitch) · Châm Anh (API/persistence/CI/deploy/eval runner/chi phí, leader) · Trí (UI/UX,
AI Logs, Phoenix).

## 3. Sản phẩm thứ hai: Cổng phản ánh cư dân `portal/` (plan 06, v1.2.0, 2026-10-07)
- **Bản chất:** website Next.js dựng từ bộ thiết kế `design-ticket-cu-dan/…` (HANDOFF + 6 file `.dc.html`) — 5 vai (Cư dân, Ban tiếp nhận, Ban quản lý, Phòng vệ sinh, Phòng kỹ thuật) dùng chung một PostgreSQL; luồng ticket 6 bước (Tiếp nhận → Thẩm định → Phân công → Đang xử lý → Nghiệm thu → Hoàn tất), Agent phân loại bằng từ khóa Ban tiếp nhận sửa được.
- **ĐỘC LẬP** với MaintenanceOps Agent Python: không dùng engine/CR-BPTN-03, không dùng dữ liệu `SIM-`, mô hình trạng thái riêng. Đừng trộn hai bên khi sửa.
- **Tech stack:** Next.js 16.4 (App Router, `cacheComponents`, Server Actions), React 19, TypeScript strict, Tailwind v4 (+ nguyên CSS thiết kế), Drizzle ORM + `pg`, Vitest (unit + DB thật), Playwright (E2E, chụp màn). Node 24.
- Tài liệu module: [`docs/portal.md`](../docs/portal.md); SPEC: `planning/06_2026-10-07_resident-portal-next/specs/`.
