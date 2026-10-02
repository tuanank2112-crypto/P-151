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
| **Tài liệu kỹ thuật module** | [`docs/`](../docs/) | Thư mục chứa tài liệu chuyên trách 1-1 cho từng module. |

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
| `src/maintenance/engine.py` | State machine theo CR-BPTN-03 (bảng T02–T23), pipeline bước 2–8 + 3b an toàn, đối soát bước 10, jobs; ghi ticket liên quan cùng transaction (`_related`); `build_engine(settings)`, `seed_if_empty` |
| `src/maintenance/store/` | `base.py` (Protocol + lỗi), `memory.py`, `postgres.py` (`MO_STORE=postgres`, schema `maintops`), `photos.py` (local/Supabase Storage), Alembic `alembic.ini` + `migrations/` |
| `src/maintenance/{rules,proposer}.py` | Phân loại bằng luật + LLM có guard |
| `src/maintenance/safety.py` | Tầng an toàn bước 3b (CR-BPTN-03 §6): luật Bậc 1/2, bẫy B-01…B-05, so khớp theo dấu, LLM chỉ nâng mức |
| `src/maintenance/priority.py` | Mức ưu tiên PRI-* (CR-BPTN-03 §7) và khoá sắp xếp danh sách |
| `src/maintenance/views.py` | View cư dân (allow-list) và bảng BQL |
| `src/maintenance/{catalog,models,enums}.py` | Catalog mô phỏng, model Pydantic, enum |
| `seed/maintenance_v1/` | Fixture: tickets, catalog, accounts |
| `tests/test_maintenance/` | Test engine, API, auth, acceptance, CR-03 (`test_cr03.py`, `test_safety.py` + `safety_cases.yaml` ≥40 câu), store (pg chỉ chạy `--pg` trên docker `*_test`) |
| `docs/CR-BPTN-03.md` | Spec flow ĐANG CODE (v0.6 candidate); biểu đồ swimlane người dùng 2026-10-01 thắng khi lệch. CR-BPTN-01/02 đã xoá khỏi `docs/` ở commit `4b6f3bc` (Trường), xem git history |

---

## 🗺️ 2. BẢN ĐỒ CẤU TRÚC MÃ NGUỒN (Codebase Directory Map)

```text
project-root/
├── AGENTS.md                         # [QUY TẮC TỐI THƯỢNG] Nguồn chân lý DUY NHẤT (Gemini/Codex đọc trực tiếp)
├── CLAUDE.md                         # [SHIM] Điểm nạp tự động của Claude Code — chỉ chứa @AGENTS.md
├── brain4agent-v1.7.1.md   # [MARKER] Phiên bản khung não — soi nhanh ở root
├── README.md                         # Tài liệu giới thiệu và hướng dẫn build dự án
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
└── docs/                             # [MODULE DOCS] Tài liệu kỹ thuật chi tiết
```
