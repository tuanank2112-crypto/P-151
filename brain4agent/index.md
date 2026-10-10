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
| **⭐ Kế hoạch 10 — Chia trang danh sách 20 ticket (v1.6.0, 2026-10-08)** | [`../planning/10_2026-10-08_list-paging/`](../planning/10_2026-10-08_list-paging/plan.md) · [`../docs/web.md`](../docs/web.md) §4 | `listCard(..., { key, ids })` ở `src/web/app.js`: 20 dòng/trang, đếm vẫn toàn bộ, chuyển trang không gọi API, trang theo ticket đang chọn. Kiểm: `evidence/harness/run_all.sh` (`:8001`), `server_readonly.mjs` (`:8000`). |
| **⭐ Kế hoạch 09 — Tăng tốc đọc backend (v1.5.0, 2026-10-08)** | [`../planning/09_2026-10-08_backend-speed/`](../planning/09_2026-10-08_backend-speed/plan.md) · [`../docs/maintenance.md`](../docs/maintenance.md) §14 | `PostgresRepository.list()` cache theo `xmin` (1 câu SQL, không TTL), `resident_view(lookup=…)` bỏ N+1. Object từ `list()` CHỈ ĐỌC. Probe đo lại: `evidence/audit/probes/`. |
| **⭐ Kế hoạch 07 — UI `src/web/` theo design portal (v1.3.0, 2026-10-07)** | [`../planning/07_2026-10-07_web-portal-reskin/`](../planning/07_2026-10-07_web-portal-reskin/plan.md) · [`../docs/web.md`](../docs/web.md) | Reskin UI tĩnh backend: `theme.css` + remap palette Tailwind CDN + header gradient/đăng nhập/helper; API/logic không đổi. SPEC: `01-CONTRACTS.md` (token, DOM id, màu trạng thái). Đọc `docs/web.md` TRƯỚC khi sửa `src/web/`. |
| **⭐ Kế hoạch 06 — Cổng phản ánh cư dân `portal/` (v1.2.0, 2026-10-07)** | [`../planning/06_2026-10-07_resident-portal-next/`](../planning/06_2026-10-07_resident-portal-next/plan.md) · [`../docs/portal.md`](../docs/portal.md) | Website Next.js 16 + TypeScript + Tailwind v4 + PostgreSQL (Drizzle) dựng từ `design-ticket-cu-dan/…/HANDOFF.md` + 6 file `.dc.html`. ĐỘC LẬP backend Python. SPEC: `specs/00-ARCHITECTURE.md` (bất biến, lệch D1–D9), `01-CONTRACTS.md` (schema, stage 1..6, action, lỗi). Đọc `docs/portal.md` TRƯỚC khi sửa `portal/`. |
| **Kế hoạch 05 — làm cứng Agent (v1.1.4, 2026-10-05)** | [`../planning/05_2026-10-04_agent-hardening/`](../planning/05_2026-10-04_agent-hardening/plan.md) | `plan.md` (Q01–Q10), `handoffs/H01–H04`, `reports/R01–R04`, `evidence/`. Bộ biến thể: `tests/test_maintenance/test_safety_metamorphic.py`, `test_classify_metamorphic.py`; điều phối: `test_agent_coordination.py`. Tóm tắt: `docs/maintenance.md` §13. |
| **Kế hoạch 06 — Reasoning Agent & P1 (2026-10-05)** | [`../planning/06_2026-10-05_reasoning-agent/`](../planning/06_2026-10-05_reasoning-agent/) | `plan.md` (Q01–Q33), `specs/` (00-ARCHITECTURE, 01-CONTRACTS, P01–P09, OPERATIONS, TESTING, `REF-agent-contract.py` = nguồn prompt/schema), `SPEC-P09-semantic-coordination.md` (điều phối ngữ nghĩa, B1–B4), `handoffs/H13` (WP14, R13 🔁), `H15`, `H16` (WP17 runtime CHỜ DUYỆT), `reports/R13`, `R15` (§01–§17), `evidence/WP14/`, `WP16/`, `G-LIVE/`; **Q35 (2026-10-10):** `SPEC-P10-catalog-not-quote.md` (ĐÃ DUYỆT — quote chỉ audit, kiểm danh mục; thay P01 §3.1–3.2, P08 §2, P09 B1/B2), `handoffs/H17`→`R17` (WP18 SPEC), `H18`→`R18` (WP19 runtime), `H19`→`R19` (thẩm định), `evidence/WP18/`, `WP19/`, `WP19-review/` (đo Agent với LLM thật). LLM thật, streaming, cache, CLI, G-LIVE: `docs/maintenance.md` §14. |
| **Kế hoạch 08 — báo khẩn khi ticket đã giao (2026-10-07, CHỜ DUYỆT)** | [`../planning/08_2026-10-07_inflight-emergency/`](../planning/08_2026-10-07_inflight-emergency/plan.md) | `plan.md` (Q01–Q10, P1–P5 chờ người), `specs/` (00, 01, SPEC-P01 báo khẩn/trả về, OPERATIONS, TESTING A-01…A-24), `handoffs/H01–H03`. Chạy sau H13 plan 06. |
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
├── scripts/                           # Hook ghi log AI của template; agent_live_eval.py (G-LIVE: Agent + LLM thật, bộ câu tests/.../data/agent_live_eval.yaml)
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

## Target component diagram — 2026-10-04
- [Hồ sơ 05](../planning/05_2026-10-04_component-diagram/plan.md), router [Architecture](../planning/05_2026-10-04_component-diagram/specs/00-ARCHITECTURE.md): target 19/10, LangGraph/Phoenix confirmed; GPT-4o + vision proposed; SPEC approved; đã bàn giao local [draw.io/SVG](../docs/architecture_diagram.md), chờ user visual review.

## Day04 online acceptance — 2026-10-04
- [Hồ sơ 07](../planning/07_2026-10-04_online-acceptance/plan.md): PROPOSED, 8 task/15 ca; manifest/build QA pending, chưa thực thi online; Trường phụ trách nghiệp vụ, Châm Anh thực hiện restart.

- 2026-10-04, hồ sơ07 cập nhật theo người dùng: chỉ localhost, chưa có online. Kiểm14 ca nghiệp vụ local; R01 postgres kiểm trước/sau restart, memory ghi BLOCKED_MEMORY_STORE. Online BLOCKED_NO_DEPLOYMENT; chưa chạy test trong lượt điều chỉnh kế hoạch.

## Architecture data flow diagram — 2026-10-04
- [Hồ sơ 08](../planning/08_2026-10-04_data-flow/plan.md), router [Architecture](../planning/08_2026-10-04_data-flow/specs/00-ARCHITECTURE.md): target 19/10, CR-BPTN-03 pipeline; bố cục 3 Hành lang Tuyến tính (Upper Escalation, Central Highway 6 trạm, Lower Feedback 4 loops, Bottom Data Stores bar) tỷ lệ 16:9 Zero-Crossing; SPEC approved; đã bàn giao [Mermaid/draw.io/SVG](../docs/diagrams/maintenanceops-data-flow-20261019/README.md), chờ user visual review.


## Documentation correction — 2026-10-04
- Restored target components: `docs/diagrams/Diagrams Components.drawio.svg` (original embedded source) + extracted `.drawio`; data flow restored at its existing path. Replaces the implementation-view redraw. `docs/architecture_diagram.md` explains differences with running code.

## Isolated integration workspace
- integration/truong-develop-20261004 combines local documentation snapshot 5f7c354 with develop 37a0fb3. Original feature/truong worktree remains unchanged. Evidence is in planning/06_2026-10-04_readme-refresh/evidence/integration/.

## Current working branch — 2026-10-04
- Work in feature/truong at C:/P-151-truong: tested integration f4155d6 adopted locally. Integration worktree remains a preparation reference; source is develop37a0fb3. Details and evidence: planning/06_2026-10-04_readme-refresh/.


- Latest local integration: feature/truong + develop52ae81c, see planning/06_2026-10-04_readme-refresh/plan.md and evidence/integration-20261007/. No additional runtime module or entry point introduced by the integration itself.

- GPT-6 Luna local configuration and verification: docs/maintenance.md §Local GPT-6 Luna configuration; src/maintenance/proposer.py openai_client. Real SUCCESS verified on shared-Supabase demo SIM-TKT-0042; see current runtime verification below.

## Shared Supabase runtime verification — 2026-10-07
- Shared Supabase demo SIM-TKT-0042 CLOSED; 2 simulated PNG photos byte/hash verified through API and Storage after restart; cases53->54, preexisting53 unchanged, stock unchanged; GPT-6 Luna SUCCESS / rules+llm:gpt-6-luna (2000.82ms); missing execution photo blocked completion; pytest2973 passed,29 pg deselected, ruff clean. Server127.0.0.1:8001 (jobs/seed/reset false).
- Evidence: planning/07_2026-10-04_online-acceptance/evidence/supabase-demo-20261007/result.json; run_demo.py; pytest.txt; ruff-check.txt. Real AI response preserved in recovery_ai_logs; in-memory API AI Logs are empty after restart. No rating submitted. API flow exercised; no manual browser walkthrough/public deployment/physical maintenance acceptance. Day05/06 remain open.

## Day04 normalized evidence router — 2026-10-07T04:32:59.390139+00:00
- User removed six unused cases from personal acceptance scope; active9=H01,H02,I01,A01,M01,U01,S04,G03,R01. day04-3 manifest/results/issues normalized from valid references, separated legacy8PASS/1BLOCKED and Supabase1PASS/1FAIL (create422 recovered but pending clean201 retest). No cross-build9/9 claim. All references/counts/source time provenance checked;3 corruption controls rejected. No app execution/shared writes/commit/push.
- Records: planning/07_2026-10-04_online-acceptance/deliverables/manifest.json, results.json, issues.json, day04-summary.md; validation: evidence/normalization-20261007/validation.txt in that plan.

## Day05 labeling plan — 2026-10-07

Proposed active package: [Day05 backlog and labels](../planning/09_2026-10-07_day05-labels/plan.md). Router: specs/00-ARCHITECTURE.md → 01-CONTRACTS.md → SPEC-P01-BACKLOG.md → SPEC-P02-LABELS.md → OPERATIONS.md → TESTING-ACCEPTANCE.md. Executed 2026-10-07 (offline): deliverables/{backlog,cases,label-proposals,*-gold(empty),split-manifest(draft)}.json, tools/{validate_day05,run_day05_baseline,build_review_pack}.py + tests, review/; summary deliverables/day05-summary.md; handoffs H01–H05 ↔ reports R01–R05. Existing engine/seed paths unchanged.

## Day05 submission review — 2026-10-07T06:16:13.491588+00:00

Report: [daily/2026-10-05.md](../docs/submission/daily/2026-10-05.md). Fresh command and artifact evidence: planning/09_2026-10-07_day05-labels/evidence/submission-review-20261007/. 270 tools tests pass; 95 manifest hashes match. Dataset gates remain OPEN; this report is not Day05 sign-off.

- Day05 main submission report: [day05-report.md](../docs/submission/day05-report.md), linked from submission README and daily05; local preparation verified, full acceptance pending.


Latest feature/truong merge: develop04491ad → 79f9444; [integration report](../planning/06_2026-10-04_readme-refresh/evidence/integration-latest-20261007/integration-report.md). Imported src/maintenance/agent/ runtime and portal/; portal docs/DB are independent. Shared revision0002 rollout not performed.


Portal direct test: http://localhost:3000/login PID21076; [module docs](../docs/portal.md). Local PostgreSQL, keyword Agent, not the Python/Luna server8002. Runtime evidence plan06 readme-refresh/evidence/runtime-portal-20261007/.

- Day05 completion router: `planning/09_2026-10-07_day05-labels/deliverables/completion-guide.md`; matrix and human-input forms live beside it.

- Active Day05 scope: `planning/09_2026-10-07_day05-labels/specs/SPEC-P03-PRELIMINARY15.md`; user-approved preliminary15 supersedes old30-case closure quota.
