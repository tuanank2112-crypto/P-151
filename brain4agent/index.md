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
| **⭐ SPEC DUY NHẤT — MaintenanceOps** | [`../docs/CR-BPTN-03.md`](../docs/CR-BPTN-03.md) | Vai trò/quyền, 10 trạng thái, T01–T23, pipeline §5.1, tầng an toàn §6, priority §7, gộp §8, AC-01..18, P0/P1. CR-01/02 đã xoá. |
| **Sản phẩm (nền v0.3, lệch thì CR-03 thắng)** | [`../docs/01_problem_statement.md`](../docs/01_problem_statement.md) … [`05_traceability_and_review.md`](../docs/05_traceability_and_review.md), [`data-contract-v1.md`](../docs/data-contract-v1.md), [`playbook-v1.md`](../docs/playbook-v1.md) | Bài toán, PRD, UI flow, data contract, playbook. |
| **Swimlane / sơ đồ flow** | [`../docs/Activity Diagram.png`](../docs/Activity%20Diagram.png) | Bản nháp, CHƯA khớp CR-03 (thiếu Bậc 2, sai thứ tự an toàn). `flow_maintenanceops_v04.png` là flow cũ. |
| **Chạy app / API hiện có** | [`../README.md`](../README.md) | Docker, endpoints `/api/v1/mo`, `/resident`, `/bql`. |

---

### 🛠️ 1.2. Bảng Định Tuyến Kỹ Năng Chuyên Dụng (Workspace Skills Router - `.agents/skills/`)

| STT | Tên Skill (`.agents/skills/`) | File Quy Chuẩn (`SKILL.md`) | Vai Trò & Chức Năng Cốt Lõi |
| :---: | :--- | :--- | :--- |
| **1** | `nao-dong-bo`, `nao-commit`, `nao-dong-phien`, `nao-ten-phien` | `SKILL.md` từng thư mục | Đồng bộ bộ nhớ, commit, đóng và đặt tên phiên. |
| **2** | `vai-dieu-phoi`, `vai-thi-cong` | `SKILL.md` từng thư mục | Hồ sơ điều phối và thi công của bộ não. |

---

## 🗺️ 2. BẢN ĐỒ CẤU TRÚC MÃ NGUỒN (Codebase Directory Map)

```text
project-root/
├── AGENTS.md                         # [QUY TẮC TỐI THƯỢNG] Nguồn chân lý DUY NHẤT (Gemini/Codex đọc trực tiếp)
├── CLAUDE.md                         # [SHIM] Điểm nạp tự động của Claude Code — chỉ chứa @AGENTS.md
├── brain4agent-v1.7.1.md             # [MARKER] Phiên bản khung não — soi nhanh ở root
├── README.md                         # Giới thiệu + cách chạy (phần v0.3 đã cũ; spec là docs/CR-BPTN-03.md)
├── requirements.txt                  # Dependency Python
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
│   ├── web/                          # UI tĩnh (index.html, app.js)
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
├── planning/                         # [QUẢN LÝ KẾ HOẠCH NÂNG CẤP] Chứa các bản kế hoạch RFCs
├── .agents/skills/                   # [WORKSPACE SKILLS] Kỹ năng chuyên dụng cục bộ dự án
└── docs/                             # [MODULE DOCS] CR-BPTN-03.md, maintenance.md (module engine), 01–05, data-contract, playbook
```
