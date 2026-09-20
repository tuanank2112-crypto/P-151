# R04 — Chuyển bộ SPEC sang nhà cung cấp Gemini

Vai: **ARCHITECT** · loại: **thiết kế (sửa đặc tả, KHÔNG viết code sản phẩm)** · họ/model: **Opus 5 (1M context)** · Bước 0 exit: **0** · Hiểu việc: sửa `specs/` của hồ sơ `01_2026-09-20_resident-agent-v1` để đổi nhà cung cấp model từ Anthropic sang Gemini theo đúng Đ17/Đ18/Đ19 đã chốt trong `plan.md`; mọi lựa chọn model chỉ được lấy từ `evidence/p02-provider/gemini-probe.txt`; CHỈ được chạm `specs/`, CẤM chạm code/`plan.md`/`brain4agent/`, CẤM commit, CẤM gọi API Gemini, CẤM in khoá.

Handoff: *(giao trực tiếp từ Super Orchestrator, không qua file `handoffs/`)*
Base: `a461c63`
Head: `a461c63` *(chưa commit — đúng luật CẤM commit)*

---

## 1. Bước 0

```text
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
👉 Trạng thái: NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!
EXIT_CODE=0
```

## 2. Dọn tồn đọng lượt trước

Lượt Fable trước chết vì hết hạn mức **trước khi chạm `specs/`**. `git status` lúc nhận việc:

```text
 M planning/01_2026-09-20_resident-agent-v1/plan.md
?? planning/01_2026-09-20_resident-agent-v1/evidence/p02-provider/
```

`git diff plan.md` = đúng 48 dòng thêm, toàn bộ là Đ17/Đ18/Đ19 + hai dấu "ĐÃ BỊ THAY THẾ" cho Đ13/Đ14 — **do Super Orchestrator ghi, không phải bản dở dang**. Không có gì phải dọn. Tôi **không sửa `plan.md`**.

---

## 3. Từng file đã sửa, kèm số mục

### `specs/01-CONTRACTS.md` (+410/−…)

| Mục | Sửa gì |
| :-- | :-- |
| §4.1 | `RETRIEVAL_MODE` mặc định **`lexical` → `hybrid`, cả local lẫn Vercel**. Ghi rõ cái giá: mỗi câu hỏi tốn thêm 1 lời gọi embedding ⇒ Golden = **264** lời gọi HTTP (198 sinh chữ + 66 embedding) |
| §4.3 | Viết lại toàn bộ bảng embedding: `gemini-embedding-001`, endpoint `embedContent`, `outputDimensionality: 384`, cột "Đã đo chưa" cho từng dòng. Thêm luật **chuẩn hoá L2 bắt buộc** + luật **CẤM trộn hai không gian vector**. Bỏ khối "CẤM dùng Claude để tạo embedding" |
| §7 | `PipelineStep.model` đổi từ union 3 ID Claude sang `SupportedModel` |
| §8 (đầu mục) | Adapter đổi tên `lib/adapters/anthropic.ts` → **`lib/adapters/model.ts`**, kèm lý do |
| **§8.0 (MỚI)** | Khung gọi chung cho cả 3 agent: `SupportedModel` + hằng số, URL `:generateContent`, `generationConfig` + `responseMimeType: "application/json"` + `responseSchema`; bảng **CẤM** `temperature`/`topP`/`topK`/`thinkingConfig`/`candidateCount` |
| **§8.0.1 (MỚI)** | Luật hình dạng `responseSchema` (tập con OpenAPI 3.0, kiểu VIẾT HOA, `nullable`, `propertyOrdering`). **Không có `zodOutputFormat`** ⇒ viết tay + giữ Zod kiểm lại + test `schema-parity` chống trôi lệch |
| **§8.0.2 (MỚI)** | Thứ tự đọc phản hồi bắt buộc: `blockReason` → `finishReason ≠ STOP` → `JSON.parse` từ **text** → token từ `usageMetadata` |
| §8.1 | A1 `gemini-3.5-flash-lite`; `maxOutputTokens` **1024 → 2048** (token suy nghĩ nay tính chung ngân sách); `CLASSIFIER_RESPONSE_SCHEMA` đầy đủ |
| §8.2 | A2 `gemini-3.5-flash` + **khối cảnh báo rủi ro chất lượng**; `RETRIEVER_RESPONSE_SCHEMA` + `CITATION_SCHEMA` |
| §8.3 | A3 `gemini-2.5-flash` + `VERIFIER_RESPONSE_SCHEMA`; ghi rõ "khác **thế hệ** với A2 là cố ý" |
| §9 | Bảng lỗi tách 429/503/5xx/401-403/blocked; thêm cột "Mã HTTP kích hoạt"; backoff **2s→8s + jitter** cho 429 và 503 |
| §10 | `C-08` viết lại; thêm `C-09`…`C-13` |
| §11 | Thêm `C-M8`…`C-M11` (đo số chiều, đo chuẩn hoá L2, `schema-parity`, đo `responseSchema`) |

### `specs/00-ARCHITECTURE.md` (+222/−…)

Header (Đ01–Đ12 → Đ01–Đ19) · §5 sơ đồ tầng · **§9 BB-07 viết lại + thêm §BB-07.a/§BB-07.b** · §8 bảng lỗi E2 tách thành E2/E2b/E2c/E2d/E2e · §10 bảng quyết định · **§10.1 viết lại hoàn toàn** (bảng số đo thay bảng giá, khối cảnh báo A2, vùng cấm 3.7/3.8, bảng hạn mức) · §11 dòng BB-07.

### `specs/OPERATIONS.md` (+189/−…)

§3 biến môi trường (`ANTHROPIC_API_KEY` → `GEMINI_API_KEY`, thêm `GOLDEN_CONCURRENCY`, ghi chú hình dạng khoá `AQ.…`) · §4 bước 7 · **§5 thêm luật hai pha cho seed** · **§7 vá lỗ thủng phao cứu sinh** · §8 rollback (+3 dòng) · **§9 viết lại hoàn toàn**, tách §9.1 số đo / §9.2 số ước lượng / §9.3 luật chạy / §9.4 đo token thật · §10 bảng lỗi vận hành (+7 dòng) · §12 **gỡ `OP-C8`**, thêm `OP-C11`…`OP-C14` · §13 thêm `OP-M10`, `OP-M11`.

### `specs/TESTING-ACCEPTANCE.md` (+87/−…)

§2 thêm `T-EMBED`/`T-SCHEMA`/`T-PARITY` · §4.4 bơm lỗi `S14` thành **3 biến thể** · §4.5 grep BB-07 mẫu mới · §6.5 "Bốn lần đỏ" → **"Bảy lần đỏ"** (thêm `R10`/`R11`/`R12`) · §7.2 thêm **G27–G31** · §7.3 điều kiện mở cổng P05 · §8 bảng lỗi (+4 dòng) · §9 thêm `T-C10`…`T-C13`, sửa `T-C8` · §10 mẫu report dòng 6.

### Hai file KHÔNG nằm trong danh sách được giao, nhưng phải sửa

| File | Vì sao bắt buộc |
| :-- | :-- |
| `specs/SPEC-P02-Agent-Pipeline.md` | §5.1/§5.2 còn ghi `claude-opus-5`/`claude-sonnet-5`; §5.3 còn đọc `response.usage`; §9 bảng lỗi chưa có 503; `P02-C7`/`P02-C12` nói về ràng buộc 400 của Anthropic. Để nguyên là **SPEC tự mâu thuẫn** |
| `specs/SPEC-P04-Eval-Dashboard.md` | §5 điều 3 ghi **"Chạy tuần tự"** — **mâu thuẫn thẳng với Đ19** (song song 3–5). Ngoài ra §1 và `P04-M4` dùng `grep -rn "anthropic"` nay xanh giả |

Cả hai đều nằm trong `specs/`, tức trong phạm vi được phép.

---

## 4. Bảng "trước → sau"

| Vai | SPEC trước | SPEC sau | Số ĐO làm căn cứ |
| :-- | :-- | :-- | :-- |
| A1 `classifier` | `claude-haiku-4-5` | **`gemini-3.5-flash-lite`** | 200 · 1415ms · burst 15 qua **15/15** · p50 2043ms |
| A2 `retriever` | `claude-opus-5` *(mạnh nhất)* | **`gemini-3.5-flash`** ⚠ | 200 · 9789ms. **Không còn bậc Pro**: 2.5-pro → 404; 3.1-pro-preview & pro-latest → **429** sau cổng thanh toán |
| A3 `verifier` | `claude-sonnet-5` | **`gemini-2.5-flash`** | 200 · 2009ms · in=52 out=23 · JSON sạch **ngay lần đầu** |
| Embedding | `Xenova/multilingual-e5-small` tại chỗ | **`gemini-embedding-001`** + `outputDimensionality: 384` | trả **đúng 384** ⇒ **khớp nguyên `vector(384)` §3.3, KHÔNG đổi schema** |

**Tham số gọi:** `max_tokens` + `thinking` + `output_config: { format: zodOutputFormat(...) }` → `maxOutputTokens` + `generationConfig: { responseMimeType: "application/json", responseSchema: {...} }`.
**Đọc token:** `response.usage` → `usageMetadata.promptTokenCount` / `candidatesTokenCount`.
**Đọc JSON:** `response.parsed_output` → text của candidate, rồi `JSON.parse` + Zod.

---

## 5. Vùng cấm đã GỠ / đã THÊM

**Đã gỡ — đúng một:**

| Mã | Nội dung cũ | Lý do gỡ |
| :-- | :-- | :-- |
| `OP-C8` | *"CẤM đổi `RETRIEVAL_MODE` trên Vercel sang `hybrid`"* | Căn cứ cũ là **"không có embedding trên Vercel"**. Căn cứ đó **mất** khi embedding thành một lời gọi HTTP trả đúng 384 chiều `[Đ18]`. Giữ dòng ở dạng gạch ngang, **không tái sử dụng số hiệu `OP-C8`** để tham chiếu cũ không trỏ nhầm sang nghĩa mới |

**Đã thêm — 15 mã:**

`C-09` (cấm 3.7/3.8-flash) · `C-10` (cấm `taskType` — chưa đo) · `C-11` (cấm `temperature`/`topP`/`topK`/`thinkingConfig`) · `C-12` (cấm đọc `parsed_output`) · `C-13` (cấm đọc `GEMINI_API_KEY` ngoài adapter) · `OP-C11`…`OP-C14` · `P02-C13`…`P02-C15` · `P04-C9`, `P04-C10` · `T-C10`…`T-C13`.
`C-08` **giữ số hiệu nhưng đổi nghĩa**: từ *"cấm dùng Claude làm embedding"* → *"cấm gọi `embedContent` mà không truyền `outputDimensionality: 384`"*.

**Đã sửa nghĩa:** `OP-C5` và `T-C8` từ *"CẤM chạy Golden song song"* → *"CẤM song song **ngoài khoảng 3–5**"*, vì Đ19 bắt buộc song song 3–5 và luật cũ mâu thuẫn thẳng với nó.

---

## 6. Ranh giới adapter — quyết định và căn cứ ĐO ĐƯỢC

**Quyết định: ĐỔI TÊN `lib/adapters/anthropic.ts` → `lib/adapters/model.ts`.**

Bản giao việc nói script *"đang chặn theo tên đó"*. **Đo lại thì không đúng** — và chính chỗ sai đó làm đảo ngược phép so chi phí:

`scripts/check_adapter_boundary.sh` dòng 17 chặn theo **tên gói** `@anthropic-ai/sdk`, còn loại trừ theo **thư mục** `grep -v "^lib/adapters/"` — **không hề theo tên file**.

Ba căn cứ đo được:

1. **Đổi tên không làm hỏng script.** Dựng cây giả có `lib/adapters/model.ts` chứa cả host lẫn khoá → vẫn `violations: 0`, exit 0.
2. **Không file nào import adapter đó.** `grep -rn "adapters/anthropic\|getAnthropicClient\|SupportedModel" app/ lib/ tests/ scripts/` chỉ trúng chính file đó + **1 dòng chú thích** ở `scripts/seed_knowledge.mjs:115`.
3. **Script BẮT BUỘC phải sửa dù có đổi tên hay không.** Bỏ `@anthropic-ai/sdk` khỏi `package.json` thì mẫu cũ không bao giờ trúng gì ⇒ **xanh giả**. Đã chứng minh bằng lệnh, không suy đoán:

```text
# cây giả: app/chat/page.tsx nhúng thẳng host Gemini
#          lib/pipeline/a1.ts đọc thẳng process.env.GEMINI_API_KEY
$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT=0            ← XANH, trên một cây đang rò rỉ lộ liễu
```

⇒ Vì script phải sửa **trong cả hai phương án**, đổi tên **không tốn thêm một lần sửa script nào**. Phương án "giữ tên" chỉ mua được 1 lệnh `git mv` + 1 dòng chú thích, đổi lấy một tên file nói dối vĩnh viễn. **Đổi tên mới là phương án ít phá nhất.**

**Mẫu kiểm thay thế đã chạy thử trên dữ liệu giả** (trong thư mục tạm, không chạm `scripts/`):

```text
# cây BAD                          # cây GOOD (host + khoá nằm gọn trong lib/adapters/model.ts)
violations: 2                      violations: 0
EXIT=1                             EXIT=0
```

**Hệ quả cho P01a:** **giữ nguyên DUYỆT.** Bất biến mà 4 phép phá của P01a chứng minh là bất biến **thư mục**, không đổi. Cái hết hiệu lực chỉ là **mẫu grep nhận diện nhà cung cấp** ⇒ SPEC bắt worker P02 chạy lại phép phá cho mẫu mới (`R10`) và **CẤM tick `G15` nếu thiếu `R10`** (`T-C10`).

---

## 7. Ba mâu thuẫn chéo tự phát hiện khi rà, đã vá trong SPEC

1. **Phao cứu sinh thủng.** `KILL_SWITCH_AGENTS=1` được bật *chính vì* nhà cung cấp hỏng, nhưng từ Đ18 `hybrid` cần gọi embedding tới **đúng nhà cung cấp đang hỏng** ⇒ chặng `retrieval` chết trước khi tới `eligibility`. Đồng thời `OP-M8` tự mâu thuẫn (nó đòi "**0** lời gọi model"). Vá: kill switch **ép `lexical`**, bất kể biến môi trường (`OPERATIONS` §7, `OP-C14`, `P02-C15`, `G13`).
2. **Seed tri thức nay đốt hạn mức nặng nhất dự án.** `≥ 97` chunk ⇒ `≥ 97` lời gọi `embedContent`, trong khi trần là 15–40/phút. Va thẳng vào luật "Một transaction": 429 ở chunk thứ 90 sẽ rollback và **đốt bỏ 89 lời gọi**. Vá: tách **Pha A (chỉ mạng, ghi file đệm, chạy lại chỉ bù phần thiếu)** và **Pha B (chỉ DB, một transaction)** — giữ nguyên cả hai bất biến cũ (`OPERATIONS` §5).
3. **`SPEC-P04` §5 ghi "Chạy tuần tự", mâu thuẫn thẳng Đ19.** Cùng nhóm với `OP-C5`/`T-C8`. Đã sửa cả ba về "song song 3–5, ngoài khoảng ⇒ exit 1".

---

## 8. `git diff --stat`

```text
 .../specs/00-ARCHITECTURE.md          | 222 +++++++++--
 .../specs/01-CONTRACTS.md             | 410 ++++++++++++++++++---
 .../specs/OPERATIONS.md               | 189 ++++++++--
 .../specs/SPEC-P02-Agent-Pipeline.md  |  38 +-
 .../specs/SPEC-P04-Eval-Dashboard.md  |  34 +-
 .../specs/TESTING-ACCEPTANCE.md       |  87 ++++-
 6 files changed, 820 insertions(+), 160 deletions(-)
```

SHA base = head = `a461c63` (chưa commit).
`plan.md` vẫn ở trạng thái Super Orchestrator để lại — **tôi không chạm**.

**Kiểm tính nhất quán tham chiếu chéo:** mọi mã `C-*`/`OP-C*`/`P02-C*`/`P04-C*`/`T-C*` được trỏ tới đều có **đúng 1** định nghĩa; không có tham chiếu treo.

---

## 9. Việc KHÔNG làm + lý do

| Không làm | Lý do |
| :-- | :-- |
| Không sửa `lib/adapters/anthropic.ts`, `scripts/check_adapter_boundary.sh`, `scripts/seed_knowledge.mjs`, `package.json` | Nằm ngoài `specs/` — bị CẤM tường minh. SPEC đã ghi đủ để worker P02 làm: tên file mới, mẫu grep mới nguyên văn, dòng chú thích cần sửa (`seed_knowledge.mjs:115`), gói cần gỡ |
| Không sửa `plan.md` | CẤM. Đ17/Đ18/Đ19 đã đủ; không có quyết định mới nào cần ghi thêm |
| Không gọi API Gemini | CẤM. Mọi số trong SPEC lấy từ `gemini-probe.txt`, đã trỏ nguồn từng dòng |
| Không tự phán quyết DUYỆT | Theo yêu cầu bàn giao |
| Không đổi `vector(384)`, không đổi 15 `reason_code`, không đổi Golden | 384 khớp nguyên; các thứ còn lại không liên quan đổi nhà cung cấp |
| Không chốt `taskType` cho embedding | **Chưa đo.** Lệch `taskType` làm `cosine_sim` tụt **mà không ném lỗi** — hỏng im lặng. Đóng thành `C-10` kèm đường mở |
| Không chạy `npm test` / `tsc` | Chỉ sửa Markdown; không có mã sản phẩm nào đổi nên không có gì để biên dịch |

---

## 10. Câu hỏi cần người

1. **A2 chạy bậc Flash là rủi ro chất lượng có thật, đánh thẳng vào `faithfulness` (R3/R9).** SPEC đã cấm bù bằng cách nới ngưỡng (`T-C4`). Nếu `M1 < 34/40` ở lượt Golden đầu, hướng xử lý là **nạp tiền Google Cloud để A2 lên bậc Pro** (đổi 1 chuỗi ID) hay **chấp nhận điểm thấp hơn**? Cần quyết trước khi P02 chạy Golden, vì nó đổi thứ tự ưu tiên việc.
2. **Hai phép đo CÒN NỢ chặn P02:** `C-M11` (`responseSchema` có được chấp nhận không — lượt probe chỉ đo `responseMimeType`) và `C-M9` (chuẩn hoá L2 — `gemini-embedding-001` ở 384 chiều có trả vector đã chuẩn hoá sẵn không). Cả hai **cần gọi API**, mà tôi bị CẤM gọi. Ai chạy — Super Orchestrator đo tay như lượt probe trước, hay giao worker P02 đo ngay đầu gói?
3. **Seed tri thức nay cần `GEMINI_API_KEY` và `≥ 97` lời gọi embedding.** Với trần 15–40/phút, lần seed đầu sẽ chiếm phần lớn hạn mức của một khoảng thời gian. Có nên seed vào lúc chắc chắn không ai chạy Golden cùng lúc không?
4. **Số hiệu `OP-C8` tôi để dạng gạch ngang, không tái sử dụng.** Nếu quy ước của hồ sơ là xoá hẳn dòng đã gỡ thì báo để tôi sửa.
