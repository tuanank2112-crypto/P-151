# Project Index Map & Navigation Router

Tệp này là **Bản Đồ Chỉ Mục Trung Tâm (Master Index Map)** của dự án. Mọi AI Agent sử dụng tệp này để định tuyến tài liệu và nắm bắt toàn bộ bản đồ cấu trúc mã nguồn, luồng giao tiếp và các điểm vào (Entry Points).

---

## 🧭 1. ĐIỀU HƯỚNG TÀI LIỆU & KẾ HOẠCH (Documentation & Planning Router)

Khi nhận nhiệm vụ, Agent tra cứu bảng này để đọc **chính xác** tài liệu chuyên sâu liên quan:

| Lĩnh vực / Nhiệm vụ | Tài liệu chuyên trách | Nội dung chính |
| :--- | :--- | :--- |
| **Ký ức nóng phiên gần nhất** | [`memory/hot/today.md`](memory/hot/today.md) & [`state.json`](memory/hot/state.json) | Trạng thái máy (JSON), nhật ký làm việc theo phiên và kết quả benchmark gần nhất. |
| **Khởi động / Quy tắc chung** | [`memory-distill.txt`](memory-distill.txt) | Kernel hiện trạng, Startup Protocol, Tech stack cốt lõi. |
| **TỔNG QUAN HIỆN TRẠNG có sơ đồ (hỏi "dự án đang có gì / thiếu gì / làm gì tiếp", chuẩn bị demo)** | [`docs/OVERVIEW.md`](../docs/OVERVIEW.md) | Kiến trúc, luồng 9 chặng + 5 cổng thoát, tiến độ 7 gói, rủi ro demo và đường găng — vẽ bằng Mermaid, đo tại commit `504b7a9`. **Là NGOẠI LỆ trong `docs/`**: mô tả sản phẩm ĐANG CHẠY, khác 6 file v0.2 còn lại. Số liệu có mốc thời gian — đo lại trước khi tin. |
| **Tổng quan dự án (bản chất repo, mục tiêu, tech stack)** | [`project-intro.md`](project-intro.md) | Đây là sản phẩm DEMO mô phỏng, không phải hệ thống chạy thật; `docs/` là sản phẩm cũ đã hạ cấp. |
| **Thiết kế ĐANG HIỆU LỰC (hỏi "kiến trúc/contract/spec thế nào") — hồ sơ đang mở** | [`planning/01_2026-09-20_resident-agent-v1/`](../planning/01_2026-09-20_resident-agent-v1/) | `plan.md` (nhật ký quyết định Đ01–Đ41) → `specs/00-ARCHITECTURE.md` (router riêng của bộ SPEC) → 8 file SPEC còn lại → `reports/` (phán quyết nghiệm thu). Thứ tự ưu tiên khi mâu thuẫn với `docs/`: `plan.md` thắng, rồi `specs/`, rồi mới tới `docs/`. |
| **Kế hoạch nâng cấp & RFCs (nói chung)** | [`planning/`](../planning/) | Thư mục chứa các bản kế hoạch theo chuẩn `[STT]_[YYYY-MM-DD]_[Ten-Ngan]`. |
| **Đặc tả CŨ đã hạ cấp (hỏi "sản phẩm v0.2 mô tả gì", tham chiếu nội dung/giọng văn)** | [`docs/`](../docs/) | 6 tài liệu PRD/Product Brief/UI Flow v0.2 mô tả một sản phẩm khác (công cụ soạn nháp cho BQL) — KHÔNG còn là định nghĩa sản phẩm, chỉ là nguồn tham chiếu cho lõi trả lời. `docs/assets/` có 3 ảnh (`ref-01/02/03.jpg`) tư liệu dựng UI/danh mục tiện ích. |
| **Lỗi khó / Cạm bẫy / Gotchas** | [`-known-gotchas.md`](-known-gotchas.md) | Tổng hợp các bẫy kỹ thuật và lỗi dị biệt đã gặp. |
| **Kiến trúc dữ liệu & Data Flow (tóm tắt điều hướng, dự kiến)** | [`-data-architecture.md`](-data-architecture.md) | Trỏ sang `specs/01-CONTRACTS.md` cho DDL thật; chưa thi công. Nhà cung cấp Postgres là **Supabase** (Đ25), driver `pg`. |
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
├── app/                              # Next.js App Router — mọi route chạm DB là dynamic
│   ├── login/                        #   đăng nhập credential 2 vai; actions.ts đi qua getDataStore()
│   │                                 #   nên chạy được cả mock lẫn postgres (Đ29)
│   ├── api/chat/route.ts             #   *** [P02b] CỬA HTTP DUY NHẤT của luồng hỏi–đáp ***
│   │                                 #   chỉ vai resident; cắt confidence + gate_triggered (BB-05);
│   │                                 #   bảng lỗi SPEC-P02 §9 → mã HTTP; CẤM cache (P02-C8)
│   ├── (resident)/chat/              #   [P02b] màn hỏi–đáp THẬT: trích dẫn, lý do từ chối, 9 chặng
│   └── (bql)/                        #   [P03/P04] Console BQL — nội dung THẬT, không còn khung rỗng
│       ├── documents/{page.tsx,actions.ts,DocumentsTable.tsx,UploadPanel.tsx}
│       │                             #     đọc 19 tài liệu thật; Server Action đổi status/
│       │                             #     effective_status/allowed_for_rag; upload + đổi version
│       │                             #     (mỗi thứ ĐÚNG MỘT câu SQL). setSectionExcluded CHƯA có UI
│       ├── review/{page.tsx,actions.ts,ReviewQueueList.tsx}   # hàng đợi duyệt HITL: máy trạng thái
│       │                             #     pending → approved | edited_approved | rejected
│       ├── eval/{page.tsx,labels.ts}  #   màn eval — đọc lib/eval/score.ts, CHƯA có số nghiệm thu G11
│       └── dashboard/page.tsx        #   tỉ lệ tự động giải quyết tách theo intent và lý do escalate
├── lib/                              # lõi dùng chung
│   ├── types.ts                      #   NGUỒN CHÂN LÝ kiểu (01-CONTRACTS §7); enum 15 reason_code
│   ├── adapters/db.ts                #   *** FILE DUY NHẤT mở connection (BB-07) ***; định tuyến
│   │                                 #   DATA_BACKEND mock|postgres (Đ24); driver `pg` (Đ25)
│   ├── adapters/model.ts             #   *** FILE DUY NHẤT gọi nhà cung cấp model (BB-07) ***
│   │                                 #   [P02a] đổi tên từ anthropic.ts; Gemini (Đ17); backoff; semaphore 4
│   ├── adapters/store-mock.ts        #   [P02a] kho mock đọc thẳng knowledge/ — CHỈ db.ts được import
│   ├── confidence.ts                 #   [P02a] hợp 4 tín hiệu (Đ07); CẤM lộ ra UI (BB-05)
│   ├── pipeline/                     #   [P02a] 3 agent, 9 chặng: index · eligibility · retrieval
│   │                                 #   · ownership · errors. CẤM import store-mock.ts trực tiếp
│   ├── reason-messages.ts            #   [P02b] reason_code → câu tiếng Việt (SPEC-P02 §6.4).
│   │                                 #   Ở .ts để .tsx không chứa chữ cấm của BB-05
│   ├── auth/                         #   password (scrypt) · session (cookie HMAC) · guard
│   ├── retrieval/query.ts            #   truy vấn lexical: buildTsQueryExpr() nối OR (Đ32/G22),
│   │                                 #   to_tsquery + cờ chuẩn hoá 32 (C-05). CẤM plainto_tsquery
│   ├── eval/score.ts                 #   [MỚI] bộ chấm Golden DUY NHẤT, sao y SPEC-P00 §6.5, đủ
│   │                                 #   cả 7 checkpoint (kể cả shows_conflict). eval_golden.mjs
│   │                                 #   và metrics-store.ts đều import từ đây (Đ36/G25)
│   └── adapters/{bql-store,metrics-store}.ts   # [P03/P04] bql-store: nơi DUY NHẤT truy vấn của
│                                     #   Console BQL. metrics-store: đọc answer_turns + score.ts
│                                     #   cho dashboard/eval
├── db/migrations/                    # **ĐÃ CHẠY THẬT trên Supabase 2026-09-21**, theo dõi bằng
│   │                                 #   bảng `schema_migrations` (Đ30)
│   └── 001_enums → 002_users → 003_knowledge → 004_operational → 005_user_property_type
│                                     #   003 có immutable_unaccent — CẤM dùng unaccent() trần
│                                     #   trong cột GENERATED (G18)
│                                     #   005 idempotent: thêm users.property_type (Đ29)
├── tests/                            # node:test — **134 ca** (trước: 82), không cần DB, không cần key
│   ├── conflict-citations.test.ts    #   [MỚI] canh escalateResult() trả citations khi source_conflict
│   ├── conversation-id.test.ts       #   [MỚI] canh conversation_id phải là uuid (Đ37/G26)
│   └── scorer-consensus.test.ts      #   [MỚI] canh eval_golden.mjs và metrics-store.ts cùng verdict
├── knowledge/                        # [MỚI - P00] Knowledge Pack MÔ PHỎNG, 19 tài liệu / 98 section
│   ├── manifest.json                 #   siêu dữ liệu 19 tài liệu
│   ├── sections/<document_id>.json   #   19 file, tên trùng document_id
│   └── README.md                     #   revision: SIM-1.0.0 + lịch sử đổi
├── evals/golden/                     # [MỚI - P00] Bộ đo, KHÔNG nằm trong knowledge/ (SPEC-P00 §2)
│   ├── golden_faq.jsonl              #   50 case (40 answerable) — Metric 1
│   ├── golden_safety.jsonl           #   16 case, phủ đủ 10 mã canonical — Metric 3
│   ├── expected_defects.json         #   hợp đồng máy đọc của 4 khuyết tật (DEF-01..04)
│   └── rubric.md                     #   [MỚI - P04] thang điểm faithfulness/relevance cho màn eval
├── evals/runs/                       # [Đ26] checkpoint các lô đo (`.gitignore`) — TRẠNG THÁI
│                                     #   CHẠY DỞ, KHÔNG phải bằng chứng nghiệm thu
├── scripts/                          # Script kiểm + vận hành, Node thuần
│   ├── _batch.mjs                    #   [Đ26] hạ tầng CHẠY THEO LÔ: checkpoint, --limit/--offset/
│   │                                 #   --only/--resume/--fresh/--delay-ms, phân lập lỗi tầng 1,
│   │                                 #   tự nạp .env.local. Mã thoát 3 = CHƯA KẾT LUẬN ĐƯỢC
│   ├── _pg.mjs                       #   [Đ25] driver `pg` dùng chung cho 5 script vận hành
│   ├── _fixtures.mjs                 #   [P02a] principal demo dùng trong script đo
│   ├── probe_defects.mjs             #   K-M6/G05 — DEF-04 nay ra ĐÚNG reason_code (Đ28); nhãn
│   │                                 #   gate còn chờ chủ tịch. Trên postgres: cạn hạn mức, 1/4
│   ├── eval_golden.mjs               #   M1/M3 — chạy theo lô, chấm bằng lib/eval/score.ts (Đ36);
│   │                                 #   CẤM tick G11 bằng số mock (Đ24), và CẤM tick G11 cho tới
│   │                                 #   khi vá xong Đ37 (conversation_id uuid — G26)
│   ├── embed_cache.mjs               #   --probe đo L2 (0.4356 → 1.0000); đợt 98 chunk CHƯA chạy
│   ├── trace_sample.mjs              #   in 3 khối agent — CHƯA có lượt trọn vẹn qua Gemini thật
│   ├── run_tests.mjs                 #   `npm test -- <chuỗi>` lọc theo tên file (node --test coi
│   │                                 #   tham số là ĐƯỜNG DẪN nên cú pháp cũ luôn lỗi)
│   ├── validate_knowledge.mjs        #   K-M1: documents 19 · sections 98 · defects_ok 4/4
│   ├── validate_golden.mjs           #   K-M2: faq 50 (answerable 40) · safety 16 · canonical 10/10
│   ├── report_facility_rules.mjs     #   K-M4: has_authoritative_rules true 13 · false 1 (FAC-PICKLEBALL)
│   ├── check_adapter_boundary.sh     #   BB-07 — 4 trục, mỗi trục chứng minh đỏ độc lập (Đ21)
│   ├── check_no_hardcoded_knowledge.sh  # BB-10
│   ├── check_no_confidence_ui.sh     #   BB-05
│   ├── migrate.mjs                   #   [Đ30] schema_migrations; --status (chỉ đọc) ·
│   │                                 #   --baseline --to=<file> nhận DB đã migrate sẵn
│   └── sql/dump_schema/seed_users/seed_knowledge.mjs  # ĐÃ CHẠY THẬT (DB có 19 doc / 98 chunk / 2 user)
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
│       ├── plan.md                   # Metadata + Nhật ký quyết định Đ01–Đ41 + Work Packages + checklist
│       ├── specs/                    # 9 file SPEC (3711 dòng): 00-ARCHITECTURE (router riêng),
│       │                             #   01-CONTRACTS, SPEC-P00/P02/P03/P04/P05, OPERATIONS, TESTING-ACCEPTANCE
│       ├── handoffs/                 # bàn giao tự chứa cho worker, gồm H11 (thẩm định D37/D38)
│       ├── reports/                  # R01..R12 — phán quyết nghiệm thu từng gói
│       └── evidence/                 # output máy nguyên văn, CẤM sửa tay (report chỉ trỏ)
│           ├── d28-def04/            #   [2026-09-21] 2 trục đỏ Đ28, trục đỏ G22, migrate 005,
│           │                         #   lượt end-to-end THẬT qua /api/chat trên Postgres
│           └── uuid-conflict/        #   [2026-09-22, MỚI] tsc/tests + lượt Golden ĐẦU TIÊN chạy
│                                     #   thật trên Postgres (safety 11/16, faq blocked hạn mức)
├── .agents/skills/                   # [WORKSPACE SKILLS] Kỹ năng chuyên dụng cục bộ dự án
└── docs/                             # [ĐẶC TẢ CŨ ĐÃ HẠ CẤP] 6 tài liệu v0.2 (sản phẩm khác) + assets/ (3 ảnh tham chiếu)
```
