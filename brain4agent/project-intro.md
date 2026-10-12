# Giới Thiệu Dự Án (Project Overview)

## 1. Mục tiêu (Goals & Objectives)
Repo P-151 (AI20K Build Phase) xây **MaintenanceOps Agent** cho BQL một cụm dân cư, chạy trên **dữ liệu mô phỏng** (`SIM-*`), không phải vận hành thật. Cư dân gửi phản ánh về vệ sinh khu vực chung (`PB-CLN-01`) hoặc đèn chiếu sáng khu vực chung (`PB-TEC-01`). Agent kiểm tra dữ liệu, chạy tầng an toàn hai bậc, phát hiện trùng, phân loại và đề xuất phòng ban + mức ưu tiên, tra asset/vật tư rồi giao phòng ban. Phòng ban thực hiện và nộp hồ sơ; BQL kiểm duyệt, đóng hoặc trả làm lại. Agent dừng đúng chỗ cần con người (BPTN, BQL) và không bao giờ tự đóng hay gỡ khẩn cấp.

- **Spec đích duy nhất:** [`docs/CR-BPTN-03.md`](../docs/CR-BPTN-03.md). CR-BPTN-01/02 đã bỏ ngày 2026-10-01. **Trạng thái 2026-10-02 (v1.1.0):** engine đã cài CR-03 P0 (tầng an toàn hai bậc, đường khẩn cấp do BQL xử lý, priority, chốt chặn reopen/gán người/rating) — tài liệu module `docs/maintenance.md`; router/UI/persistence chưa nối.
- **Vai trò:** Cư dân · Agent · BPTN (bộ phận tiếp nhận) · Phòng ban (Vệ sinh/Kỹ thuật) · Kho (actor mô phỏng) · BQL.
- **Mốc:** MVP online 04/10/2026; bàn giao đủ 10 deliverables 19/10/2026 (kế hoạch nhóm trên Notion "Kế hoạch MaintenanceOps MVP").
- Hướng ResidentGPT (hỏi-đáp nội quy, `Problem_Card.md` trên `main`) là hướng cũ, không còn dùng.

## 2. Công nghệ cốt lõi (Tech Stack)
- **Frontend / Web:** UI tĩnh `src/web/` (index.html, app.js, theme.css), FastAPI phục vụ chung; đăng nhập tài khoản mô phỏng theo vai trò. Từ v1.3.0 (plan 07) mang cùng design với `portal/` (Be Vietnam Pro, header gradient xanh, card/pill).
- **App điện thoại (v1.7.0, plan 11):** PWA `src/mobile/` ở `/app/` cho Cư dân, BQL, Phòng ban, BPTN, Kho — plain JS ES module, CSS chép từ thiết kế `portal/` (SPEC-P04), manifest + service worker (chỉ cache vỏ app), không bước build. Client mỏng của cùng API ⇒ cùng DB với web. `docs/mobile.md`.
- **Backend / Engine:** Python 3.11, FastAPI, Pydantic. Lõi `src/maintenance/`: `engine.py` (state machine + pipeline), luật `rules.py` + LLM `proposer.py` (LangChain/OpenAI; `LLM_MODE=mock` cho test). LangGraph ở `src/agents/` vẫn là mẫu; kế hoạch đưa lên đường chạy thật trước 19/10.
- **Data Persistence:** `MO_STORE=memory` (mặc định) | `postgres` (schema `maintops`, Alembic, Supabase); ảnh `MO_PHOTO_STORE=local|supabase`. Seed `seed/maintenance_v1/` chỉ nạp khi DB rỗng. Fixture đích CR-03: `seed/maintenance_cr03/`.
- **Kiểm thử và vận hành:** pytest, ruff, Docker Compose, GitHub Actions.

**Mốc (kế hoạch Notion của nhóm):** 23:59 04/10 — MVP online, LLM thật, UI theo vai trò, dữ liệu bền, 4 kịch bản demo;
23:59 19/10 — đủ flow CR-03, LangGraph trên đường chạy thật, eval + bằng chứng UX, 10 deliverables `docs/guide/chapter-09.md`.

**Nhóm & chủ việc:** Như Ý (engine/safety integration/LangGraph) · Trường (nghiệp vụ, dataset/nhãn, rules/playbook, quyết
định CR, architecture, user test, pitch) · Châm Anh (API/persistence/CI/deploy/eval runner/chi phí, leader) · Trí (UI/UX,
AI Logs, Phoenix).

## 3. Cổng web Next.js dùng Python (plan18, v1.11.0 local)
- UI mới từ develop được giữ qua CSS/shell/icon/card/modal; 6 vai gồm cư dân, BPTN, BQL, vệ sinh, kỹ thuật, kho.
- Next.js presentation/BFF gọi Python `/api/v1` bằng token Python HttpOnly; không DB/workflow/classify riêng trong runtime. Cùng ticket/Agent/kho với `/app/` và `/ui/`.
- Drizzle/pg/workflow/legacy-queries và DB portal giữ để rollback/test lịch sử; không migrate/seed khi khởi động. Không tự chuyển tài khoản/dữ liệu cũ.
- Tech: Next16.4, React19, TypeScript, Tailwind4, Vitest, Playwright; Python contract/engine giữ nguyên. Hồ sơ plan18, docs/portal.md. Docker/boot/phone còn gate mở.


Current feature/truong imported develop04491ad (07/10): src/maintenance/agent/ reasoning runtime/P1 coordination now present; portal legacy was independent; plan18 supersedes that runtime architecture. Integration tests3341 pass; portal and live model/shared rollout not measured here.
Từ hồ sơ 11 (2026-10-09, v1.7.0) `portal/` GỌI backend Python `/api/v1` (engine CR-03, Agent LLM, tầng an toàn), không còn DB riêng; là UI mới, mở qua cổng 8000. UI tĩnh `src/web/` không dùng để demo.
