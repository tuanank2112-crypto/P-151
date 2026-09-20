# Project Index Map & Navigation Router

Tệp này là **Bản Đồ Chỉ Mục Trung Tâm (Master Index Map)** của dự án. Mọi AI Agent sử dụng tệp này để định tuyến tài liệu và nắm bắt toàn bộ bản đồ cấu trúc mã nguồn, luồng giao tiếp và các điểm vào (Entry Points).

---

## 🧭 1. ĐIỀU HƯỚNG TÀI LIỆU & KẾ HOẠCH (Documentation & Planning Router)

Khi nhận nhiệm vụ, Agent tra cứu bảng này để đọc **chính xác** tài liệu chuyên sâu liên quan:

| Lĩnh vực / Nhiệm vụ | Tài liệu chuyên trách | Nội dung chính |
| :--- | :--- | :--- |
| **Ký ức nóng phiên gần nhất** | [`memory/hot/today.md`](memory/hot/today.md) & [`state.json`](memory/hot/state.json) | Trạng thái máy (JSON), nhật ký làm việc theo phiên và kết quả benchmark gần nhất. |
| **Khởi động / Quy tắc chung** | [`memory-distill.txt`](memory-distill.txt) | Kernel hiện trạng, Startup Protocol, Tech stack cốt lõi. |
| **Tổng quan dự án (bản chất repo, mục tiêu, tech stack)** | [`project-intro.md`](project-intro.md) | Đây là sản phẩm DEMO mô phỏng, không phải hệ thống chạy thật; `docs/` là sản phẩm cũ đã hạ cấp. |
| **Thiết kế ĐANG HIỆU LỰC (hỏi "kiến trúc/contract/spec thế nào") — hồ sơ đang mở** | [`planning/01_2026-09-20_resident-agent-v1/`](../planning/01_2026-09-20_resident-agent-v1/) | `plan.md` (nhật ký quyết định Đ01–Đ12) → `specs/00-ARCHITECTURE.md` (router riêng của bộ SPEC) → 8 file SPEC còn lại → `reports/` (phán quyết nghiệm thu). Thứ tự ưu tiên khi mâu thuẫn với `docs/`: `plan.md` thắng, rồi `specs/`, rồi mới tới `docs/`. |
| **Kế hoạch nâng cấp & RFCs (nói chung)** | [`planning/`](../planning/) | Thư mục chứa các bản kế hoạch theo chuẩn `[STT]_[YYYY-MM-DD]_[Ten-Ngan]`. |
| **Đặc tả CŨ đã hạ cấp (hỏi "sản phẩm v0.2 mô tả gì", tham chiếu nội dung/giọng văn)** | [`docs/`](../docs/) | 6 tài liệu PRD/Product Brief/UI Flow v0.2 mô tả một sản phẩm khác (công cụ soạn nháp cho BQL) — KHÔNG còn là định nghĩa sản phẩm, chỉ là nguồn tham chiếu cho lõi trả lời. `docs/assets/` có 3 ảnh (`ref-01/02/03.jpg`) tư liệu dựng UI/danh mục tiện ích. |
| **Lỗi khó / Cạm bẫy / Gotchas** | [`-known-gotchas.md`](-known-gotchas.md) | Tổng hợp các bẫy kỹ thuật và lỗi dị biệt đã gặp. |
| **Kiến trúc dữ liệu & Data Flow (tóm tắt điều hướng, dự kiến)** | [`-data-architecture.md`](-data-architecture.md) | Trỏ sang `specs/01-CONTRACTS.md` cho DDL thật; chưa thi công. |
| **Lộ trình nâng cấp & Ý tưởng** | [`roadmap.md`](roadmap.md) | Active tasks, Kho Ý Tưởng (Idea Vault) và các mốc đã hoàn thành. |
| **Lịch sử cập nhật** | [`changelog.md`](changelog.md) | Lịch sử Semantic Releases (vX.Y.Z). |

---

### 🛠️ 1.2. Bảng Định Tuyến Kỹ Năng Chuyên Dụng (Workspace Skills Router - `.agents/skills/`)

| STT | Tên Skill (`.agents/skills/`) | File Quy Chuẩn (`SKILL.md`) | Vai Trò & Chức Năng Cốt Lõi |
| :---: | :--- | :--- | :--- |
| **1** | `sample-skill` | `SKILL.md` | Kỹ năng mẫu cho workspace. |

---

## 🗺️ 2. BẢN ĐỒ CẤU TRÚC MÃ NGUỒN (Codebase Directory Map)

```text
project-root/
├── AGENTS.md                         # [QUY TẮC TỐI THƯỢNG] Nguồn chân lý DUY NHẤT (Gemini/Codex đọc trực tiếp)
├── CLAUDE.md                         # [SHIM] Điểm nạp tự động của Claude Code — chỉ chứa @AGENTS.md
├── brain4agent-v1.7.1.md   # [MARKER] Phiên bản khung não — soi nhanh ở root
├── package.json / package-lock.json   # Next.js + TS strict; script db:*, test, check
├── .env.example                       # mẫu biến môi trường (OPERATIONS §3), giá trị để RỖNG
├── tsconfig.json / next.config.mjs
├── app/                              # [P01a] Next.js App Router — mọi route chạm DB là dynamic
│   ├── login/                        #   đăng nhập credential 2 vai
│   ├── (resident)/chat/              #   giao diện cư dân
│   └── (bql)/documents|review|eval|dashboard/   # giao diện BQL (nội dung do P03/P04 bồi)
├── lib/                              # [P01a] lõi dùng chung
│   ├── types.ts                      #   NGUỒN CHÂN LÝ kiểu (01-CONTRACTS §7); enum 15 reason_code
│   ├── adapters/db.ts                #   *** FILE DUY NHẤT mở connection (BB-07) ***
│   ├── adapters/anthropic.ts         #   *** FILE DUY NHẤT import SDK Anthropic (BB-07) ***
│   ├── auth/                         #   password (scrypt) · session (cookie HMAC) · guard
│   └── retrieval/query.ts            #   truy vấn lexical, giữ cờ chuẩn hoá 32 (C-05)
├── db/migrations/                    # [P01a] DDL, chưa chạy lần nào (chưa có DATABASE_URL)
│   └── 001_enums → 002_users → 003_knowledge → 004_operational  (thứ tự FK bắt buộc)
├── tests/                            # [P01a] node:test — 13 ca, không cần DB
├── knowledge/                        # [MỚI - P00] Knowledge Pack MÔ PHỎNG, 19 tài liệu / 98 section
│   ├── manifest.json                 #   siêu dữ liệu 19 tài liệu
│   ├── sections/<document_id>.json   #   19 file, tên trùng document_id
│   └── README.md                     #   revision: SIM-1.0.0 + lịch sử đổi
├── evals/golden/                     # [MỚI - P00] Bộ đo, KHÔNG nằm trong knowledge/ (SPEC-P00 §2)
│   ├── golden_faq.jsonl              #   50 case (40 answerable) — Metric 1
│   ├── golden_safety.jsonl           #   16 case, phủ đủ 10 mã canonical — Metric 3
│   ├── expected_defects.json         #   hợp đồng máy đọc của 4 khuyết tật (DEF-01..04)
│   └── rubric.md                     #   CHƯA CÓ — chuyển sang gói P04
├── scripts/                          # Script kiểm + vận hành, Node thuần
│   ├── validate_knowledge.mjs        #   K-M1: documents 19 · sections 98 · defects_ok 4/4
│   ├── validate_golden.mjs           #   K-M2: faq 50 (answerable 40) · safety 16 · canonical 10/10
│   ├── report_facility_rules.mjs     #   K-M4: has_authoritative_rules true 13 · false 1 (FAC-PICKLEBALL)
│   ├── check_adapter_boundary.sh     #   [P01a] BB-07 — đã chứng minh bắt được cả 2 đường rò
│   ├── check_no_hardcoded_knowledge.sh  # [P01a] BB-10
│   ├── check_no_confidence_ui.sh     #   [P01a] BB-05
│   └── migrate/sql/dump_schema/seed_users/seed_knowledge.mjs  # [P01a] SOẠN MÃ, CHƯA CHẠY (cần DATABASE_URL)
├── brain4agent/                      # [BỘ NHỚ DỰ ÁN] Single Source of Truth
│   ├── memory/hot/                   # [HOT MEMORY] Ký ức nóng phiên (today.md, state.json)
│   ├── memory-distill.txt            # [KERNEL] Bản cô đọng tối thượng (< 100 dòng)
│   ├── index.md                      # [ROUTER] Master Index Map & Codebase Navigation
│   ├── roadmap.md                    # [ROADMAP] Tiến độ, Active tasks & Idea Vault
│   ├── changelog.md                  # [CHANGELOG] Lịch sử Semantic Releases
│   ├── -known-gotchas.md             # [GOTCHAS] Tổng hợp lỗi dị biệt & bẫy kỹ thuật
│   ├── -data-architecture.md         # [DATA ARCH] Kiến trúc dữ liệu & Data Flow
│   └── project-intro.md              # [INTRO] Tổng quan dự án & Tech stack
├── planning/                          # [QUẢN LÝ KẾ HOẠCH NÂNG CẤP] Chứa các bản kế hoạch RFCs
│   └── 01_2026-09-20_resident-agent-v1/  # Hồ sơ đang mở — thiết kế ĐANG HIỆU LỰC
│       ├── plan.md                   # Metadata + Nhật ký quyết định Đ01–Đ14 + Work Packages + checklist
│       ├── specs/                    # 9 file SPEC (3711 dòng): 00-ARCHITECTURE (router riêng),
│       │                             #   01-CONTRACTS, SPEC-P00/P02/P03/P04/P05, OPERATIONS, TESTING-ACCEPTANCE
│       ├── handoffs/                 # H02_p00-knowledge-golden.md — bàn giao tự chứa cho worker
│       ├── reports/                  # R01 (thiết kế SPEC) · R02 (P00) — mỗi H đúng một R
│       └── evidence/p00/             # output máy nguyên văn, CẤM sửa tay (report chỉ trỏ)
├── .agents/skills/                   # [WORKSPACE SKILLS] Kỹ năng chuyên dụng cục bộ dự án
└── docs/                             # [ĐẶC TẢ CŨ ĐÃ HẠ CẤP] 6 tài liệu v0.2 (sản phẩm khác) + assets/ (3 ảnh tham chiếu)
```
