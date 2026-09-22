# Resident Agent v1.0

> Đây là demo mô phỏng, KHÔNG dữ liệu cư dân thật, KHÔNG nối API Vinhomes.
> Web app tự đóng luôn vai backend cư dân (Đ02).

## Vấn đề (Problem)

Cư dân khu đô thị hỏi lặp đi lặp lại các câu về nội quy tiện ích (giờ mở cửa,
phí, số người tối đa) qua nhiều kênh (Zalo, lễ tân, hotline), tốn nhân sự BQL
trả lời thủ công và thường trả lời không nhất quán khi nội quy có bản cập nhật
mà một số nơi chưa đổi theo. Cái khó thật của bài toán không phải "trả lời
được", mà là **biết khi nào không được trả lời** — khi nguồn thiếu, mâu thuẫn,
hoặc hết hiệu lực.

## Giải pháp (Solution)

Trợ lý AI có trích dẫn, chạy pipeline 9 chặng qua 3 agent (phân loại → soạn
nháp → kiểm chứng), có 5 lối thoát khác nhau tuỳ loại vấn đề nguồn tri thức
gặp phải, và một console cho Ban quản lý (BQL) upload/đổi tài liệu, duyệt câu
trả lời (HITL), xem bảng eval và dashboard.

Kho tri thức mô phỏng (`knowledge/`, 19 tài liệu · 98 mục) được **cố tình cài
4 khuyết tật** (thiếu nguồn, mâu thuẫn, hết hiệu lực) để chứng minh hệ thống
phát hiện đúng từng loại thay vì bịa câu trả lời trôi chảy. Chi tiết đầy đủ,
số đo thật và sơ đồ kiến trúc: **[`docs/OVERVIEW.md`](docs/OVERVIEW.md)**.

## Target User

- **Primary:** Cư dân khu đô thị — hỏi–đáp có trích dẫn, lịch sử hội thoại bền
  qua phiên đăng nhập.
- **Secondary:** Ban quản lý (BQL) — quản trị tài liệu, duyệt câu trả lời bị
  escalate, theo dõi tỉ lệ tự động giải quyết và điểm eval.

## Tech Stack

| Lớp | Công nghệ |
| :-- | :-- |
| Web app | Next.js 15 (App Router) + TypeScript 5, React 19 |
| Model (3 agent) | Google Gemini — `flash-lite` (A1 phân loại) · `flash` (A2 soạn nháp) · `2.5-flash` (A3 kiểm chứng). Xem `lib/adapters/model.ts`, Đ17 |
| Database | Postgres (Supabase) — `pgvector`, `tsvector`/`ts_rank_cd`, driver `pg`. Xem Đ25 |
| Retrieval | Hybrid (lexical `ts_rank_cd` + vector `gemini-embedding-001` 384 chiều), fallback lexical khi thiếu embedding |
| Adapter boundary | `lib/adapters/db.ts` (Postgres duy nhất) · `lib/adapters/model.ts` (Gemini duy nhất) — canh bằng `scripts/check_adapter_boundary.sh` (BB-07) |
| Test | `node scripts/run_tests.mjs` (bộ test tự viết, không phụ thuộc framework ngoài) |

## Quick Start

Yêu cầu: **Node.js 20+** (môi trường phát triển đo trên Node `v24.12.0`), một
project Postgres (khuyến nghị Supabase — xem Đ25).

```bash
# 1. Cài dependency
npm install

# 2. Cấu hình biến môi trường
cp .env.example .env.local
# Điền DATABASE_URL (connection pooler cổng 6543 — xem chú thích trong .env.example),
# GEMINI_API_KEY, SESSION_SECRET, SEED_RESIDENT_PASSWORD, SEED_BQL_PASSWORD.
# Đặt DATA_BACKEND=postgres (mặc định "mock" chỉ dùng khi chưa có DB).

# 3. Chọn model A2 (xem "Model A2" bên dưới) — tuỳ chọn, có mặc định an toàn
# MODEL_A2=gemini-3.5-flash   # hoặc để trống dùng mặc định trong lib/adapters/model.ts

# 4. Khởi tạo schema và dữ liệu
npm run db:migrate
npm run db:seed:knowledge
npm run db:seed:users

# 5. Chạy dev server
npm run dev
```

Mở `http://localhost:3000/login`. Hai tài khoản demo (mật khẩu lấy từ
`SEED_RESIDENT_PASSWORD`/`SEED_BQL_PASSWORD` đã điền ở bước 2, chỉ có hiệu lực
sau khi chạy `db:seed:users`):

| Vai | Email |
| :-- | :-- |
| Cư dân | `resident@demo.local` |
| BQL | `bql@demo.local` |

### Biến `MODEL_A2`

A2 (soạn nháp, đường nặng nhất của pipeline) không có model Pro khả dụng ở hạn
mức hiện tại (Đ17) — SPEC chọn Flash. Nếu `gemini-3.5-flash` trả `429`/`503`,
chuyển tạm sang `gemini-3.6-flash` bằng biến `MODEL_A2` (xem
`brain4agent/roadmap.md` và commit `b195e54`). **Vùng cấm:** `gemini-3.7-flash`
và `gemini-3.8-flash` (Đ17 — trả 503 "high demand" ngay ở lần gọi đơn lẻ).

## Kiểm chứng (bảng cổng)

| Cổng | Lệnh | Trạng thái đo gần nhất |
| :-- | :-- | :-- |
| Biên dịch | `npx tsc --noEmit` | Xem `docs/OVERVIEW.md` §4 — đo tại từng commit, có thể đỏ tạm thời khi có nhánh việc đang sửa dở song song (kiểm `git log -1` trước khi tin số cũ) |
| Build | `npm run build` | như trên |
| Bộ test | `npm test` (chạy `scripts/run_tests.mjs`) | **172 ca** tại commit `e8aa9f0` (phiên 2026-09-23), xem `docs/OVERVIEW.md` §4 |
| Biên giới adapter | `bash scripts/check_adapter_boundary.sh` | `violations: 0` |
| Không lộ confidence ra UI | `bash scripts/check_no_confidence_ui.sh` | `matches: 0` |
| Không hardcode tri thức | `bash scripts/check_no_hardcoded_knowledge.sh` | `matches: 0` |
| Kho tri thức hợp lệ | `npm run validate:knowledge` | 19 tài liệu · 98 mục · 4/4 khuyết tật đúng chỗ |
| Bộ Golden hợp lệ | `npm run validate:golden` | 50 ca FAQ (40 trả lời được) · 16 ca an toàn · phủ 10/10 mã |

Số đo **không được coi là cố định** — repo đang trong giai đoạn thi công gần
sát deadline demo (`2026-09-27`), nhiều gói việc sửa song song. Nguồn chân lý
số đo là `docs/OVERVIEW.md` §4 (chạy lại trực tiếp) và
`planning/01_2026-09-20_resident-agent-v1/evidence/`, không phải bảng này.

## Cấu trúc thư mục

```
app/
  (resident)/chat/       màn hỏi–đáp cư dân, có trích dẫn
  (bql)/documents/       BQL: upload, đổi version, đổi status tài liệu
  (bql)/review/          BQL: hàng đợi duyệt HITL (Duyệt/Sửa/Từ chối)
  (bql)/dashboard/       BQL: tỉ lệ tự động giải quyết theo intent/lý do
  (bql)/eval/            BQL: bảng eval Golden (faithfulness/relevance)
  api/chat/               cửa HTTP duy nhất của luồng hỏi–đáp
  api/conversations/      lịch sử hội thoại
  api/auth/               đăng nhập/đăng xuất 2 vai
  login/                  đăng nhập
lib/
  pipeline/index.ts       điểm vào DUY NHẤT của 9 chặng (runTurn)
  adapters/db.ts          nơi DUY NHẤT mở connection Postgres
  adapters/model.ts       nơi DUY NHẤT gọi Gemini
  adapters/bql-store.ts   truy vấn của console BQL (documents/review)
  adapters/metrics-store.ts truy vấn dashboard + eval
  eval/score.ts           bộ chấm Golden DUY NHẤT (dùng chung script + dashboard)
knowledge/                19 tài liệu nguồn tri thức · 4 khuyết tật cài sẵn
evals/golden/              bộ dữ liệu Golden (50 FAQ + 16 safety) + rubric
scripts/                  migrate/seed/eval/check — script vận hành + hook AI-log
db/migrations/             DDL Postgres
docs/OVERVIEW.md           TRẠNG THÁI THẬT — đọc trước mọi tài liệu khác trong docs/
docs/architecture_diagram.md  3 sơ đồ Mermaid + bảng thành phần (deliverable BTC)
planning/01_.../plan.md    46 quyết định có mốc thời gian, nguồn chân lý thiết kế
planning/01_.../specs/     Đặc tả chi tiết (kiến trúc, contract, vận hành, test)
JOURNAL.md · WORKLOG.md · eval/results/report.md · presentation/  deliverables BTC
```

## Team

Git author thật trên `main` (= `feature/nhuy`) và các nhánh liên quan:

| Member (git author) | Vai trò | Nhánh phụ trách |
| :-- | :-- | :-- |
| `lenq <tuanank2112@gmail.com>` | [điền] | `feature/nhuy` — sản phẩm (Next.js app, nhánh `main` hiện tại) |
| `TruonghocAI <caotruong1912@gmail.com>` | [điền] | `feature/truong` — PRD/Knowledge Pack, mẫu deliverables BTC |
| *(git author trên `feature/tri`, chưa xác minh)* | [điền] | `feature/tri` — Problem Card |

*(Không bịa tên thật ngoài git author — điền khi có thông tin chính thức.)*

## Trạng thái thật — rubric R1–R10

Nguồn: `planning/01_2026-09-20_resident-agent-v1/specs/00-ARCHITECTURE.md` §2 và
`docs/OVERVIEW.md`. **Đây là số đo, không phải cam kết marketing** — một số gạch
đang 🟡/⛔ tuỳ thời điểm đo do các gói việc đang sửa song song gần deadline.

| # | Gạch rubric | Gói | Bằng chứng khi demo |
| :-- | :-- | :-- | :-- |
| R1 | Web đã deploy | P01 | ⬜ chưa deploy — chờ chọn scope Vercel (`docs/OVERVIEW.md` §6.2) |
| R2 | Đăng nhập 2 vai trò | P01 | Hai tài khoản seed, hai giao diện khác nhau |
| R3 | RAG trả lời có trích dẫn | P02 | Mỗi câu trả lời có chip `document_id · section_id` |
| R4 | Lưu lịch sử hội thoại | P02 | Đăng xuất, đăng nhập lại, hội thoại còn nguyên (BB-11) |
| R5 | Escalate khi confidence thấp | P02 | 4 câu hỏi mẫu ở `specs/00-ARCHITECTURE.md` §7 |
| R6 | Multi-agent 3 con | P02 | Trang trace hiển thị 3 chặng, latency + token từng chặng |
| R7 | BQL upload/cập nhật tài liệu | P03 | Đổi `status` → câu trả lời liên quan đổi hành vi cùng phiên |
| R8 | BQL duyệt câu trả lời (HITL) | P03 | Hàng đợi Duyệt / Sửa / Từ chối |
| R9 | Bảng eval faithfulness & relevance | P04 | `/bql/eval` có số, có nút chạy lại — **M1 2.5%, M3 12.5% tại phiên 2026-09-23, CHƯA ĐẠT ngưỡng** |
| R10 | Dashboard tỉ lệ tự động giải quyết | P04 | `/bql/dashboard`, tách theo intent và reason code |

Đường găng 5 ngày còn lại tới demo, ba việc chỉ người quyết được (nhãn gate
DEF-01/DEF-04, hạn mức Gemini, scope Vercel): xem `docs/OVERVIEW.md` §8.

**P05 (lớp hành động: đặt chỗ, biên nhận, hoàn tác) và P06 (kịch bản demo canonical
trong sản phẩm) CHƯA làm** — P05 là gói duy nhất được thiết kế để cắt khi trễ hạn
(Đ03), không thuộc rubric R1–R10.

## License

MIT — dùng cho mục đích học tập/thi (AI20K Build Phase Cohort 4).
