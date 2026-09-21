# Master Data Architecture & Flow

Tài liệu thiết kế về cấu trúc dữ liệu, cơ chế lưu trữ bền vững (Persistence Layer) và luồng luân chuyển dữ liệu đa tầng.

> **Trạng thái 2026-09-20: TẦNG DB CHƯA THI CÔNG, TẦNG FILE ĐÃ CÓ.**
> Chưa có bảng, migration hay kết nối Postgres nào tồn tại thật (nhà cung cấp đã
> chốt là **Supabase**, Đ25 — chưa có `DATABASE_URL`). **Nhưng dữ liệu nguồn
> đã nằm trên đĩa dưới dạng file** sau gói P00:
> `knowledge/manifest.json` + `knowledge/sections/<document_id>.json` (19 tài liệu /
> 98 section) là nguồn sẽ được `scripts/seed_knowledge.mjs` (gói P01) nạp vào bảng
> `documents`/`sections`/`chunks`; `evals/golden/expected_defects.json` là hợp đồng
> máy đọc để kiểm 4 khuyết tật sau khi seed. Nghĩa là **file trên đĩa đang là nguồn
> chân lý của tri thức, DB sẽ là bản dẫn xuất** — sửa tri thức thì sửa file rồi tăng
> `revision` ở `knowledge/README.md` (hiện `SIM-1.0.0`) và seed lại, CẤM sửa thẳng DB.
> Nguồn chân lý chi tiết là
> `planning/01_2026-09-20_resident-agent-v1/specs/01-CONTRACTS.md` (DDL, schema,
> enum reason code) — file này chỉ tóm tắt điều hướng, không thay thế nó.

## 1. Các Tầng Lưu Trữ (Data Persistence Stores) — dự kiến

- **Postgres + pgvector trên Supabase** (Đ11 + **Đ25**, `plan.md` §2): MỘT kho chung cho:
  - **RAG:** bảng tài liệu tri thức (Knowledge Pack mô phỏng, xem SPEC-P00) +
    embeddings pgvector cho retrieval.
  - **State ứng dụng:** user 2 vai trò, lịch sử hội thoại (bền qua phiên — R4),
    log 3 chặng agent (latency, token — R6), hàng đợi duyệt câu trả lời (P03/HITL).
  - **Sổ biên nhận (P05, nếu còn trong scope sau cổng Đ03):** ghi lại thao tác ghi
    mô phỏng (đặt chỗ, huỷ...) kèm khả năng hoàn tác — theo Đ10, chính sách phải
    đọc được (read-only) *trước* khi gọi lệnh ghi.
- **Kho mock (Đ24), đang là kho đang chạy:** `DATA_BACKEND=mock` đọc thẳng
  `knowledge/` + `evals/golden/` qua `lib/adapters/store-mock.ts`. Nó **không phải
  một cơ sở dữ liệu thứ hai**, chỉ là bộ đọc file nằm sau đúng interface `DataStore`
  mà `db.ts` phơi ra. Đổi sang Postgres là đổi một biến môi trường.
  **VÙNG CẤM (Đ24):** `score_lexical` và `S1` từ mock **KHÔNG chuyển được** sang
  Postgres vì mock không có `ts_rank_cd(..., 32)` ⇒ cấm tick `G11` bằng số mock.
  Riêng `cosine_sim` từ embedding Gemini thì chuyển được nguyên.
- **MỘT nguồn dữ liệu duy nhất: MÔ PHỎNG (Đ27).** Cấm đưa nguồn thứ hai (crawl, API
  ngoài, dataset tải về) vào `knowledge/`. Lý do: `knowledge/` chứa **4 khuyết tật
  cài sẵn có chủ ý** (DEF-01..04) và 66 case Golden neo theo `section_id` — đổi nguồn
  là mất trắng bộ đo `K-M6`/`G05`.
- **Không có** kho dữ liệu cư dân thật, không gọi API Vinhomes (Đ02) — mọi "ghi"
  là mô phỏng nội bộ trong Postgres của chính app.
- **Bẫy DDL đã vá (G18):** `chunks.tsv` phải sinh bằng `public.immutable_unaccent()`,
  KHÔNG phải `unaccent()` trần — `unaccent` là STABLE nên cột `GENERATED ... STORED`
  bị Postgres từ chối. Hàm chuẩn hoá lúc sinh `tsv` và lúc `plainto_tsquery` phải
  TRÙNG nhau, lệch là `WHERE` lặng lẽ không khớp gì.

## 2. Schema & Data Flow

Chi tiết DDL, contract 3 agent, enum reason code (10 mã canonical + nhóm hành
động theo Đ12) nằm trong `specs/01-CONTRACTS.md` — **đọc file đó trước khi viết
bất kỳ type/DDL/API nào** (bắt buộc theo router `specs/00-ARCHITECTURE.md` §1).

Luồng tổng quát (chưa thi công, mô tả dự kiến theo SPEC):
1. Câu hỏi cư dân → agent retrieval/answer truy hồi từ pgvector → sinh nháp trả
   lời có trích dẫn `document_id`/`section_id`.
2. Agent verify soi từng mệnh đề của nháp có neo vào evidence không → vừa là
   chốt an toàn lúc chạy, vừa sinh điểm faithfulness cho bảng eval (Đ08).
3. Cổng escalate hợp 4 tín hiệu đo được (điểm truy hồi, eligibility, faithfulness,
   cờ mâu thuẫn nguồn — Đ07) → quyết định trả lời hay escalate, kèm lý do
   (không hiện % ra UI).
4. BQL đổi `status`/version tài liệu → ảnh hưởng retrieval ngay trong cùng phiên
   (R7) — không cần rebuild offline.
5. (P05, có điều kiện) Trước một lệnh ghi mô phỏng, đọc điều kiện từ dữ liệu
   chính sách read-only (còn chỗ trống, đủ điều kiện, hạn) rồi mới ghi — cấm
   agent "thử và hỏng" bằng lệnh ghi thật (Đ10).
