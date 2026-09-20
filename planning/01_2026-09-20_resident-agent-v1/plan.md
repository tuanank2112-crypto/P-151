# Kế hoạch 01 — Resident Agent v1.0 (demo mô phỏng cho ban giám khảo)

> Hồ sơ kế hoạch. **KHÔNG chứa thiết kế chi tiết** — thiết kế nằm ở `specs/` (bảng Mục 5).

## 1. Metadata Header

| Trường | Giá trị |
| :-- | :-- |
| Mã hồ sơ | `01_2026-09-20_resident-agent-v1` |
| Ngày mở | 2026-09-20 |
| Chủ trì | Super Orchestrator (cửa sổ này) |
| Trạng thái | 🟢 ĐANG THI CÔNG — P00 phóng 2026-09-20 |
| Deadline | **2026-09-27** (7 ngày) |
| Nguồn yêu cầu | AI20K Build Phase Cohort 4 — ngân hàng đề `C104 / VHR-01 / G104` |
| Mục đích | Sản phẩm demo cho doanh nghiệp + ban giám khảo. Không phải hệ thống chạy thật. |
| SemVer dự kiến | `1.0.0` (MAJOR — dựng mới, chưa có mã nguồn) |
| Đặc tả kế thừa | `docs/PRD_ResidentGPT_MVP.md` và 5 tài liệu v0.2 khác — hạ cấp thành **nguồn đặc tả cho lõi trả lời**, không còn là định nghĩa sản phẩm |

## 2. Nhật ký quyết định

Mỗi mục: quyết định · lý do · **chỗ có thể lật + chi phí lật**.

### Đ01 — 2026-09-20 · Mục tiêu là rubric, không phải v0.2

Đầu ra được chấm là rubric `C104/VHR-01`: web deploy, 2 vai trò, RAG có trích dẫn + memory + escalate, multi-agent 3 con, BQL upload tài liệu + duyệt câu trả lời, bảng eval faithfulness/relevance, dashboard tỉ lệ tự động giải quyết. Bộ v0.2 mô tả một sản phẩm khác (công cụ soạn nháp cho BQL) và tự cấm đúng thứ đề bài cần ở tầng nâng cao.

**Lật được:** nếu rubric được diễn giải khác. **Chi phí lật:** cao sau D3 — cấu trúc 3 agent và schema log bám theo rubric.

### Đ02 — 2026-09-20 · Mô phỏng toàn phần

Không API Vinhomes, không dữ liệu cư dân thật. Web app tự viết **đóng luôn vai backend cư dân**. Hệ quả: mọi ràng buộc PII và điều khoản dịch vụ của v0.2 không còn hiệu lực ràng buộc; 3 ảnh trong `docs/assets/` là tư liệu tham chiếu để dựng giao diện và danh mục tiện ích, không phải hợp đồng phải đi xin.

**Lật được:** khi có API thật. **Chi phí lật:** thấp nếu mọi lệnh đi qua lớp adapter của P01; cao nếu gọi thẳng.

### Đ03 — 2026-09-20 · Hai tầng mục tiêu, khoá sau cổng

Tầng 1 = rubric (P01–P04), bắt buộc. Tầng 2 = lớp hành động (P05), là điểm khác biệt khi demo. **P01–P04 chưa xanh thì CẤM chạm P05.** P05 là gói duy nhất được cắt khi trễ, và cắt nó không đụng dòng nào của rubric.

**Lật được:** không. Đây là hàng rào chống trễ hạn.

### Đ04 — 2026-09-20 · Knowledge Pack và Golden phải dựng — ĐƯỜNG GĂNG

Xác nhận của chủ tịch 2026-09-20. Knowledge Pack `1.18` (21 tài liệu `OCP1-*`) và Golden `0.1` (50 FAQ / 30 E2E) mà v0.2 mô tả **không tồn tại** — chỉ có đặc tả mô tả chúng. Không có tri thức thì P02 và P04 đều đứng.

**Lật được:** nếu tìm thấy bộ nội quy có sẵn. **Chi phí lật:** âm (rút ngắn lịch).

### Đ05 — 2026-09-20 · Cố tình cài khuyết tật vào Knowledge Pack

Dựng kèm **2 khoảng trống có chủ ý + 1 cặp tài liệu mâu thuẫn + 1 tài liệu hết hiệu lực**. Lý do: hành vi từ chối đúng lúc là thứ khó chứng minh nhất và thuyết phục nhất khi demo. Không có khuyết tật cài sẵn thì `no_eligible_source`, `source_conflict`, `source_expired_or_unknown` không bao giờ được kích hoạt để cho xem.

**Lật được:** có. **Chi phí lật:** thấp — gỡ khuyết tật là xoá vài file.

### Đ06 — 2026-09-20 · Đảo nội hàm `pii_or_account_specific`

v0.2 định nghĩa mã này là "chạm dữ liệu account/cá nhân thì chặn", vì actor cũ là bên thứ ba chưa xác thực danh tính. Bê nguyên sang agent phục vụ chính chủ thì **agent tự chặn ca dùng của chính nó**. Ranh giới dời từ *loại dữ liệu* sang *chủ sở hữu dữ liệu*: chặn khi chạm **dữ liệu người khác**. Mức nghiêm giữ nguyên.

**Lật được:** không nên. Giữ định nghĩa cũ là mâu thuẫn logic, không phải lựa chọn an toàn hơn.

### Đ07 — 2026-09-20 · Confidence là hợp của 4 tín hiệu đo được

Rubric đòi "escalate khi confidence thấp"; v0.2 cấm "fake confidence percentage". Giải: confidence ghép từ điểm truy hồi top-k, kết quả cổng eligibility, điểm faithfulness của agent kiểm chứng, và cờ phát hiện mâu thuẫn nguồn. Ngưỡng dùng nội bộ để escalate; **màn hình hiển thị lý do, không hiển thị phần trăm**.

**Lật được:** ngưỡng thì có, hiển thị phần trăm thì không.

### Đ08 — 2026-09-20 · Agent kiểm chứng vừa là chốt chặn vừa là thước đo

Con agent thứ ba soi từng mệnh đề của bản nháp có neo vào evidence không. Cùng một cơ chế sinh ra cả hành vi an toàn lúc chạy lẫn cột faithfulness trong bảng eval. Đỡ được một hệ thống chấm riêng, và số trên dashboard khớp hành vi thật của sản phẩm.

**Lật được:** có, nếu cần thước đo độc lập với hệ thống đang bị chấm. **Chi phí lật:** trung bình.

### Đ09 — 2026-09-20 · Bất biến: thao tác được không có nghĩa là được phép giải thích luật

Quyền gọi một lệnh ghi không kéo theo quyền phát biểu về nội quy. Mọi phát biểu vẫn phải đi đường RAG có trích dẫn. Chống một kiểu hallucination khó bắt: suy từ một ràng buộc vận hành có thật ra một quy định không hề được nêu.

**Lật được:** không.

### Đ10 — 2026-09-20 · Chính sách là dữ liệu đọc được trước khi hành động

Backend mô phỏng phải lộ điều kiện của một thao tác dưới dạng dữ liệu đọc-thuần, gọi được **trước** lệnh ghi (còn chỗ trống không, có đủ điều kiện không, hạn huỷ tới khi nào). Lý do: agent không được học luật bằng cách thử và hỏng — mỗi lần thử là một lệnh ghi thật.

**Lật được:** có, nếu P05 bị cắt. **Chi phí lật:** thấp.

### Đ11 — 2026-09-20 · Stack và thời điểm deploy

Next.js + TypeScript trên Vercel · Postgres + pgvector trên Neon (RAG, state, sổ biên nhận chung một kho) · auth credential 2 vai trò · Claude cho 3 agent. **Deploy ở D2, không để cuối** — "web đã deploy" là gạch đầu dòng đầu tiên của rubric, phải xanh sớm rồi bồi lên.

**Lật được:** có, tại lớp adapter P01. **Chi phí lật:** thấp trước D3, cao sau.

### Đ12 — 2026-09-20 · Enum reason code: giữ 10, thêm nhóm hành động

Giữ nguyên 10 mã canonical của v0.2. Bổ sung nhóm hành động: vượt hạn mức, bất khả hoàn tác, thực thi một phần, thiếu uỷ quyền, trùng lặp. Không tạo alias cho mã cũ.

**Lật được:** thêm mã thì có, đổi nghĩa mã cũ thì không (trừ Đ06 đã nêu).

### Quyết định bị thay thế

- **2026-09-20 — "Lật actor sang cư dân, agent tự chủ thanh toán hoá đơn và đặt chỗ"** → thay bởi **Đ01 + Đ03**. Lý do: suy ra từ 3 ảnh và 6 tài liệu trước khi biết rubric. Rubric đòi **cả hai vai** (Cư dân *và* BQL) và không có dòng nào về thanh toán. Giữ hướng cũ sẽ đốt deadline vào thứ không được chấm.
- **2026-09-20 — "Cần chủ tịch quyết trần thanh toán và rủi ro điều khoản dịch vụ"** → **rút lại**, không còn đối tượng. Đ02 làm hai câu hỏi này mất căn cứ: không có tiền thật, không có API thật.
- **2026-09-20 — "Lấy modal từ chối đăng ký ngoài giờ làm cảnh demo trung tâm, kèm ý định bền và bộ lập lịch"** → **rút lại** theo chỉ đạo của chủ tịch: ảnh đó chỉ là ví dụ minh hoạ. Hệ quả: P05 bỏ hẳn phần lập lịch và ý định sống qua phiên, chỉ giữ đọc-chính-sách-trước-khi-ghi (Đ10). Tiết kiệm khoảng một ngày công và bỏ được một hạ tầng khó (scheduler bền qua restart).

### Đ13 — 2026-09-20 · Nhà cung cấp model — đo trước, chưa đổi contract

> **⚠ ĐÃ BỊ THAY THẾ bởi Đ17 (cùng ngày).** Giữ nguyên văn làm lịch sử: đây là lý do ta KHÔNG chọn TokenRouter/Union Alpha. Kết luận đo ở đây vẫn đúng, chỉ là nhà cung cấp cuối cùng đã khác.

Chủ tịch chỉ định `stealth/union-alpha` qua TokenRouter, kèm key `sk-LaNk…`. **Đã đo, không dùng được như chỉ định:**

| # | Phép đo | Kết quả nguyên văn |
| :-- | :-- | :-- |
| M-01 | `GET https://api.tokenrouter.io/v1/models` + key | `http=401` · `{"error":{"message":"Missing or malformed API key. Pass 'Authorization: Bearer tr_...'"}}` |
| M-02 | `docs.tokenrouter.io/getting-started/openai-compatibility` | Chỉ hỗ trợ `POST /v1/chat/completions`. **Không có endpoint embeddings.** |
| M-03 | Quy ước tên model của TokenRouter | `auto:*`, `openai:`, `anthropic:`, `gemini:`, `mistral:`, `deepseek:` — **không có dạng `stealth/…`** |
| M-04 | Tra `stealth/union-alpha` | Slug của **OpenRouter** (và Cloudflare), ra mắt 2026-09-16, free preview 256K ctx, có tool calling |
| M-05 | `POST https://openrouter.ai/api/v1/chat/completions` + key | **KHÔNG ĐO ĐƯỢC** — sandbox chặn (data-exfiltration classifier). Cần người chạy. |

Kết luận: key `sk-…` không phải key TokenRouter (phải là `tr_…`), và `stealth/union-alpha` không phải model TokenRouter. Hai thứ này thuộc hai nơi khác nhau. **Chưa đổi `01-CONTRACTS.md` §8 và `00-ARCHITECTURE.md` §10.1** — contract vẫn là Claude cho A1/A2/A3 cho tới khi có một key chạy được đo tận tay.

**Rủi ro nếu chọn Union Alpha làm chính:** là model ẩn danh, free *preview có hạn* công bố ngày 2026-09-16; nhà phát hành nói free "trong một tuần" — hạn đó rơi đúng vào tuần demo (deadline 2026-09-27). Một bài demo bị chấm không nên đặt đường găng lên một model có thể bị rút không báo trước. **Lật được:** dùng làm dự phòng rẻ thì tốt. **Chi phí lật:** thấp, vì `lib/adapters/anthropic.ts` (BB-07) đã là adapter DUY NHẤT — thêm một adapter OpenAI-compatible cạnh nó không đụng lõi.

### Đ14 — 2026-09-20 · Câu hỏi "key embedding" của C-01 đã hết đối tượng

> **⚠ ĐÃ BỊ THAY THẾ bởi Đ18 (cùng ngày).** Lúc viết Đ14 chưa có key Gemini nên kết luận "không cần endpoint embedding" là đúng với dữ kiện khi đó. Nay có key và đo được 384 chiều ⇒ đường tốt hơn, xem Đ18.

`01-CONTRACTS.md` §4.3 đã chốt từ lúc thiết kế: embedding chạy **`Xenova/multilingual-e5-small` ngay trên máy dev** trong `scripts/seed_knowledge.mjs`, 384 chiều, ghi sẵn vào DB — **không cần key, không gọi API ai cả**. Trên Vercel `RETRIEVAL_MODE=lexical`. Vậy mục "xin thêm một key embedding" trong C-01 là thừa; nó được nêu khi SO chưa đọc kỹ §4.3. **Rút lại.**

Nếu sau này muốn `hybrid` chạy cả trên Vercel thì mới cần một endpoint embedding thật (Gemini có, Claude và TokenRouter không) — nhưng khi đó phải **re-embed toàn corpus** vì số chiều khác 384, tức sửa DDL `vector(384)` ở §3.3. Không làm trong vòng 1.0.0.

### Đ15 — 2026-09-20 · `db:migrate:down` hoãn tới khi có DB, không ship rollback chưa từng chạy

`OPERATIONS.md` §8 hứa một đường lùi cho migration hỏng: `npm run db:migrate:down -- --to=<version>`, dưới 2 phút. Gói P01a không có `DATABASE_URL` nên **không thể kiểm chứng** đường lùi đó, và spec cũng chưa đặc tả bảng lịch sử migration để biết đang ở version nào.

Worker viết `scripts/migrate.mjs --down` in cảnh báo rồi **exit 2** thay vì giả vờ chạy được. **SO chấp nhận.** Một rollback chưa từng chạy thật còn nguy hiểm hơn một script nói thẳng là chưa có: nó chỉ hỏng đúng lúc người ta cần nó nhất.

**Hệ quả phải nhớ:** dòng "Migration hỏng" trong bảng `OPERATIONS.md` §8 **CHƯA được thoả mãn**. Việc phải làm khi có `DATABASE_URL`: thêm bảng `schema_migrations` vào `db/migrations/001_enums.sql`, cài `--down`, rồi **chứng minh bằng một lần chạy thật** (migrate lên, down về, `dump_schema.mjs` khớp trạng thái trước).

**Lật được:** không. Đây là điều kiện để bảng §8 nói thật. **Chi phí lật:** thấp nếu làm cùng lúc với bước 2–4 của `OPERATIONS.md` §4; cao nếu để tới ngày demo.

### Đ16 — 2026-09-20 · `.gitignore` phải chừa `.env.example`

Pattern `.env*` nuốt luôn file mẫu biến môi trường, nên `.env.example` (bảng `OPERATIONS.md` §3) không bao giờ commit được — người clone repo sẽ không biết cần biến gì. Thêm `!.env.example` và `*.tsbuildinfo`. Kiểm: `git add --dry-run .env.example` phải in `add '.env.example'`, còn `.env.local` vẫn phải bị chặn.

### Đ17 — 2026-09-20 · Nhà cung cấp model: chuyển sang Gemini, A2 mất model mạnh

Chủ tịch cấp key Gemini và chỉ đạo dùng nó. **Đã đo thật trước khi chốt** — bằng chứng nguyên văn: [`evidence/p02-provider/gemini-probe.txt`](../evidence/p02-provider/gemini-probe.txt).

Lưu ý về chính key: chuỗi có dạng `AQ.<phan con lai da luoc>…` (53 ký tự), **không phải** dạng `AIzaSy…` quen thuộc. SO ban đầu kết luận nhầm là token phiên OAuth; đo lại thì `GET /v1beta/models?key=…` trả **HTTP 200**. Google có định dạng key mới. Ghi ra đây để không ai loại nhầm một key hợp lệ lần nữa.

| Vai | SPEC cũ | Nay | Số đo làm căn cứ |
| :-- | :-- | :-- | :-- |
| A1 `classifier` | `claude-haiku-4-5` | `gemini-3.5-flash-lite` | 1415ms; 15/15 qua ở burst 15 — ổn định nhất |
| A2 `retriever` | `claude-opus-5` | `gemini-3.5-flash` | HTTP 200, 1M ctx |
| A3 `verifier` | `claude-sonnet-5` | `gemini-2.5-flash` | 2009ms, sạch ngay lần đầu; khác thế hệ A2 nên vẫn là hai lời gọi tách bạch (VC-02/BB-06) |
| Embedding | `Xenova/multilingual-e5-small` tại chỗ | `gemini-embedding-001`, `outputDimensionality: 384` | trả đúng 384 chiều |

**Rủi ro phải nói thẳng:** **không có model Pro nào dùng được.** `gemini-2.5-pro`, `gemini-3.1-pro-preview`, `gemini-pro-latest` đều trả **HTTP 429 "exceeded your current quota, check your plan and billing"** — toàn bộ bậc Pro nằm sau cổng thanh toán. SPEC cũ giao A2 cho model **mạnh nhất** vì đó là việc nặng nhất (truy hồi + soạn nháp có trích dẫn). Nay A2 phải chạy bậc Flash. Đây là **hạ cấp chất lượng có chủ ý, đánh thẳng vào `faithfulness`** — đúng con số rubric chấm. Ghi ra để không ai tưởng là tương đương.

**Vùng cấm mới:** CẤM `gemini-3.7-flash` và `gemini-3.8-flash`. Chúng trả **503 "high demand" ngay ở lần gọi đơn lẻ** (3.7 cần 2 lần thử, 3.8 cần 3 lần). Không đặt đường găng của một bài bị chấm lên model đang quá tải.

**Lật được:** nạp tiền vào project Google Cloud ⇒ A2 lên Pro ngay, chỉ đổi một chuỗi ID. **Chi phí lật:** rất thấp — đó là lý do giữ ranh giới adapter một file (BB-07).

### Đ18 — 2026-09-20 · Đ14 bị thay thế: embedding nay chạy được trên Vercel

Đ14 nói embedding chạy `Xenova/multilingual-e5-small` tại chỗ lúc seed, và chấp nhận `RETRIEVAL_MODE=lexical` trên Vercel. **Đo lại thì có đường tốt hơn hẳn:** `gemini-embedding-001` nhận tham số `outputDimensionality` và trả **đúng 384 chiều** — khớp nguyên `vector(384)` ở `01-CONTRACTS.md` §3.3.

Ba cái lợi cùng lúc, không mất gì:
1. **Không phải đổi schema.** 384 vẫn là 384. (Mặc định model trả 3072 chiều — số đó vô dụng với ta vì pgvector chỉ đánh chỉ mục HNSW tới 2000 chiều.)
2. **Bỏ được `@xenova/transformers`** — một dependency nặng phải tải model về máy.
3. **`hybrid` chạy được TRÊN VERCEL**, vì query embedding nay chỉ là một lời gọi HTTP. Trước đây phải ép `lexical` vì serverless không tải nổi model.

⇒ **Vùng cấm `OP-C8`** ("CẤM đổi `RETRIEVAL_MODE` trên Vercel sang `hybrid` vì không có embedding trên đó") **mất căn cứ, gỡ bỏ.**

Đây chính là "mắt xích yếu nhất của một bài demo RAG" mà C-01 nêu và Đ14 đành chấp nhận — nay gỡ được thật, bằng đo chứ không bằng suy đoán.

**Lật được:** nếu hạn mức embedding thành nút thắt. **Chi phí lật:** thấp — quay về lexical là đổi một biến môi trường, và §4.1 đã quy định embedding `NULL` thì tự rơi về lexical chứ không ném lỗi.

### Đ19 — 2026-09-20 · Hạn mức là ràng buộc thiết kế, không phải chi tiết vận hành

Đo trần thật: **15 request song song qua hết** (15/15, 2543ms). **40 song song thì 39 cái dính HTTP 429.** `gemini-3.6-flash` ở 20 song song chỉ qua 4/20, lẫn cả 429 lẫn 503.

Một lượt Golden đầy đủ = 66 case × 3 agent = **198 lời gọi**. Bắn ồ ạt là chết ngay.

**BẮT BUỘC:** bộ chạy Golden giới hạn song song **3–5**, có backoff cho **cả 429 lẫn 503** (SPEC cũ chỉ tính 429/5xx chung ở E2). Ước lượng một lượt đầy đủ **13–15 phút**. Khớp khuyến cáo `OPERATIONS.md` §9: chạy đầy đủ 1–2 lần/ngày, sửa nhỏ thì `--set=safety` (16 case).

Bối cảnh: `OPERATIONS.md` §9 ghi **lượt phóng trước của dự án này chết vì hết hạn mức model.** Nay đã có số đo thật thay cho lời cảnh báo suông.

### Đ20 — 2026-09-20 · Hai phép đo còn nợ đã đóng, và một số làm đổi luật

Architect gói R04 bị cấm gọi API (sợ đốt hạn mức chung) nên để ngỏ hai phép đo. SO đo tay. Bằng chứng: [`evidence/p02-provider/so-cm9-cm11.txt`](../evidence/p02-provider/so-cm9-cm11.txt).

**C-M11 — `responseSchema`: ĐƯỢC CHẤP NHẬN, hết nợ.** Cả ba model đã chọn đều trả HTTP 200, JSON parse được, đủ trường bắt buộc, và **tôn trọng `enum`**. Nghĩa là hợp đồng 3 agent dùng `generationConfig.responseSchema` chạy được như đặc tả, không phải dựng lớp vá JSON bằng regex (vốn bị cấm ở E7).

**C-M9 — vector ép chiều CHƯA chuẩn hoá. Đây là số đổi luật.**

| `outputDimensionality` | `\|v\|` đo được |
| :-- | --: |
| 3072 (mặc định) | **1.000000** |
| 768 | **0.594145** |
| **384** (ta dùng) | **0.434527** |

Gemini chỉ chuẩn hoá ở **số chiều đầy đủ**. Ép chiều trả về một **lát cắt**, nên độ dài không còn bằng 1 — ở 384 chiều chỉ còn 0.4345.

Architect viết luật "BẮT BUỘC chuẩn hoá L2 trong adapter, cho cả seed lẫn query" khi **chưa đo**, và tự ghi rõ là chưa đo, chọn vế an toàn. Số này xác nhận architect chọn đúng: luật đó **không phải phòng xa, là bắt buộc thật**.

Hậu quả nếu bỏ sót: `cosine_sim` mất miền `(0,1)` mà công thức `S1` giả định ⇒ ngưỡng confidence và cổng escalate lệch **âm thầm**. Không crash, không test nào đỏ, chỉ ra điểm sai. Loại hỏng tệ nhất trong cả hồ sơ này.

### Đ21 — 2026-09-20 · `check_adapter_boundary.sh` từng XANH GIẢ; phép phá phải khác HÌNH DẠNG

Khi nghiệm thu P01a, SO kết luận *"BB-07 đã chứng minh bắt được vi phạm thật"*. **Kết luận đó sai.** Architect R04 phản biện, SO kiểm lại và xác nhận architect đúng:

```text
lib/so_leak_probe.ts   (NGOÀI lib/adapters/)
  const HOST = "https://generativelanguage.googleapis.com/v1beta";
  const KEY  = process.env.GEMINI_API_KEY;
  fetch(`${HOST}/models/${m}:generateContent?key=${KEY}`)

$ bash scripts/check_adapter_boundary.sh
violations: 0 · EXIT=0      <-- rò cả host lẫn khoá mà không báo gì
```

Nguyên nhân: bản cũ chỉ bắt `fetch("https://…")` dạng **chuỗi nguyên văn**, và **không hề canh** việc đọc `process.env.*` ngoài adapter.

**Nguyên nhân gốc nằm ở phép phá, không nằm ở script.** Bốn phép phá SO tự thiết kế lúc nghiệm thu P01a đều **cùng một hình dạng** — rò bằng import tên gói. Chúng chỉ chứng minh được đúng một trục, nhưng SO đọc thành "bất biến đã được canh".

**Luật bổ sung cho Luật K.5:** bộ đo mới phải từng đỏ, **và các phép phá phải khác nhau về HÌNH DẠNG, không chỉ khác về nội dung**. Bốn lần rò bằng `import X from "pkg"` chỉ là một phép thử lặp lại bốn lần.

Script đã viết lại theo **bốn trục** (import SDK · host ở bất kỳ dạng chuỗi nào · đọc bí mật · `fetch` URL tuyệt đối kể cả template), mỗi trục đã chứng minh đỏ **độc lập**, cây sạch xanh.

**P01a giữ nguyên ✅ DUYỆT** — bất biến *cấu trúc thư mục* không đổi, chỉ mẫu grep cũ là thiếu. Đính chính ghi ở cuối `reports/R03`.

### Đ22 — 2026-09-20 · Vyce đã đo: KHÔNG dùng. Giữ Gemini.

Chủ tịch cấp key Vyce làm đường nâng cấp cho A2 (Đ17 ghi A2 mất bậc Pro). SO đo trước khi đổi. Bằng chứng: [`evidence/p02-provider/vyce-probe.txt`](../evidence/p02-provider/vyce-probe.txt).

Base URL đúng là `https://vyceai.com/v1`. Key chạy. Có `claude-sonnet-4-6` (270K ctx), đúng hạng model A2 đang thiếu. **Nhưng thua Gemini ở cả ba thứ quyết định:**

| | Gemini (đang dùng) | Vyce |
| :-- | :-- | :-- |
| Schema chặt | `responseSchema` **chạy**, tôn trọng enum | `json_schema` **bị bỏ qua âm thầm** — HTTP 200 kèm văn xuôi |
| Song song (gói free) | **15** | **4** (thông điệp lỗi nói thẳng) |
| Embedding | có, ép được 384 chiều | **không có** |

**Điểm chí mạng là dòng đầu.** Vyce nhận `response_format.json_schema` rồi không áp dụng và **không báo lỗi**. Đó đúng là kiểu hỏng mà `00-ARCHITECTURE.md` §10 `E7 ContractDriftError` dựng ra để phòng: contract vỡ nhưng mọi tầng đều xanh. Dùng nó thì phải tự tả schema trong prompt rồi tự validate — tức tự tay làm lại đúng thứ Gemini cho sẵn, đổi lấy 4 luồng song song thay vì 15.

**Chất lượng cũng đáng ngờ.** Hỏi "Thủ đô của Việt Nam là thành phố nào?" → *"Thành phố đầu tiên của Việt Nam là Hà Nội."* Nêu đúng Hà Nội nhưng diễn đạt sai hẳn. Không chứng minh được đằng sau cái tên `claude-sonnet-4-6` là model gì; chỉ kết luận được điều đo thấy: **nó hành xử yếu hơn hẳn cái tên gợi ý.** Một phép thử không đủ để kết tội, nhưng đủ để không đặt đường găng của một bài bị chấm lên nó.

**Quyết định:** giữ Gemini cho cả A1/A2/A3 và embedding. **Không** thêm nhánh Vyce vào adapter — thêm một nhà cung cấp là thêm một đường lỗi, mà đổi lại không được gì đo được.

**Đường nâng cấp cho A2 vẫn là nạp tiền Google Cloud** để mở bậc Pro: đổi đúng một chuỗi ID, cùng API, cùng schema, cùng adapter. Rẻ hơn hẳn việc gắn nhà cung cấp thứ hai.

**Lật được:** nếu Vyce sửa `json_schema` và nâng trần song song. **Chi phí lật:** thấp — key vẫn giữ trong `.env.local`, và file bằng chứng ghi sẵn base URL cùng tên model để khỏi phải dò lại.

### Đ23 — 2026-09-20 · Vercel: C-04 vốn đã xong từ đầu, SO báo sai

SO liệt "cần tài khoản Vercel" vào danh sách chặn suốt nhiều lượt **mà chưa từng kiểm tra**. Chạy `npx vercel whoami` thì ra ngay `tuanank2112-5635` — CLI 59.23.2 đã cài, đã đăng nhập. **C-04 chưa bao giờ là vật cản.** Suy từ "`OPERATIONS.md` đòi Vercel mà chủ tịch chưa đưa gì" thành "chưa có tài khoản" là giả định, không phải đo.

**Sai thứ hai, trong cùng lượt:** SO chạy `vercel link` mà không hỏi scope, nên project rơi vào team `n-listen-ai` — team đang chứa dự án khác của chủ tịch (`listena`). Chủ tịch bắt gỡ. Đã xoá `resident-agent-v1` khỏi team đó (project rỗng, mới tạo vài phút, `listena` không bị đụng) và gỡ link cục bộ.

**Luật rút ra:** `vercel link` mặc định chọn team đầu tiên tìm thấy, không phải scope cá nhân. Với tài khoản có nhiều team, **luôn truyền `--scope` tường minh** và hỏi chủ tịch muốn đặt ở đâu trước khi tạo project.

**Còn treo:** chủ tịch chọn scope nào cho `resident-agent-v1`. Chưa deploy lại cho tới khi có câu trả lời.

### Đ24 — 2026-09-20 · Chạy local bằng kho mock, nhưng số Golden từ mock KHÔNG phải số nghiệm thu

Chủ tịch: *"cứ local trước đã. mock-data luôn nhé"*. Chưa có `DATABASE_URL`, mà P02 là gói nặng nhất và lịch đã sang D2. Chốt: dựng **kho mock đọc thẳng file** để pipeline 3 agent chạy được ngay, không chờ Neon.

**Hình dạng:** biến `DATA_BACKEND` ∈ `mock` | `postgres`, mặc định `mock` ở local. Kho mock nằm **trong `lib/adapters/`** (`store-mock.ts`) nên BB-07 giữ nguyên — vẫn đúng một thư mục là cửa ra ngoài. Nguồn dữ liệu là `knowledge/` và `evals/golden/` đã có sẵn từ P00, **không sinh thêm dữ liệu giả nào**.

**Vì sao không phải SQLite:** `OPERATIONS.md` §8.1 đã cân nhắc và bác bản sao SQLite — nó nhân đôi tầng truy cập dữ liệu và phá BB-07. Kho mock ở đây khác: nó **không phải một cơ sở dữ liệu thứ hai**, chỉ là bộ đọc file nằm sau đúng cái interface mà `db.ts` phơi ra. Đổi sang Neon là đổi một biến môi trường, không viết lại lời gọi nào.

**Điều BẮT BUỘC phải nói rõ — chỗ số liệu không chuyển được:**

| Thành phần | Chuyển sang Postgres được không? |
| :-- | :-- |
| `cosine_sim` từ embedding Gemini | **CHUYỂN ĐƯỢC NGUYÊN** — cùng vector, cùng công thức, JS hay pgvector cũng ra một số |
| Lời gọi 3 agent, trích dẫn, mã `reason_code` | **CHUYỂN ĐƯỢC** — không dính gì tới tầng lưu trữ |
| 4 khuyết tật cài sẵn kích hoạt đúng mã | **CHUYỂN ĐƯỢC** — quyết định bằng metadata, không bằng xếp hạng |
| `score_lexical` | **KHÔNG** — mock không có `ts_rank_cd(..., 32)` của Postgres |
| `S1`, do đó `confidence` và cổng escalate ở chế độ `lexical` | **KHÔNG** |

⇒ **VÙNG CẤM:** cấm tick Exit Gate `G11` (`M1 ≥ 34/40` và `M3 ≥ 15/16`) bằng số chạy trên mock. Cấm chỉnh ngưỡng confidence theo số mock. Mọi kết quả Golden từ mock phải in kèm chữ `BACKEND=mock — số định hướng, KHÔNG phải số nghiệm thu`. Gate G11 chỉ được tick khi chạy trên Neon thật.

**Cái được ngay, không phải chờ Neon:** `G05` — bốn khuyết tật cài sẵn kích hoạt đúng `reason_code` qua pipeline thật. Đây chính là `K-M6`, số đo mà `SPEC-P00` §9 gọi là **quan trọng nhất của cả gói P00**, và nó đã treo từ lúc P00 nghiệm thu vì thiếu P02. Kèm theo: `G06` (trích dẫn), `G08` (ba agent log tách bạch).

**Lật được:** có `DATABASE_URL` thì đặt `DATA_BACKEND=postgres` và chạy lại. **Chi phí lật:** thấp nếu mock nằm sau đúng interface; cao nếu ai đó gọi thẳng vào mock từ `lib/pipeline/` — cấm điều đó tường minh trong bàn giao.

### Quyết định của chủ tịch — 2026-09-20

| Mã | Phán quyết | Ghi chú |
| :-- | :-- | :-- |
| C-01 | 🟡 **MỘT PHẦN** | Phần embedding: rút (Đ14). Phần nhà cung cấp model: chưa chốt được, xem Đ13 M-05. Phần ngân sách: chủ tịch muốn phương án free. |
| C-02 | ✅ **GẬT** | HITL chỉ áp cho lượt bị escalate. Lệch có chủ ý so với `docs/PRD_ResidentGPT_MVP.md` §8 SR-09, đã ghi lý do. |
| C-03 | ✅ **GẬT** | Bỏ Metric 2 (Efficiency). `specs/SPEC-P00-Knowledge-Golden.md` §6.1 đã ghi sẵn vùng cấm này; nay có căn cứ chính thức. Gỡ trạng thái "chưa có căn cứ" ở Idea Vault. |
| C-04 | ✅ **VỐN ĐÃ XONG** | Đo lại 2026-09-20: `vercel whoami` → `tuanank2112-5635`, CLI 59.23.2 đã đăng nhập. SO báo sai suốt nhiều lượt vì chưa kiểm — xem Đ23. Còn treo: chủ tịch chọn scope. |

### Sửa sai — P00 KHÔNG bị C-01 chặn

Câu "Gói P00 chưa được phóng vì C-01 chưa chốt" ghi ngày 2026-09-20 là **SAI**, nay gỡ. Căn cứ: `SPEC-P00-Knowledge-Golden.md` §7 **P00-C6 CẤM sinh Knowledge Pack bằng LLM**; toàn bộ P00 là viết tay 19 tài liệu + 66 case Golden + script kiểm tra. Số đo K-M1→K-M4 chỉ cần Node, K-M5 cần Neon, K-M6 thuộc gate của P02. **Không dòng nào của P00 cần key model.** P00 được phóng ngay.

## 3. Work Packages và Tầng model

| Gói | Nội dung | Tầng | Ngày | Phụ thuộc |
| :-- | :-- | :-- | :-- | :-- |
| P00 | Knowledge Pack mô phỏng + Golden Dataset | 🔴 | D1–D2 | — |
| P01 | Nền tảng, auth 2 vai, ingest, **deploy** | 🟠 | D2 | P00 (schema) |
| P02 | RAG có trích dẫn, memory, 3 agent, cổng escalate | 🔴🟠 | D3–D4 | P00, P01 |
| P03 | Console BQL: quản lý tài liệu + duyệt câu trả lời (HITL) | 🟠 | D4–D5 | P01, P02 |
| P04 | Bảng eval faithfulness/relevance + dashboard | 🟠 | D5 | P00, P02 |
| P05 | Lớp hành động: đọc chính sách, đặt chỗ, biên nhận, hoàn tác | 🟠 | D6 | **Cổng: P01–P04 xanh** |
| P06 | Kịch bản demo, dữ liệu mồi, dự phòng | 🟢 | D7 | tất cả |

## 4. Checklist thực thi

- [x] P00 — Knowledge Pack mô phỏng đủ phủ 12 tiện ích và 5 intent — `19 tài liệu · 98 section`, exit 0 (2026-09-20)
- [x] P00 — Khuyết tật cài sẵn: 2 gap + 1 cặp conflict + 1 expired — `defects_ok: 4/4`, exit 0 (2026-09-20)
- [x] P00 — Golden Dataset — `faq: 50 (answerable 40) · safety: 16 · canonical 10/10`, exit 0 (2026-09-20). `rubric.md` chuyển sang P04.
- [ ] P01 — Deploy được URL công khai — 🟡 **không còn bị chặn kỹ thuật**: Vercel CLI đã đăng nhập (Đ23), `npm run build` xanh không cần `DATABASE_URL`. Chờ chủ tịch chọn **scope** — lần trước SO lỡ tạo project vào team `n-listen-ai`, đã gỡ sạch
- [ ] P01 — Đăng nhập 2 vai trò Cư dân / BQL — 🟡 mã xong và có test (`scrypt` + cookie HMAC, sửa 1 byte ⇒ verify false); **chưa tick** vì tài khoản nằm trong DB, cần `DATABASE_URL` mới chứng minh được đăng nhập thật
- [x] P01a — Nền tảng chạy được không cần key: `tsc --noEmit` exit 0 · `npm run build` KHÔNG có `DATABASE_URL` exit 0 (8/9 route dynamic) · `npm test` 13/13 · **BB-05, BB-07, BB-10 xanh và đã chứng minh đỏ được** (2026-09-20)
- [ ] P02 — Trả lời có trích dẫn tới `document_id` và `section_id`
- [ ] P02 — Lịch sử hội thoại bền qua phiên
- [ ] P02 — Ba agent chạy tách bạch, log được từng chặng
- [ ] P02 — Escalate đúng theo 4 tín hiệu (Đ07)
- [ ] P03 — BQL upload / đổi version / đổi status tài liệu, ảnh hưởng ngay tới retrieval
- [ ] P03 — Hàng đợi duyệt câu trả lời, có sửa và có từ chối
- [ ] P04 — Bảng eval faithfulness và relevance trên Golden
- [ ] P04 — Dashboard tỉ lệ tự động giải quyết, tách theo intent và lý do escalate
- [ ] P05 — Đọc điều kiện trước khi ghi, không thử-và-hỏng
- [ ] P05 — Đặt chỗ có biên nhận và hoàn tác
- [ ] P06 — Kịch bản demo diễn trọn không vấp

## 5. Bảng trỏ SPEC

| SPEC | Phủ nội dung | Trạng thái |
| :-- | :-- | :-- |
| `specs/00-ARCHITECTURE.md` | Mục tiêu, non-goals, bất biến, router thứ tự đọc | ✅ |
| `specs/01-CONTRACTS.md` | Schema tài liệu tri thức, enum reason code, DDL, hợp đồng 3 agent, log | ✅ |
| `specs/SPEC-P00-Knowledge-Golden.md` | Cấu trúc Knowledge Pack, metadata, khuyết tật cài sẵn, Golden và rubric | ✅ |
| `specs/SPEC-P02-Agent-Pipeline.md` | Ba agent, cổng escalate, memory, trích dẫn | ✅ |
| `specs/SPEC-P03-BQL-Console.md` | Vòng đời tài liệu, HITL duyệt câu trả lời | ✅ |
| `specs/SPEC-P04-Eval-Dashboard.md` | Phép đo, công thức, nguồn số liệu | ✅ |
| `specs/SPEC-P05-Action-Layer.md` | Đọc chính sách, đặt chỗ, biên nhận, hoàn tác | ✅ |
| `specs/OPERATIONS.md` | Deploy, biến môi trường, seed, rollback, công tắc ngắt | ✅ |
| `specs/TESTING-ACCEPTANCE.md` | Ma trận test, số đo, Exit Gates theo môi trường | ✅ |

## 6. Tài liệu phân tích nền (không phải SPEC)

- Bản đồ năng lực rút từ 3 ảnh: 53 affordance → 46 capability (28 đọc / 18 ghi, 9 bất khả hoàn tác); 10/12 tiện ích trên app thiếu nguồn nội quy tương ứng; 2 tài liệu nội quy không có mục nào trên app.
- Sổ mâu thuẫn v0.2 với mô hình tự chủ: 117 ràng buộc — 29 tái diễn giải được, 37 phải giữ nguyên.
- Hai tài liệu nằm ở scratchpad của phiên. Nội dung cần giữ đã được chưng cất vào Mục 2 và sẽ vào `specs/`.
