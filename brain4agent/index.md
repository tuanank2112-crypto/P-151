# Project Index Map & Navigation Router

Tệp này là **Bản Đồ Chỉ Mục Trung Tâm (Master Index Map)** của dự án. Mọi AI Agent sử dụng tệp này để định tuyến tài liệu và nắm bắt toàn bộ bản đồ cấu trúc mã nguồn, luồng giao tiếp và các điểm vào (Entry Points).

---

## 🧭 1. ĐIỀU HƯỚNG TÀI LIỆU & KẾ HOẠCH (Documentation & Planning Router)

Khi nhận nhiệm vụ, Agent tra cứu bảng này để đọc **chính xác** tài liệu chuyên sâu liên quan:

| Lĩnh vực / Nhiệm vụ | Tài liệu chuyên trách | Nội dung chính |
| :--- | :--- | :--- |
| **Ký ức nóng phiên gần nhất** | [`memory/hot/today.md`](memory/hot/today.md) & [`state.json`](memory/hot/state.json) | Trạng thái máy (JSON), nhật ký làm việc theo phiên và kết quả benchmark gần nhất. |
| **Khởi động / Quy tắc chung** | [`memory-distill.txt`](memory-distill.txt) | Kernel hiện trạng, Startup Protocol, Tech stack cốt lõi. |
| **Tổng quan dự án** | [`project-intro.md`](project-intro.md) | Mục tiêu, kiến trúc tổng thể. |
| **Kế hoạch nâng cấp & RFCs** | [`planning/`](../planning/) | Thư mục chứa các bản kế hoạch theo chuẩn `[STT]_[YYYY-MM-DD]_[Ten-Ngan]`. |
| **Lỗi khó / Cạm bẫy / Gotchas** | [`-known-gotchas.md`](-known-gotchas.md) | Tổng hợp các bẫy kỹ thuật và lỗi dị biệt đã gặp. |
| **Kiến trúc dữ liệu & Data Flow** | [`-data-architecture.md`](-data-architecture.md) | Cấu trúc dữ liệu, cơ chế lưu trữ và State Flow. |
| **Lộ trình nâng cấp & Ý tưởng** | [`roadmap.md`](roadmap.md) | Active tasks, Kho Ý Tưởng (Idea Vault) và các mốc đã hoàn thành. |
| **Lịch sử cập nhật** | [`changelog.md`](changelog.md) | Lịch sử Semantic Releases (vX.Y.Z). |
| **Tài liệu kỹ thuật module** | [`docs/`](../docs/) · [`../docs/maintenance.md`](../docs/maintenance.md) | Tài liệu chuyên trách 1-1; `maintenance.md` = module `src/maintenance/` (pipeline, tầng an toàn R1–R10, 5 method khẩn cấp, priority, cấu hình, test). Đọc TRƯỚC khi sửa engine. |
| **Kế hoạch 01 — CR-03 P0 engine (✅ 2026-10-02)** | [`../planning/01_2026-10-01_cr03-p0-engine/`](../planning/01_2026-10-01_cr03-p0-engine/) | `plan.md` (Q01–Q33), `specs/` (SPEC-P01 an toàn, P02 khẩn cấp, P03 priority, P04 chốt chặn, TESTING, OPERATIONS), `reports/R01…R11`, `evidence/`. Hợp đồng từ vựng: `specs/01-CONTRACTS.md` §5 + `seed/maintenance_v1/lexicon.yaml`. |
| **Kế hoạch 04 — sửa logic sau rà soát (v1.1.3, 2026-10-04)** | [`../planning/04_2026-10-04_logic-review-fix/`](../planning/04_2026-10-04_logic-review-fix/) | `plan.md` (§1 16 lỗi đo được, Q01–Q12), `handoffs/H01` từ vựng an toàn, `H02` rules/proposer, `H03` backend (bản vá cho Châm Anh), `H04` UI (Trí), `H05` rules/spec (Trường), `reports/R01–R02`, `evidence/`. Test hồi quy: `tests/test_maintenance/test_logic_review_fixes.py`, `test_rules_review_fixes.py`, `test_safety_review_fixes.py`. Tóm tắt: `docs/maintenance.md` §12. |
| **⭐ Kế hoạch 09 — Tăng tốc đọc backend (v1.5.0, 2026-10-08)** | [`../planning/09_2026-10-08_backend-speed/`](../planning/09_2026-10-08_backend-speed/plan.md) · [`../docs/maintenance.md`](../docs/maintenance.md) §14 | `PostgresRepository.list()` cache theo `xmin` (1 câu SQL, không TTL), `resident_view(lookup=…)` bỏ N+1. Object từ `list()` CHỈ ĐỌC. Probe đo lại: `evidence/audit/probes/`. |
| **⭐ Kế hoạch 07 — UI `src/web/` theo design portal (v1.3.0, 2026-10-07)** | [`../planning/07_2026-10-07_web-portal-reskin/`](../planning/07_2026-10-07_web-portal-reskin/plan.md) · [`../docs/web.md`](../docs/web.md) | Reskin UI tĩnh backend: `theme.css` + remap palette Tailwind CDN + header gradient/đăng nhập/helper; API/logic không đổi. SPEC: `01-CONTRACTS.md` (token, DOM id, màu trạng thái). Đọc `docs/web.md` TRƯỚC khi sửa `src/web/`. |
| **⭐ Kế hoạch 06 — Cổng phản ánh cư dân `portal/` (v1.2.0, 2026-10-07)** | [`../planning/06_2026-10-07_resident-portal-next/`](../planning/06_2026-10-07_resident-portal-next/plan.md) · [`../docs/portal.md`](../docs/portal.md) | Website Next.js 16 + TypeScript + Tailwind v4 + PostgreSQL (Drizzle) dựng từ `design-ticket-cu-dan/…/HANDOFF.md` + 6 file `.dc.html`. ĐỘC LẬP backend Python. SPEC: `specs/00-ARCHITECTURE.md` (bất biến, lệch D1–D9), `01-CONTRACTS.md` (schema, stage 1..6, action, lỗi). Đọc `docs/portal.md` TRƯỚC khi sửa `portal/`. |
| **Kế hoạch 05 — làm cứng Agent (v1.1.4, 2026-10-05)** | [`../planning/05_2026-10-04_agent-hardening/`](../planning/05_2026-10-04_agent-hardening/plan.md) | `plan.md` (Q01–Q10), `handoffs/H01–H04`, `reports/R01–R04`, `evidence/`. Bộ biến thể: `tests/test_maintenance/test_safety_metamorphic.py`, `test_classify_metamorphic.py`; điều phối: `test_agent_coordination.py`. Tóm tắt: `docs/maintenance.md` §13. |
| **Kế hoạch 06 — Reasoning Agent & P1 (2026-10-05)** | [`../planning/06_2026-10-05_reasoning-agent/`](../planning/06_2026-10-05_reasoning-agent/) | `plan.md` (Q01–Q29), `specs/` (00-ARCHITECTURE, 01-CONTRACTS, P01–P09, OPERATIONS, TESTING), `SPEC-P09-semantic-coordination.md` (điều phối ngữ nghĩa, B1–B4), `handoffs/H15`, `H16` (WP17 runtime CHỜ DUYỆT), `reports/R15` (§01–§17), `evidence/WP16/`. |
| **⭐ SPEC DUY NHẤT — MaintenanceOps** | [`../docs/CR-BPTN-03.md`](../docs/CR-BPTN-03.md) | Vai trò/quyền, 10 trạng thái, T01–T23, pipeline §5.1, tầng an toàn §6, priority §7, gộp §8, AC-01..18, P0/P1. CR-01/02 đã xoá. |
| **Sản phẩm (nền v0.3, lệch thì CR-03 thắng)** | [`../docs/01_problem_statement.md`](../docs/01_problem_statement.md) … [`05_traceability_and_review.md`](../docs/05_traceability_and_review.md), [`data-contract-v1.md`](../docs/data-contract-v1.md), [`playbook-v1.md`](../docs/playbook-v1.md) | Bài toán, PRD, UI flow, data contract, playbook. |
| **Swimlane / sơ đồ flow** | [`../docs/Activity Diagram.png`](../docs/Activity%20Diagram.png) | Bản nháp, CHƯA khớp CR-03 (thiếu Bậc 2, sai thứ tự an toàn). `flow_maintenanceops_v04.png` là flow cũ. |
| **Chạy app / API hiện có** | [`../README.md`](../README.md) | Docker, endpoints `/api/v1/mo`, `/resident`, `/bql`. |
| **Việc của Trường hôm nay / phân công nhóm** | [`roadmap.md` §Trường](roadmap.md) + [`memory-distill.txt` `<truong_focus>`](memory-distill.txt) | Lịch 01/10–19/10 theo Notion, chủ việc từng người, chỉ tiêu 19/10. |
| **Dataset / nhãn / fixture đích** | [`seed/maintenance_cr03/`](../seed/maintenance_cr03/) | `safety_cases.json` (nhãn safety), `tickets.yaml` (expected outcome). |
| **Deliverables cuối (10 mục)** | [`docs/guide/chapter-09.md`](../docs/guide/chapter-09.md) | Checklist bàn giao 19/10. |

---

### 🛠️ 1.2. Bảng Định Tuyến Kỹ Năng Chuyên Dụng (Workspace Skills Router - `.agents/skills/`)

| STT | Tên Skill (`.agents/skills/`) | File Quy Chuẩn (`SKILL.md`) | Vai Trò & Chức Năng Cốt Lõi |
| :---: | :--- | :--- | :--- |
| **1** | `nao-dong-bo` | `SKILL.md` | Đồng bộ tài liệu não sau khi xong task. |
| **2** | `nao-commit` | `SKILL.md` | Đề xuất/thực hiện commit theo chuẩn não. |
| **3** | `nao-dong-phien` | `SKILL.md` | Đóng phiên, ghi ký ức nóng. |
| **4** | `nao-ten-phien` | `SKILL.md` | Đặt tên phiên. |
| **5** | `vai-dieu-phoi` | `SKILL.md` | Điều phối nhiều vai agent. |
| **6** | `vai-thi-cong` | `SKILL.md` | Vai thi công (thực thi task). |

### 🧩 1.3. Bản đồ mã nguồn P-151 (Entry Points)

| Đường dẫn | Vai trò |
| :--- | :--- |
| `src/main.py` | FastAPI app, lifespan (kiểm cấu hình ảnh → dựng engine + seed khi rỗng, KHÔNG reset; job), handler 503/403 lỗi store, mount `/ui` |
| `src/api/auth.py` | Đăng nhập, session in-memory, `get_actor` |
| `src/api/routers/maintenance.py` | Router `/mo` (nội bộ), `/resident`, `/bql` |
| `src/api/photos.py` | Kiểm tra magic bytes; `save`/`discard`/`load` qua `PhotoStore` (502 `PHOTO_STORE_FAILED`) |
| `src/maintenance/engine.py` | State machine, pipeline bước 2–8 (+2b an toàn), đối soát bước 10, jobs, 5 method `safety_*`/`emergency_*` + `set_priority`; `build_engine(settings)`, `seed_if_empty` |
| `src/maintenance/{safety,priority}.py` | Tầng an toàn 2b (luật R1–R10, từ vựng `lexicon.yaml`); luật priority PRI-* |
| `src/maintenance/store/` | `base.py` (Protocol + lỗi), `memory.py`, `postgres.py` (`MO_STORE=postgres`, schema `maintops`), `photos.py` (local/Supabase Storage), Alembic `alembic.ini` + `migrations/` |
| `src/maintenance/{rules,proposer}.py` | Phân loại bằng luật + LLM có guard |
| `src/maintenance/views.py` | View cư dân (allow-list) và bảng BQL |
| `src/maintenance/{catalog,models,enums}.py` | Catalog mô phỏng, model Pydantic, enum |
| `seed/maintenance_v1/` | Fixture: tickets, catalog (`sla_config`), accounts, `lexicon.yaml` (từ vựng an toàn + priority) |
| `tests/test_maintenance/` | Test engine, API, auth, acceptance, safety/emergency/priority (CR-03), store (pg chỉ chạy `--pg` trên docker `*_test`), `test_cr03_store.py` (CR-03 qua repository + Q04) |
| `seed/maintenance_cr03/` | Fixture đích CR-03: nhãn safety + expected outcome (Trường) |
| `portal/src/server/workflow.ts` | [Next.js] MỌI ghi ticket của Cổng phản ánh (FOR UPDATE + stage có điều kiện + history) |
| `portal/src/server/queries.ts`, `session.ts` | [Next.js] Đọc theo vai; session cookie ↔ bảng `sessions` |
| `portal/src/app/{login,resident,reception,management,cleaning,technical}/` | [Next.js] 6 màn ↔ 6 file `.dc.html`; Server Actions ở `app/actions/` |
| `portal/src/db/schema.ts`, `portal/drizzle/` | [Next.js] 10 bảng + migration SQL; seed `src/db/seed.ts` |

---

## 🗺️ 2. BẢN ĐỒ CẤU TRÚC MÃ NGUỒN (Codebase Directory Map)

```text
project-root/
├── AGENTS.md                         # [QUY TẮC TỐI THƯỢNG] Nguồn chân lý DUY NHẤT (Gemini/Codex đọc trực tiếp)
├── CLAUDE.md                         # [SHIM] Điểm nạp tự động của Claude Code — chỉ chứa @AGENTS.md
├── brain4agent-v1.7.1.md             # [MARKER] Phiên bản khung não — soi nhanh ở root
├── README.md                         # Giới thiệu + cách chạy (phần v0.3 đã cũ; spec là docs/CR-BPTN-03.md)
├── requirements.txt                  # Dependency Python
├── portal/                           # [Next.js 16 + TS + Tailwind + PostgreSQL/Drizzle] Cổng phản ánh cư dân (plan 06, docs/portal.md) — ĐỘC LẬP src/
│   ├── src/{app,components,lib,server,db}/  # màn + actions · UI dùng chung · thuần (agent, sla…) · chỉ server (workflow, queries, session) · schema/seed
│   ├── drizzle/, scripts/, tests/{unit,db}/ # migration SQL · migrate/seed/e2e/screens · vitest
├── design-ticket-cu-dan/             # Bộ thiết kế nguồn (HANDOFF.md + design/*.dc.html) của portal/
├── src/
│   ├── main.py                       # FastAPI app; lifespan tạo engine + job retry/leo thang (asyncio.to_thread); mount /api/v1, /ui
│   ├── config.py                     # Pydantic Settings (LLM_MODE, MO_JOBS_ENABLED, ...)
│   ├── maintenance/                  # [LÕI NGHIỆP VỤ] MaintenanceOps
│   │   ├── engine.py                 # State machine (TRANSITIONS) + pipeline `_step_2.._step_8` + bước 10 + resume/jobs/receive_stock
│   │   ├── enums.py, models.py       # TicketStatus, ReasonCode, Ticket, Blocker, WorkOrderDraft, ...
│   │   ├── rules.py, proposer.py     # Luật cố định + LLM structured proposal (fallback khi lỗi)
│   │   ├── safety.py                 # Bước 2b: assess() Bậc 1/Bậc 2 theo luật R1–R10 (hàm thuần), scope_before dùng chung; guard LLM chỉ nâng mức
│   │   ├── priority.py               # PRI-H1/H2/M1/M2/L1/D0 (hàm thuần; phủ định qua safety.scope_before)
│   │   ├── catalog.py                # Đọc seed catalog + sla_config + lexicon.yaml (validator V-01…V-12, khoá WP3d)
│   │   ├── views.py, messages.py, i18n/vi.yaml  # View cư dân (allow-list) / BQL; lời cho cư dân
│   │   └── migration.py, demo.py     # Ánh xạ v0.4→v0.5; demo/evaluate
│   ├── api/routers/maintenance.py    # /api/v1/mo, /resident, /bql
│   ├── api/auth.py, api/photos.py    # Đăng nhập + session in-memory + khoá theo client; ảnh (kiểm magic bytes)
│   ├── web/                          # UI tĩnh (index.html, app.js, theme.css = design portal, plan 07) — docs/web.md
│   ├── agents/                       # LangGraph MẪU của template, chưa trên đường chạy
│   └── services/llm.py               # Factory LLM
├── seed/maintenance_v1/              # catalog.yaml, tickets.yaml (12 ca + expected), accounts.yaml, lexicon.yaml (từ vựng an toàn + priority = DỮ LIỆU)
├── tests/test_maintenance/           # acceptance, engine, api, auth, fixtures, proposer, migration, safety, emergency, priority; data/ (bộ dừng + ca nhãn — `git add -f`, .gitignore chặn `data/`)
├── scripts/                           # Hook ghi log AI của template
├── .github/workflows/                 # CI
├── brain4agent/                      # [BỘ NHỚ DỰ ÁN] Single Source of Truth
│   ├── memory/hot/                   # [HOT MEMORY] Ký ức nóng phiên (today.md, state.json)
│   ├── memory-distill.txt            # [KERNEL] Bản cô đọng tối thượng (< 100 dòng)
│   ├── index.md                      # [ROUTER] Master Index Map & Codebase Navigation
│   ├── roadmap.md                    # [ROADMAP] Tiến độ, Active tasks & Idea Vault
│   ├── changelog.md                  # [CHANGELOG] Lịch sử Semantic Releases
│   ├── -known-gotchas.md             # [GOTCHAS] Tổng hợp lỗi dị biệt & bẫy kỹ thuật
│   ├── -data-architecture.md         # [DATA ARCH] Kiến trúc dữ liệu & Data Flow
│   └── project-intro.md              # [INTRO] Tổng quan dự án & Tech stack
├── planning/                         # [QUẢN LÝ KẾ HOẠCH NÂNG CẤP] 01 … 05, 06 resident-portal-next (portal/)
├── .agents/skills/                   # [WORKSPACE SKILLS] Kỹ năng chuyên dụng cục bộ dự án
└── docs/                             # [MODULE DOCS] CR-BPTN-03.md, maintenance.md (module engine), portal.md (portal/), 01–05, data-contract, playbook
```

## Trường MVP preparation — 2026-10-03
- Hồ sơ 5 gói Trường: `planning/02_2026-10-03_truong-mvp-prep/plan.md`, SPEC/handoffs/reports/evidence.
- Module docs: `docs/maintenance.md`; decisions amendment: `docs/CR-BPTN-03.md`.
- Rules P0 độc lập: `src/maintenance/safety.py`; dữ liệu đích `seed/maintenance_cr03/`; tests `test_safety_p0.py`, `test_cr03_targets.py`.
- User xác nhận D-01 delta + persisted structured context; D-02–07 defaults. D-08 group approval recorded (leader Lê Thị Châm Anh, reported date 2026-10-02, recorded 2026-10-03); chưa tích hợp engine/runtime.

- Ngày 03: `planning/02_2026-10-03_truong-mvp-prep/specs/SPEC-P06-DAY03.md`; đã chạy local (17 PASS/1 FAIL/5 BLOCKED); kết quả: `deliverables/day03-summary.md`, `day03-wording.md`, `day03-results.json` của cùng package; harness `evidence/d3-06/harness.py`.
