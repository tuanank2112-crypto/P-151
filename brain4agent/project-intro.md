# Giới Thiệu Dự Án (Project Overview)

## 1. Mục tiêu (Goals & Objectives)
P-151 — **MaintenanceOps Agent**: prototype **mô phỏng** (dữ liệu giả, không vận hành thật) giúp BQL tòa nhà xử lý phản ánh
bảo trì khu vực chung một cách nhất quán, truy vết được, không vượt quyền.

> BPTN phải đọc, phân loại và điều phối phản ánh; MaintenanceOps hỗ trợ những bước này, dừng đúng khi cần con người,
> đồng thời kiểm tra hồ sơ trước khi chuyển BQL duyệt. Hiệu quả chỉ kiểm chứng trên dữ liệu mô phỏng + người thử nhập vai.

- Cư dân gửi phản ánh → Agent chạy pipeline bước 2–8: kiểm dữ liệu, phân loại (vệ sinh `PB-CLN-01` / đèn khu vực chung
  `PB-TEC-01`), phát hiện trùng, BPTN review có điều kiện, tra asset, kiểm vật tư, chuyển phòng ban.
- Phòng ban nhận việc → checklist, vật tư, ghi chú, ảnh → báo hoàn thành → Agent đối soát bước 10 → BQL nghiệm thu.
- 10 trạng thái công khai (CR-BPTN-02, v0.5 candidate); mỗi điểm dừng là một `blocker` có owner, retry, leo thang.
- Mọi thao tác có audit; từ chối quyền = `ACTION_DENIED` + audit; lỗi ghi audit = fail closed.

**Mốc (kế hoạch Notion của nhóm):** 23:59 04/10 — MVP online, LLM thật, UI theo vai trò, dữ liệu bền, 4 kịch bản demo;
23:59 19/10 — đủ flow CR-03, LangGraph trên đường chạy thật, eval + bằng chứng UX, 10 deliverables `docs/guide/chapter-09.md`.

**Nhóm & chủ việc:** Như Ý (engine/safety integration/LangGraph) · Trường (nghiệp vụ, dataset/nhãn, rules/playbook, quyết
định CR, architecture, user test, pitch) · Châm Anh (API/persistence/CI/deploy/eval runner/chi phí, leader) · Trí (UI/UX,
AI Logs, Phoenix).

Baseline tài liệu trên nhánh này: `docs/01`–`05`, `docs/data-contract-v1.md`, `docs/playbook-v1.md`, `docs/CR-BPTN-03.md`,
`docs/maintenance.md`. `CR-BPTN-01/02.md` được tham chiếu nhưng KHÔNG có trên `feature/truong` (nằm ở nhánh khác).

## 2. Công nghệ cốt lõi (Tech Stack)
- **Frontend / Web:** HTML tĩnh + Tailwind CDN (`src/web/`), mount tại `/ui`, chỉ gọi API.
- **Backend / Engine:** Python 3.11, FastAPI; engine thuần Python (`src/maintenance/engine.py`); LLM qua LangChain
  `ChatOpenAI` (MVP: gpt-4o structured proposal, luật giữ quyền an toàn, LLM chỉ nâng mức), `LLM_MODE=mock` = chỉ luật.
- **Data Persistence:** `MO_STORE=memory` (mặc định) | `postgres` (schema `maintops`, Alembic, Supabase); ảnh
  `MO_PHOTO_STORE=local|supabase`. Seed `seed/maintenance_v1/` chỉ nạp khi DB rỗng. Fixture đích CR-03: `seed/maintenance_cr03/`.
- **DevOps:** Docker Compose, GitHub Actions (ruff + pytest); deploy đích Render free + Supabase; trace Phoenix (Trí).
