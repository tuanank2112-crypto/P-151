# Master Data Architecture & Flow

Tài liệu thiết kế về cấu trúc dữ liệu, cơ chế lưu trữ bền vững (Persistence Layer) và luồng luân chuyển dữ liệu đa tầng.

> **Trạng thái 2026-09-22: DB SUPABASE THẬT, NAY ĐANG ĐƯỢC GHI CHỨ KHÔNG CHỈ ĐỌC.**
> DB đã migrate + đã seed (19 documents / 98 sections / 98 chunks / 2 users), migration
> theo dõi bằng bảng `schema_migrations` (Đ30). Ba đường ghi mới đã thi công so với
> mốc trước:
> 1. **Mỗi lượt hỏi–đáp (BB-11)** ghi ĐÚNG MỘT dòng `answer_turns`, kể cả nhánh
>    escalate, nhánh clarify và nhánh ném lỗi; `conversations`/`messages` giữ lịch sử
>    hội thoại bền qua phiên. `conversation_id` của người khác trả HTTP 403.
>    **G26 — `conversation_id` PHẢI là uuid thật** (đang vá, Đ37) — chuỗi tuỳ ý như
>    `"golden-faq-S03"` vỡ ngay ở lệnh ghi đầu tiên (`invalid input syntax for type uuid`).
> 2. **Console BQL (P03)** ghi `documents.status`/`effective_status`/`allowed_for_rag`
>    qua Server Action, và có đường **upload tài liệu mới** + **đổi version** — mỗi
>    thao tác ghi trong ĐÚNG MỘT câu SQL. `lib/adapters/bql-store.ts` là nơi DUY NHẤT
>    truy vấn của gói P03 (giữ BB-07).
> 3. **`users.property_type`** (cột mảng ENUM, Đ29) — driver `pg` trả mảng ENUM về
>    dạng CHUỖI thô, phải chuẩn hoá tại `lib/adapters/db.ts` (G23).
>
> `knowledge/manifest.json` + `knowledge/sections/<document_id>.json` (19 tài liệu /
> 98 section) vẫn là nguồn chân lý của TRI THỨC, DB là bản dẫn xuất — sửa tri thức
> thì sửa file rồi tăng `revision` ở `knowledge/README.md` (hiện `SIM-1.0.0`) và seed
> lại, CẤM sửa thẳng DB. Ngoại lệ: đường upload/đổi version của P03 là ghi trực tiếp
> vào DB qua Console BQL — đó là dữ liệu VẬN HÀNH (tài liệu BQL tự nạp), không phải
> tri thức mô phỏng gốc của P00.
> `DATABASE_URL` hiện trỏ cổng 5432 — PHẢI đổi sang pooler 6543 trước khi deploy
> serverless (Đ25). Nguồn chân lý chi tiết là
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

Luồng tổng quát — retrieval lexical (`ts_rank_cd`) + hai đường ghi (BB-11, P03) ĐÃ THI CÔNG và đo được trên Postgres thật; retrieval hybrid/embedding và P05 vẫn dự kiến theo SPEC:
1. Câu hỏi cư dân → `POST /api/chat` → 9 chặng pipeline, retrieval lexical qua
   `to_tsquery` OR (`buildTsQueryExpr()`, Đ32) → sinh nháp trả lời có trích dẫn
   `document_id`/`section_id`. *(dự kiến: pgvector/hybrid chưa nối dây, chunks chưa
   có embedding nào.)*
2. Agent verify soi từng mệnh đề của nháp có neo vào evidence không → vừa là
   chốt an toàn lúc chạy, vừa sinh điểm faithfulness cho bảng eval (Đ08).
3. Cổng escalate hợp 4 tín hiệu đo được (điểm truy hồi, eligibility, faithfulness,
   cờ mâu thuẫn nguồn — Đ07) → quyết định trả lời hay escalate, kèm lý do
   (không hiện % ra UI).
4. **[THI CÔNG] Mỗi lượt hỏi–đáp ghi một dòng `answer_turns`** (BB-11) kể cả nhánh
   escalate/clarify/lỗi; `conversations`/`messages` giữ lịch sử bền qua phiên; đây
   là mẫu số của dashboard P04 (`lib/adapters/metrics-store.ts`).
5. **[THI CÔNG] BQL đổi `status`/`effective_status`/`allowed_for_rag`, upload tài
   liệu mới, đổi version** qua `lib/adapters/bql-store.ts` (Server Action, mỗi thao
   tác một câu SQL) → ảnh hưởng retrieval ngay trong cùng phiên (R7) — không cần
   rebuild offline. `setSectionExcluded` chưa có UI.
6. **[THI CÔNG] Bộ chấm Golden (`lib/eval/score.ts`)** đọc `answer_turns` +
   `golden_faq.jsonl`/`golden_safety.jsonl` để sinh M1/M3 cho dashboard/eval — nhưng
   CHƯA có số nghiệm thu thật, CẤM tick `G11` (Đ36, chờ vá Đ37).
7. (P05, có điều kiện, CHƯA thi công) Trước một lệnh ghi mô phỏng, đọc điều kiện từ
   dữ liệu chính sách read-only (còn chỗ trống, đủ điều kiện, hạn) rồi mới ghi — cấm
   agent "thử và hỏng" bằng lệnh ghi thật (Đ10).
