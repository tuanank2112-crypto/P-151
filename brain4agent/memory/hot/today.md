# 📅 Nhật Ký Làm Việc Ngày 2026-09-21 (Session Memory Log)

> Cập nhật lúc: `2026-09-21T16:30:00.000Z` | Phiên bản: `v1.0.0-p02b-e2e-that`

---

## 🏁 Phiên 2026-09-21 — Nối pipeline vào web; lượt hỏi–đáp end-to-end ĐẦU TIÊN chạy được

### 🎯 Bối cảnh chỉ đạo:
Chủ tịch: *"đọc não và cho tôi biết repo hiện tại đang được bao nhiêu phần trăm hoàn thiện?"* rồi *"tốt, bắt tay làm việc đi"*. Thứ tự tự chọn: vá DEF-04 (đầu việc số 1 của roadmap) → nối pipeline vào web (việc không bị chặn bởi bất cứ thứ gì chờ người).

### 🎯 Đã làm:
- **Vá DEF-04 (Đ28).** Đo ra căn nguyên KHÁC giả thuyết ghi ở Đ26: `G2` vốn đã xét `rejection_histogram` đúng SPEC; chỗ hỏng là `G3` trả cứng `no_eligible_source`. Tín hiệu đúng là `top_rejected_reason` (chunk hạng 1), KHÔNG phải histogram — histogram đếm cả chunk hết hạn xếp hạng thấp ⇒ báo bịa "tài liệu hết hiệu lực" cho câu hỏi không liên quan. Hai trục đỏ độc lập.
- **Phát hiện não ghi SAI hiện trạng:** `DATABASE_URL` ĐÃ có trong `.env.local`, DB Supabase ĐÃ migrate + ĐÃ seed (19 doc / 98 section / 98 chunk / 2 user), trong khi `state.json` vẫn ghi `blocked_needs_human`. Kiểm chứng trước khi tin ghi chép.
- **Nối pipeline vào web (P02b):** `app/api/chat/route.ts` + màn `(resident)/chat` thật + `lib/reason-messages.ts` + CSS. Trước đó 5 màn đều là khung 13–16 dòng, không màn nào gọi được pipeline.
- **Ba lỗi thật lộ ra khi chạy end-to-end, đều đã vá và có test:**
  - `G24/Đ31` — `"điều kiện".includes("kiện")` đẩy câu hỏi thường sang escalate pháp lý ngay chặng 5. Cắn đúng một ca Golden FAQ.
  - `G22/Đ32` — `plainto_tsquery` nối AND ⇒ truy vấn 10 từ của A1 trả **0 dòng** trên DB thật ⇒ mọi câu hỏi thành `no_eligible_source`. **Đổi hợp đồng §4.2, chưa được phê chuẩn.**
  - `G23/Đ29` — `pg` trả mảng ENUM về dạng chuỗi; `users` lại không có cột `property_type` nào ⇒ 19/19 tài liệu bị loại vì `scope_mismatch`.
- **`schema_migrations` (Đ30)** — trả nợ Đ15; baseline `001…004`, áp dụng `005`, exit 0.

### 📊 Số đo cuối phiên:
`tsc` exit 0 · `build` exit 0 · `npm test` **82/82** (trước 53) · BB-05/07/10 = 0 vi phạm · lượt e2e: `decision=answer`, 1 citation, 3/3 claim `supported`, 9 chặng, 3 model khác nhau.

### ⏸ Chưa xong / chờ người:
`expected_gate` DEF-04 chờ chủ tịch · Đ32 chờ phê chuẩn · `DEF-01`/`DEF-02` chưa đo xong trên Postgres (cạn hạn mức Gemini — blocked, KHÔNG phải trượt) · `eval:golden` chưa chạy để lấy `G11` · BB-11 bộ nhớ hội thoại chưa nối · P03/P04 chưa bắt đầu · deploy chờ scope Vercel.

---

## 🏁 Phiên 2026-09-20 (chiều) — Chốt Supabase, đo theo lô, và K-M6 lên 3/4

### 🎯 Bối cảnh chỉ đạo:
Ba câu của chủ tịch, xử theo thứ tự: *"db thì có thể dùng turso mà? nếu không thì tôi hướng bạn qua supabase cũng được"* · *"nếu gemini tier free k đủ tải để test cùng lúc thì chia nhỏ các giai đoạn test ra nhé"* · *"tôi cần sự thống nhất ngay từ ban đầu... 1 là mock 2 là crawl"*.

### 🎯 Đã làm:
- **Đ25 — chốt SUPABASE, BÁC Turso.** Đọc schema thật trước khi trả lời, không trả lời
  theo cảm tính. `003_knowledge.sql` + `query.ts` cần `vector(384)`/`hnsw`,
  `tsvector GENERATED ... STORED`/`gin`/**`ts_rank_cd(..., 32)`**, `text[]`, `jsonb`,
  `gen_random_uuid()` — SQLite không có thứ nào. Cờ `32` là **C-05** có test canh, và
  Đ24 đã ghi `score_lexical`/`S1` không chuyển được từ mock *chính vì mock thiếu đúng
  hàm đó* ⇒ **Turso chỉ là kho mock thứ hai có thêm độ trễ mạng**, đổi 1–2 ngày công để
  nhận con số vẫn không tick được `G11`.
- **Đổi driver `@neondatabase/serverless` → `pg`.** Driver Neon nói chuyện HTTP với
  endpoint riêng của Neon, không dùng được nhà cung cấp khác. `getSql()` giữ **đúng chữ
  ký cũ** `sql(text, params) -> rows` nên không call site nào ở tầng trên phải đổi.
  Thêm `closePool()`; `scripts/_pg.mjs` gom driver cho 5 script vận hành. BB-07 vẫn
  `violations: 0` — script đã cấm `from "pg"` ngoài `lib/adapters/` sẵn từ trước.
  `npm run build` không có `DATABASE_URL`: vẫn exit 0.
- **Bắt được một BUG THẬT trong DDL (G18).** `chunks.tsv GENERATED ALWAYS AS
  (to_tsvector('simple', unaccent(content_vi))) STORED` sẽ **chết** với `ERROR: generation
  expression is not immutable` trên MỌI Postgres — `unaccent()` là STABLE. Nằm trong repo
  từ P01a mà không ai thấy, vì `db/migrations/` là soạn mã chưa chạy nên **không có exit
  code nào phản đối**. Vá bằng `public.immutable_unaccent()`, đồng bộ cả ba chỗ dùng để
  tsvector và tsquery chuẩn hoá bằng **cùng một hàm** (lệch nhau thì `WHERE` lặng lẽ
  không khớp gì).
- **Đ26 — mọi script đo chạy THEO LÔ.** `scripts/_batch.mjs`: checkpoint JSONL
  append-only ở `evals/runs/` (gitignore), cờ
  `--limit/--offset/--only/--resume/--fresh/--delay-ms`, dừng sớm sau 3 lần 429 liên
  tiếp, **mã thoát 3 = CHƯA KẾT LUẬN ĐƯỢC** (khác hẳn 0 đạt và 1 trượt).
- **Đ27 — MỘT nguồn dữ liệu: MÔ PHỎNG, không crawl.** `knowledge/` chứa 4 khuyết tật cài
  sẵn có chủ ý + 66 case Golden neo theo `section_id`; crawl về là mất trắng `K-M6`/`G05`,
  thứ vừa mới đo được. **Nhưng chủ tịch nói đúng một chỗ đang thật sự lẫn** — và nó không
  ở nội dung mà ở **tầng truy hồi**: mock chấm bằng lexical xấp xỉ, Postgres bằng
  `ts_rank_cd`. Lối ra đã có sẵn trong chính Đ24: cho cả hai chấm bằng **cùng một nguồn —
  embedding** (`cosine_sim` chuyển được nguyên). Việc còn phải làm, đã xếp vào roadmap.

### 📈 Số đo, không kể chuyện:
- `tsc --noEmit` exit 0 · `npm test` **53/53 pass, 0 fail, 0 skip** · `npm run build`
  không có `DATABASE_URL` exit 0 · BB-05/BB-07/BB-10 exit 0 · P00 không hồi quy.
- **`K-M6` từ `2/4` lên `3/4`, lặp lại được hai lượt.** Đây là số `SPEC-P00` §9 gọi là
  quan trọng nhất của cả gói P00, treo từ lúc P00 nghiệm thu.
- Bộ đo mới **đã chứng minh ĐỎ theo BỐN TRỤC KHÁC HÌNH DẠNG** (Đ21/G12): bảng phân loại
  lỗi lúc chạy · dữ liệu checkpoint trên đĩa · đối số CLI · hàm chuẩn hoá trong SQL.
  Mỗi trục đỏ đúng nhóm của nó, không đỏ nhóm khác. Bằng chứng: `evidence/so-d25-d27/`.

### ⚠️ Ba lần suýt ghi số GIẢ, đều do hạ tầng bị đếm thành chất lượng (G19):
1. `429` — chính là thứ làm P02a dừng ở `2/4` và không lặp lại được.
2. **Đứt mạng** — `DEF-04` chết vì `TypeError: terminated` (undici) và bị ghi MISMATCH
   oan. Bản đầu của `classifyError` do chính tôi viết xếp nó vào `logic`; phải vá thêm
   nhận diện lỗi socket/mạng. **Vùng cấm đi kèm:** không được gộp cả họ `TypeError` vào
   tầng 1, vì `Cannot read properties of undefined` cũng là `TypeError` — gộp là biến mọi
   bug lập trình thành "hạ tầng, chạy lại sau", đúng XANH GIẢ kiểu G12.
3. **Thiếu biến môi trường** — lượt chủ tịch tự chạy `probe_defects.mjs` mà không có
   `--env-file=.env.local` đã ghi `DEF-01` thành **TRƯỢT** với lý do "GEMINI_API_KEY chưa
   được cấu hình". Vá hai tầng: `loadLocalEnv()` tự nạp `.env.local` (biến từ shell vẫn
   thắng file) và `requireEnv()` chặn **trước** khi chạm checkpoint → exit 2. Đã kiểm cả
   hai chiều: không key thì exit 2 và checkpoint **không đổi một byte**; có key thì chạy
   trọn, không cần cờ nào.

### 🔴 Phát hiện chưa sửa, có chủ ý — `DEF-04` (G20):
Được `escalate`/`no_eligible_source`/`G3_retriever_refused`, muốn
`escalate`/`source_expired_or_unknown`/`G2_zero_eligible`. Đối chiếu `knowledge/`: bản
hiện hành `OCP1-POOL-RULES-001` **không có** section giờ mở cửa; thông tin đó chỉ ở
`POOL24-HOURS-01` thuộc bản 2024 đã `Expired`. Truy hồi kéo thêm các section khác của bản
001 (chúng chứa chữ "bể bơi"), chúng hợp lệ ⇒ `eligible` không rỗng ⇒ không vào `G2`; A2
đọc thấy không có giờ mở cửa ⇒ từ chối ⇒ `G3`. **Kỳ vọng SPEC ĐÚNG, pipeline SAI** —
tầng escalate không xét `rejection_histogram` nên không phân biệt được "không có nguồn"
với "nguồn duy nhất trả lời được câu này đã hết hiệu lực". Với rubric thì đúng chỗ phân
biệt đó mới là phần đáng điểm. **KHÔNG tự sửa:** chạm Đ07 + `SPEC-P02` §4/§6 ⇒ tầng 🔴,
và thuộc gói P02a chưa nghiệm thu. Đã xếp làm đầu việc đầu tiên của nghiệm thu.

### ⏳ Đang chờ người:
- **`DATABASE_URL` Supabase** — mọi thứ phía mã đã sẵn sàng; chỉ cần chuỗi **pooler cổng
  6543** dán vào `.env.local`. Có nó thì `db:migrate` sẽ nói được G18 vá đúng hay chưa.
- **Scope Vercel** (Đ23) — CLI đã đăng nhập, chỉ chờ chọn.
- Câu hỏi treo từ Đ17 vẫn treo: A2 mất bậc Pro. Nếu Golden ra `M1 < 34/40` thì nạp tiền
  Google Cloud hay chấp nhận điểm thấp?

### 📌 Nợ đồng bộ đã trả:
`index.md` **đã cập nhật bản đồ `lib/`** (nợ ghi từ phiên đêm) — thêm `lib/pipeline/`,
`confidence.ts`, `adapters/{model,store-mock}.ts`, 6 script đo, `evals/runs/`, và bỏ
`adapters/anthropic.ts` đã xoá. `project-intro.md` + `-data-architecture.md` đã rà theo
§5.B.2 vì Đ25 đổi tầng lưu trữ (hai file này ngoài Ma Trận 6 Điểm nên dễ nói sai repo lâu
dài mà mọi cổng tự động vẫn xanh).

---
