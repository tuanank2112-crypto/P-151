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
├── planning/                          # [QUẢN LÝ KẾ HOẠCH NÂNG CẤP] Chứa các bản kế hoạch RFCs
│   └── 01_2026-09-20_resident-agent-v1/  # Hồ sơ đang mở — thiết kế ĐANG HIỆU LỰC
│       ├── plan.md                   # Metadata + Nhật ký quyết định Đ01–Đ12 + Work Packages + checklist
│       ├── specs/                    # 9 file SPEC (3711 dòng): 00-ARCHITECTURE (router riêng),
│       │                             #   01-CONTRACTS, SPEC-P00/P02/P03/P04/P05, OPERATIONS, TESTING-ACCEPTANCE
│       └── reports/                  # R01_specs-design.md — phán quyết nghiệm thu khâu thiết kế
├── .agents/skills/                   # [WORKSPACE SKILLS] Kỹ năng chuyên dụng cục bộ dự án
└── docs/                             # [ĐẶC TẢ CŨ ĐÃ HẠ CẤP] 6 tài liệu v0.2 (sản phẩm khác) + assets/ (3 ảnh tham chiếu)
```
