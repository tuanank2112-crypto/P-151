# SPEC-P02 — PIPELINE 3 AGENT, TRÍCH DẪN, MEMORY, CỔNG ESCALATE

> Tầng 🔴🟠 · Ngày D3–D4 · Phụ thuộc P00 (tri thức) + P01 (DB, auth, deploy).
> Phụ thuộc đọc: [`00-ARCHITECTURE.md`](00-ARCHITECTURE.md),
> [`01-CONTRACTS.md`](01-CONTRACTS.md) §5, §7, §8.
> Phủ rubric **R3, R4, R5, R6**.

---

## 1. Hình dạng tổng thể

Một hàm, một điểm vào. Mọi đường khác đi vào pipeline đều là bug.

```ts
// lib/pipeline/index.ts
export async function runTurn(args: {
  conversation_id: string;
  question_vi: string;
  principal: Principal;
  now?: Date;                       // tiêm được để test tất định
  /** CHỈ dùng để bơm lỗi khi test. Golden case S14 dùng "429".
   *  `true` giữ lại cho tương thích, nghĩa là "429". Xem TESTING §4.4. */
  forceUpstreamError?: "429" | "503" | "blocked" | true;
}): Promise<TurnResult>;
```

`runTurn` **luôn** ghi đúng một dòng `answer_turns` trước khi trả về, kể cả khi ném
lỗi (BB-11). Cách cài: `try / finally`, ghi trong `finally`.

---

## 2. Chín chặng, thứ tự tất định `[BB-08]`

Kế thừa `docs/_legacy-v0.2/UI_Flow_ResidentGPT_MVP.md` §D Must Have (*"Deterministic order:
input validation → early safety/PII → intent → required context → detailed risk →
retrieval"*), mở rộng thêm 3 chặng của v1.0.

| # | `step` | Làm gì | Model | Thoát sớm với |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `validate` | Rỗng / chỉ khoảng trắng / > 2000 ký tự | — | HTTP 400, **không** tạo turn |
| 2 | `safety` | A1 `is_emergency` → dừng ngay; `is_legal_or_compensation`; `checkOwnership()` | A1 | `emergency_or_life_safety`, `legal_or_compensation_escalation`, `pii_or_account_specific` |
| 3 | `intent` | A1 gán `I-01…I-05` / `unsupported` / `unresolved` | A1 (cùng lời gọi chặng 2) | `unsupported_intent`, `intent_unresolved` |
| 4 | `context` | Đối chiếu bảng `required_context` (`01-CONTRACTS` §8.1.1) | — | `decision = clarify`, state `clarification_required` |
| 5 | `risk` | Danh mục hard-block (`MVP_DATA_SCOPE_LOCK.md` §8) | — | `legal_or_compensation_escalation` |
| 6 | `retrieval` | SQL §4.2 của `01-CONTRACTS`, `TOP_K = 8` | — | — |
| 7 | `eligibility` | 7 điều kiện E-1…E-7, tất định | — | `G1_conflict`, `G2_zero_eligible` |
| 8 | `draft` | A2 sinh nháp + citation | A2 | `G3_retriever_refused` |
| 9 | `verify` | A3 soi từng claim | A3 | `G4_faithfulness_floor`, `G5_tau_answer` |

**Bất biến thứ tự:** `result.steps` phải chứa đủ các chặng đã chạy, **đúng thứ tự
tăng dần**, không nhảy cóc. Thoát sớm ở chặng *k* ⇒ `steps` có đúng *k* phần tử.

```ts
export function assertStepOrder(steps: PipelineStep[]): void; // ném PipelineInvariantError
```

**Ưu tiên tuyệt đối của `emergency_or_life_safety`:** chặng 2 kiểm nó **trước** mọi
thứ khác, kể cả ownership. Người đang ngã ở bể bơi thì không quan tâm căn nào.
Neo: `MVP_DATA_SCOPE_LOCK.md` §8, `PRD` §8 bảng Fallback states.

---

## 3. Chặng 6 — Retrieval

```ts
export const TOP_K = 8;
export async function retrieve(normalized_query_vi: string): Promise<RetrievedChunk[]>;
```

Dùng **nguyên văn** truy vấn SQL ở `01-CONTRACTS.md` §4.2, kể cả cờ chuẩn hoá `32`.
`S1 = retrieved[0]?.score ?? 0`. Tập rỗng là kết quả hợp lệ, **không** phải lỗi —
đó chính là đường đi của khuyết tật #1.

---

## 4. Chặng 7 — Eligibility & phát hiện mâu thuẫn

Cài đặt `applyEligibility()` theo `01-CONTRACTS.md` §5. Hai điểm dễ sai:

**4.1 — Ghi lại điều kiện fail ĐẦU TIÊN.** Đánh giá theo đúng thứ tự E-1 → E-7, gặp
fail thì dừng đánh giá chunk đó và ghi `RejectionReason` tương ứng. Đánh giá hết rồi
chọn "lý do nghiêm trọng nhất" sẽ làm khuyết tật #4 ra sai mã (`SPEC-P00` §5.4, ba bẫy).

**4.2 — Phát hiện mâu thuẫn là SQL, không phải LLM `[VC-04]`.**

```ts
export function detectConflict(eligible: RetrievedChunk[], sections: SectionMeta[]): string[] {
  const byGroup = new Map<string, Set<string>>();
  for (const c of eligible) {
    const g = sections.find(s => s.section_id === c.section_id)?.conflict_group;
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, new Set());
    byGroup.get(g)!.add(c.section_id);
  }
  return [...byGroup.entries()].filter(([, ids]) => ids.size >= 2).map(([g]) => g);
}
```

Mảng trả về không rỗng ⇒ `S4 = true`. Đúng hai section, đúng một nhóm, không cần
"semantic conflict detection hoàn hảo" — `UI_Flow_ResidentGPT_MVP.md` §Final
Validation mục 6 đã chấp nhận tiếp cận này.

---

## 5. Ba agent

Hợp đồng kiểu và tham số gọi: `01-CONTRACTS.md` §8. Đây là phần **nội dung prompt**
và **ràng buộc hành vi**.

### 5.1 — A2 `retriever` — `gemini-3.5-flash` ⚠

> **⚠ A2 không còn chạy model mạnh nhất.** Mọi bậc Pro của nhà cung cấp đều nằm sau
> cổng thanh toán (429). Đọc khối cảnh báo ở `00-ARCHITECTURE.md` §10.1 **trước khi
> viết một dòng nào của A2**. Prompt dưới đây vì vậy càng phải giữ nguyên độ chặt —
> **CẤM** nới nó ra cho model "dễ thở". `[Đ17]`

Khung system prompt (viết tiếng Việt, worker giữ nguyên ý, được chỉnh câu chữ):

```text
Bạn soạn câu trả lời cho cư dân một khu đô thị, CHỈ dựa trên các đoạn trích được cung cấp.

BẮT BUỘC:
- Mỗi phát biểu mang tính quy định phải neo vào đúng một đoạn trích đã cho.
- Trả về citations gồm section_id của các đoạn thực sự đã dùng.
- Viết tiếng Việt, ngắn, đi thẳng vào việc.

CẤM:
- CẤM dùng kiến thức bên ngoài các đoạn trích, kể cả khi bạn chắc chắn nó đúng.
- CẤM suy diễn con số, giờ giấc, mức phí, hạn mức không có trong đoạn trích.
- CẤM trích dẫn section_id không nằm trong danh sách được cung cấp.
- CẤM trả lời "vòng quanh": nếu câu hỏi hỏi MỘT dữ kiện cụ thể (giờ, mức phí, con số, thời hạn, điều kiện)
  mà các đoạn trích KHÔNG chứa đúng dữ kiện đó cho đúng đối tượng được hỏi, thì KHÔNG được đưa
  thông tin lân cận thay thế (vd hỏi phí thẻ xe máy mà chỉ có phí thẻ cư dân; hỏi giờ mở cửa mà chỉ
  có quy định trang phục) — phải từ chối.
- Ngược lại, nếu một đoạn trích CÓ đúng dữ kiện được hỏi (kể cả diễn đạt khác chữ, vd "cấp lại
  thẻ do làm mất" = "làm lại thẻ bị mất") thì PHẢI trả lời và trích đoạn đó — từ chối lúc này là SAI.

KHI KHÔNG ĐỦ CĂN CỨ:
- Đặt refused = true và nêu ngắn gọn còn thiếu thông tin gì.
- Đây là hành vi ĐÚNG, không phải thất bại. Thà từ chối còn hơn đoán.
```

**Bất biến A2 (kiểm ở TypeScript, không trông chờ prompt):**

```ts
const allowed = new Set(eligible_chunks.map(c => c.section_id));
for (const cit of out.citations) {
  if (!allowed.has(cit.section_id)) {
    throw new PipelineInvariantError(`A2 cited unknown section: ${cit.section_id}`);
  }
}
```

CẤM lọc im lặng citation lạ. Lọc im lặng che mất việc model đang bịa nguồn.

### 5.2 — A3 `verifier` — `gemini-2.5-flash`

```text
Bạn kiểm chứng một bản nháp dựa trên các đoạn trích kèm theo.

Việc của bạn:
1. Tách bản nháp thành từng mệnh đề kiểm chứng được (claim).
2. Với mỗi claim, gán đúng một verdict:
   - supported: đoạn trích nói rõ điều đó. Ghi supporting_section_id.
   - unsupported: đoạn trích không nói gì về điều đó.
   - contradicted: đoạn trích nói ngược lại.

CẤM:
- CẤM suy đoán ý định của người viết bản nháp.
- CẤM coi một claim là supported vì "nghe hợp lý" hoặc "thường là như vậy".
- CẤM gộp nhiều claim thành một để cho dễ.
- Khi phân vân giữa supported và unsupported: chọn unsupported.
```

**VC-03 — A3 KHÔNG được thấy câu hỏi gốc.** `VerifierInput` cố ý không có trường
`question_vi` (`01-CONTRACTS.md` §8.3). Lý do: thấy câu hỏi thì A3 bắt đầu "thông
cảm" — nó suy ra ý định của A2 và cho qua claim không neo. Việc của A3 là so
`claim ⟷ evidence`, không phải đánh giá "có trả lời trúng câu hỏi không".
Relevance được đo bằng cơ chế khác (`SPEC-P04` §3.3).

**Khác thế hệ model là cố ý:** A2 chạy họ **3.x** (`gemini-3.5-flash`), A3 chạy họ
**2.x** (`gemini-2.5-flash`). Người chấm không nên là người viết. **CẤM đổi A3 sang
cùng ID model với A2** cho "chất lượng hơn" — gộp về một model là mất ý nghĩa của
`faithfulness` (VC-02 / BB-06).

### 5.3 — Ba chặng phải log tách bạch `[R6]`

Mỗi lời gọi model ghi một `PipelineStep` với `model`, `ms`, `input_tokens`,
`output_tokens` — lấy từ **`usageMetadata.promptTokenCount`** và
**`usageMetadata.candidatesTokenCount`**, **không** phải `response.usage` của nhà cung
cấp cũ (`01-CONTRACTS.md` §8.0.2). Trang trace (§8) đọc thẳng
`answer_turns.pipeline_steps`.

**VC-02 — CẤM gộp A2 và A3 vào một lời gọi.** Gộp thì model tự chấm bản nháp nó vừa
viết trong cùng ngữ cảnh; `faithfulness` mất hết giá trị và BB-06 sụp theo, kéo sập
luôn cột faithfulness của bảng eval.

---

## 6. Cổng escalate — Đ07 🔴

### 6.1 — Bốn tín hiệu

| Tín hiệu | Tên | Nguồn | Miền |
| :-- | :-- | :-- | :-- |
| `S1` | `retrieval_top1` | `ts_rank_cd(..., 32)` của chunk tốt nhất | `(0, 1)`, rỗng ⇒ `0` |
| `S2` | `eligible_ratio` | `eligible_count / retrieved_count` | `[0, 1]`, `retrieved_count = 0` ⇒ `0` |
| `S3` | `faithfulness` | A3: `supported / total`, **tính ở TS** | `[0, 1]` |
| `S4` | `conflict_detected` | `detectConflict()` § 4.2 | `{false, true}` |

### 6.2 — Công thức và ngưỡng khởi điểm

```ts
// lib/confidence.ts — thuần, tất định, không I/O, dễ unit-test
export const W_RETRIEVAL    = 0.20;
export const W_ELIGIBILITY  = 0.20;
export const W_FAITHFULNESS = 0.60;
export const TAU_ANSWER     = 0.62;   // ngưỡng khởi điểm — chỉnh được
export const TAU_FAITHFUL   = 0.80;   // sàn cứng — chỉnh được, nhưng xem §6.5

confidence = round4(W_RETRIEVAL*S1 + W_ELIGIBILITY*S2 + W_FAITHFULNESS*S3)
```

Trọng số **0,60 dồn cho `S3`** vì faithfulness là tín hiệu duy nhất nhìn vào **nội
dung câu trả lời sắp nói ra**; ba tín hiệu kia chỉ nhìn vào nguyên liệu đầu vào.

**Năm cổng, xét theo đúng thứ tự, gặp cổng nào dừng ở đó:**

| Thứ tự | Gate | Điều kiện | `decision` | `reason_code` |
| :-- | :-- | :-- | :-- | :-- |
| 1 | `G1_conflict` | `S4 === true` | escalate | `source_conflict` |
| 2 | `G2_zero_eligible` | `eligible_count === 0` | escalate | `rejection_histogram.expired_or_unknown > 0` ? `source_expired_or_unknown` : `no_eligible_source` |
| 3 | `G3_retriever_refused` | A2 trả `refused === true` | escalate | `top_rejected_reason === 'expired_or_unknown'` ? `source_expired_or_unknown` : `no_eligible_source` **(Đ28)** |
| 4 | `G4_faithfulness_floor` | `S3 < TAU_FAITHFUL` | escalate | `no_eligible_source` |
| 5 | `G5_tau_answer` | `confidence < TAU_ANSWER` | escalate | `no_eligible_source` |
| — | *(qua hết)* | | **answer** | `null` |

Cài đặt tham chiếu, sao y vào `lib/confidence.ts`:

```ts
export function decideTurn(sig: {
  retrieval_top1: number; eligible_count: number; retrieved_count: number;
  faithfulness: number; conflict_detected: boolean;
  retriever_refused?: boolean;
  rejection_histogram?: Partial<Record<RejectionReason, number>>;
  /** Đ28 — lý do loại của chunk XẾP HẠNG 1, `null` nếu chunk đó hợp lệ. */
  top_rejected_reason?: RejectionReason | null;
}): { confidence: number; decision: Decision; reason_code: ReasonCode | null;
      gate: string | null; s1: number; s2: number; s3: number } {
  const { retrieval_top1: s1, eligible_count, retrieved_count, faithfulness: s3,
          conflict_detected, retriever_refused = false, rejection_histogram = {},
          top_rejected_reason = null } = sig;
  const s2 = retrieved_count === 0 ? 0 : eligible_count / retrieved_count;
  const confidence = round4(W_RETRIEVAL * s1 + W_ELIGIBILITY * s2 + W_FAITHFULNESS * s3);

  if (conflict_detected)
    return r(0, "escalate", "source_conflict", "G1_conflict", s1, s2, s3);
  if (eligible_count === 0) {
    const code = (rejection_histogram.expired_or_unknown ?? 0) > 0
      ? "source_expired_or_unknown" : "no_eligible_source";
    return r(0, "escalate", code, "G2_zero_eligible", s1, s2, s3);
  }
  if (retriever_refused) {
    // Đ28 — A2 từ chối nghĩa là không nguồn HỢP LỆ nào trả lời được câu này.
    // Nếu nguồn khớp NHẤT lại là tài liệu đã hết hiệu lực thì sự thật là
    // "thông tin nằm trong tài liệu hết hạn", không phải "không có nguồn nào".
    const code = top_rejected_reason === "expired_or_unknown"
      ? "source_expired_or_unknown" : "no_eligible_source";
    return r(0, "escalate", code, "G3_retriever_refused", s1, s2, s3);
  }
  if (s3 < TAU_FAITHFUL)
    return r(confidence, "escalate", "no_eligible_source", "G4_faithfulness_floor", s1, s2, s3);
  if (confidence < TAU_ANSWER)
    return r(confidence, "escalate", "no_eligible_source", "G5_tau_answer", s1, s2, s3);
  return r(confidence, "answer", null, null, s1, s2, s3);
}
function r(confidence: number, decision: Decision, reason_code: ReasonCode | null,
           gate: string | null, s1: number, s2: number, s3: number) {
  return { confidence, decision, reason_code, gate, s1, s2: round4(s2), s3 };
}
function round4(x: number) { return Math.round(x * 10000) / 10000; }
```

### 6.3 — Bảng ví dụ đã đo — dùng làm bộ unit test

Bảng dưới **không phải ví dụ minh hoạ**. Nó là output nguyên văn của cài đặt tham
chiếu ở §6.2, chạy trên 10 bộ tín hiệu giả, ngày 2026-09-20.

Lệnh đã chạy: `node run_conf.mjs` (mã nguồn đầy đủ ở
[`TESTING-ACCEPTANCE.md`](TESTING-ACCEPTANCE.md) §3.3), exit code **0**.

```text
W_RETRIEVAL=0.2 W_ELIGIBILITY=0.2 W_FAITHFULNESS=0.6 TAU_ANSWER=0.62 TAU_FAITHFUL=0.8
case | S1 | S2 | S3 | S4 | confidence | decision | reason_code | gate
W1 D5 bể bơi trẻ em (đối chứng xanh) | 0.82 | 1.0000 | 1.00 | 0 | 0.964 | answer | — | —
W2 D6 giờ BQL (đối chứng xanh) | 0.74 | 0.6000 | 1.00 | 0 | 0.868 | answer | — | —
W3 sát ngưỡng dưới | 0.55 | 0.2500 | 0.80 | 0 | 0.64 | answer | — | —
W4 sát ngưỡng trên nhưng trượt | 0.30 | 0.1250 | 0.80 | 0 | 0.565 | escalate | no_eligible_source | G5_tau_answer
W5 faithfulness thấp, raw vẫn cao | 0.90 | 1.0000 | 0.75 | 0 | 0.83 | escalate | no_eligible_source | G4_faithfulness_floor
W6 S03 conflict BBQ (DEF-03) | 0.88 | 1.0000 | 1.00 | 1 | 0 | escalate | source_conflict | G1_conflict
W7 S01 pickleball (DEF-01) | 0.00 | 0.0000 | 0.00 | 0 | 0 | escalate | no_eligible_source | G2_zero_eligible
W8 S04 bể bơi expired (DEF-04) | 0.79 | 0.0000 | 0.00 | 0 | 0 | escalate | source_expired_or_unknown | G2_zero_eligible
W9 S02 phí thẻ xe máy (DEF-02) | 0.68 | 0.3333 | 0.00 | 0 | 0 | escalate | no_eligible_source | G3_retriever_refused
W10 A3 không tách được claim nào | 0.71 | 0.7500 | 0.00 | 0 | 0.292 | escalate | no_eligible_source | G4_faithfulness_floor
```

Ba dòng đáng đọc kỹ:

- **W5** chứng minh sàn `TAU_FAITHFUL` **không thừa**: `confidence = 0,83` — cao hơn
  `TAU_ANSWER` khá nhiều — nhưng 1 trong 4 mệnh đề không neo được. Không có sàn thì
  câu này được nói ra. Ai định bỏ `TAU_FAITHFUL` cho "gọn công thức" thì đọc dòng này.
- **W8 vs W7** chứng minh `rejection_histogram` là bắt buộc: cùng `eligible_count = 0`,
  cùng gate `G2_zero_eligible`, nhưng **hai mã khác nhau**. Bỏ histogram thì khuyết
  tật #4 ra sai mã và Golden case `S04` fail.
- **⚠ ĐÍNH CHÍNH W8 — 2026-09-21 (Đ28).** Dòng W8 giả định truy hồi cho câu hỏi
  DEF-04 CHỈ kéo về chunk hết hiệu lực (`S2 = 0`). Đo thật thì **sai**: pipeline
  truy hồi bằng truy vấn đã chuẩn hoá của A1, không phải câu hỏi gốc, nên còn kéo
  thêm section hợp lệ của bản nội quy hiện hành ⇒ `eligible_count = 5 > 0` ⇒ KHÔNG
  rơi vào `G2` mà rơi vào `G3`. `reason_code` vẫn phải là `source_expired_or_unknown`
  — đó là lý do cổng `G3` nay cũng phân biệt, bằng `top_rejected_reason` chứ KHÔNG
  bằng histogram (histogram đếm cả chunk hết hạn xếp hạng thấp, không liên quan tới
  câu hỏi). Ba ca `W11`/`W12`/`W13` trong `tests/confidence.test.ts` canh cả hai chiều.
- **W10** là ca biên: A3 không tách được mệnh đề nào ⇒ `total = 0` ⇒ `S3 = 0` ⇒ chặn.
  Bản nháp không có gì kiểm được thì không phải câu trả lời có căn cứ.

### 6.4 — Hiển thị `[BB-05, Đ07]`

Màn hình hiển thị **lý do**, không hiển thị phần trăm. Bảng ánh xạ bắt buộc:

| `reason_code` | Câu hiển thị cho cư dân |
| :-- | :-- |
| `no_eligible_source` | *Tôi chưa có tài liệu nào đủ căn cứ để trả lời việc này. Tôi đã chuyển yêu cầu sang Ban quản lý.* |
| `source_conflict` | *Tôi tìm thấy hai tài liệu đang có hiệu lực nhưng nói khác nhau về việc này. Tôi không tự chọn một bên — đây là hai nguồn để anh/chị đối chiếu, và tôi đã chuyển sang Ban quản lý.* |
| `source_expired_or_unknown` | *Thông tin tôi tìm được nằm trong tài liệu đã hết hiệu lực từ 31/12/2025. Tôi không dùng nó để trả lời. Đã chuyển sang Ban quản lý.* |
| `pii_or_account_specific` | *Yêu cầu này chạm tới dữ liệu của cư dân hoặc căn hộ khác nên tôi không xử lý được.* |
| `legal_or_compensation_escalation` | *Việc này liên quan trách nhiệm / bồi thường, cần Ban quản lý xử lý trực tiếp.* |
| `unsupported_intent` | *Việc này nằm ngoài phạm vi tôi được hỗ trợ.* |
| `intent_unresolved` | *Tôi chưa hiểu rõ anh/chị đang hỏi về việc gì.* |
| `emergency_or_life_safety` | *Đây là tình huống khẩn cấp. Hãy gọi ngay bảo vệ toà nhà hoặc 114/115. Tôi không xử lý theo luồng hỏi đáp thông thường.* |
| `system_error` | *Hệ thống đang gặp sự cố. Anh/chị thử lại giúp, hoặc tôi chuyển sang Ban quản lý.* |
| `reviewer_rejected_draft` | *Ban quản lý đã xem và chưa đồng ý với câu trả lời này.* |

**CẤM** hiện `confidence`, `S1..S4`, thanh tiến độ tin cậy, hay biểu tượng % ở bất kỳ
đâu trong giao diện cư dân. Vai `bql` được xem số qua trang trace và dashboard — đó
là công cụ vận hành, không phải giao diện cư dân.

### 6.5 — Chỉnh ngưỡng: được và không được

- **Được chỉnh:** `TAU_ANSWER`, `TAU_FAITHFUL`, ba trọng số — nhưng phải chạy lại
  toàn bộ Golden và ghi số mới vào `plan.md` §2 kèm mốc thời gian.
- **CẤM chỉnh** ngưỡng để làm đẹp con số trên dashboard. Ngưỡng là quyết định về
  khẩu vị rủi ro, không phải nút vặn chỉ tiêu.
- **CẤM đặt `TAU_FAITHFUL = 0`** để "giảm tỉ lệ escalate". Xem lại W5.
- **CẤM hiển thị phần trăm** — không lật được (Đ07).

---

## 7. Memory — lịch sử hội thoại `[R4]`

| Hạng mục | Chốt |
| :-- | :-- |
| Lưu ở đâu | Bảng `conversations` + `messages` (`01-CONTRACTS.md` §6) |
| Bền tới đâu | Qua đăng xuất / đăng nhập lại / đổi máy. **Không** dùng `localStorage` làm nguồn chân lý |
| Ngữ cảnh đưa vào A1 | **6 lượt gần nhất**, cắt cứng. Đủ cho tham chiếu "cái sân lúc nãy", không đủ để trôi chủ đề |
| Tiêu đề hội thoại | 60 ký tự đầu của câu hỏi đầu tiên. **CẤM** gọi model để đặt tên — tốn tiền, không được chấm |
| Cô lập theo vai | `conversations.user_id` phải khớp principal. Vai `bql` **không** đọc được hội thoại của cư dân, trừ lượt đã vào `review_queue` |

**Bẫy:** ngữ cảnh 6 lượt là đầu vào của **A1**, không phải của A2. A2 chỉ nhận
`normalized_query_vi` và `eligible_chunks`. Đưa lịch sử vào A2 mở đường cho nó lấy
sự kiện từ lượt trước làm căn cứ — vi phạm BB-04 mà không ai thấy.

---

## 8. Trang trace `[R6]`

Route: `/bql/trace/[answer_turn_id]` (vai `bql`).

Hiển thị đúng ba khối, một khối một agent:

| Khối | Hiện gì |
| :-- | :-- |
| A1 `classifier` | intent, cờ safety, `missing_required_fields`, `normalized_query_vi`, model, ms, tokens |
| A2 `retriever` | số chunk vào / số eligible, danh sách `section_id` đã trích, `refused`, model, ms, tokens |
| A3 `verifier` | bảng claim × verdict × `supporting_section_id`, `faithfulness`, model, ms, tokens |

Dưới cùng: `gate_triggered`, `reason_code`, `rejection_histogram`. **Đây là màn hình
duy nhất được hiện `confidence`** — vì nó là công cụ vận hành cho vai `bql`, không
phải giao diện cư dân. Ghi rõ chú thích *"số nội bộ, chưa hiệu chuẩn"* cạnh nó.

---

## 9. Bảng phân loại lỗi & hành vi caller

| Lỗi | Khi nào | Retry | Caller BẮT BUỘC làm gì | `reason_code` ghi |
| :-- | :-- | :-- | :-- | :-- |
| `PipelineInvariantError` | A2 trích `section_id` lạ · `decision=answer` mà `citations=[]` · `steps` sai thứ tự | ❌ | Ném lên. HTTP 500. `audit_log` mức `error`. **CẤM** hạ cấp thành câu trả lời | `system_error` |
| `UpstreamRateLimited` (**429**) | Gemini API — hết hạn mức | ✅ ≤2, backoff **2s → 8s + jitter** | Hết retry → UI hiện nút *Thử lại* + *Chuyển BQL* | `system_error` |
| `UpstreamOverloaded` (**503**) | Gemini API — *"high demand"*, quá tải phía họ | ✅ ≤2, backoff **2s → 8s + jitter** | Y như 429. **CẤM gộp vào "5xx chung"** retry nhanh `[Đ19]` | `system_error` |
| `UpstreamModelError` (5xx khác 503 / timeout) | Gemini API | ✅ ≤2, backoff 1s → 3s | Như trên | `system_error` |
| `UpstreamAuthError` (**401/403**) | Khoá sai hoặc hết hạn | ❌ | Retry vô ích. **CẤM in khoá vào thông báo lỗi** | `system_error` |
| `UpstreamContentBlocked` | 200 kèm `promptFeedback.blockReason`, hoặc 0 candidate | ❌ | Cùng đầu vào cho cùng kết quả ⇒ escalate thẳng | `system_error` |
| `ContractDriftError` | `JSON.parse` hỏng · Zod hỏng · `finishReason ≠ "STOP"` | ✅ đúng 1 lần | **CẤM** vá JSON bằng regex hay `eval`. Hỏng lần 2 → dừng. **CẤM đọc `response.parsed_output`** — ở Gemini luôn `undefined` (`01-CONTRACTS.md` §8.0.2) | `system_error` |
| `RetrievalError` | pgvector/FTS index thiếu | ❌ | Lỗi cấu hình. Retry vô ích. Ghi `audit_log` mức `error` | `system_error` |
| `OwnershipViolation` | `checkOwnership` fail | ❌ | Chặn ở chặng 2, **trước** khi chạm bảng tri thức | `pii_or_account_specific` |
| `EmptyQuestionError` | chặng 1 | ❌ | HTTP 400. **KHÔNG** tạo `answer_turns` — câu rỗng không phải một lượt | — |
| `ConversationNotOwned` | `conversation_id` của người khác | ❌ | HTTP 403 | — |

**Luật xuyên suốt:** không đường nào trả màn hình trắng (`PRD` §6 NFR-02). Mọi nhánh
lỗi đều để lại cho cư dân ít nhất một nút bấm.

---

## 10. Vùng cấm của gói P02

| # | CẤM | Lý do |
| :-- | :-- | :-- |
| P02-C1 | CẤM thêm agent thứ 4 | VC-01. Rubric đòi đúng 3 |
| P02-C2 | CẤM gộp A2 + A3 | VC-02. Tự chấm bài mình viết |
| P02-C3 | CẤM truyền `question_vi` vào A3 | VC-03 |
| P02-C4 | CẤM dùng LLM quyết định eligibility hoặc phát hiện mâu thuẫn | VC-04. Luật phải tất định và giải thích được bằng SQL |
| P02-C5 | CẤM hiển thị `confidence` ở giao diện cư dân | BB-05, Đ07 |
| P02-C6 | CẤM để A2 lọc im lặng citation lạ | Che mất việc model bịa nguồn |
| P02-C7 | CẤM đổi A3 sang **cùng ID model với A2** | Người chấm không nên cùng họ với người viết (§5.2) |
| P02-C8 | CẤM cache kết quả `runTurn` theo câu hỏi | BQL đổi tài liệu phải đổi hành vi **ngay** (R7). Cache giết đúng cảnh demo đó |
| P02-C9 | CẤM streaming token ra UI | NG-10, VC-05 |
| P02-C10 | CẤM bỏ qua ghi `answer_turns` ở nhánh lỗi | BB-11. Mẫu số dashboard sai |
| P02-C11 | CẤM đưa lịch sử hội thoại vào A2 | §7, mở đường vi phạm BB-04 ngầm |
| P02-C12 | CẤM dùng `temperature` / `topP` / `topK` / `thinkingConfig` với bất kỳ agent nào | Mọi latency đã đo đều đo trên **đường mặc định** (`01-CONTRACTS.md` §8.0, `C-11`) |
| P02-C13 | CẤM dùng `gemini-3.7-flash` / `gemini-3.8-flash` | 503 ngay ở lời gọi đơn lẻ (`C-09`) |
| P02-C14 | CẤM bỏ `responseSchema`, chỉ dùng `responseMimeType` | Mất lớp ràng buộc phía nhà cung cấp — JSON đúng cú pháp nhưng sai hợp đồng (`01-CONTRACTS.md` §8.0) |
| P02-C15 | CẤM để chặng `retrieval` gọi embedding khi `KILL_SWITCH_AGENTS=1` | Phao cứu sinh sẽ gọi đúng nhà cung cấp đang hỏng (`OPERATIONS.md` §7, `OP-C14`) |
| P02-C16 | CẤM dùng `rejection_histogram` để chọn `reason_code` ở cổng `G3` | Đ28. Histogram đếm cả chunk hết hiệu lực xếp hạng THẤP, không liên quan câu hỏi ⇒ báo "tài liệu đã hết hiệu lực" cho một câu hỏi về việc khác. Đúng kiểu phát biểu bịa mà Đ09 cấm. Dùng `top_rejected_reason` |
| P02-C17 | CẤM khớp danh mục hard-block chặng 5 bằng chuỗi con | Đ31/G24. Tiếng Việt viết rời âm tiết: `"điều kiện".includes("kiện")` ⇒ chặn oan câu hỏi thường. Khớp theo âm tiết |

---

## 11. Số đo nghiệm thu

| # | Lệnh | Kết quả PASS |
| :-- | :-- | :-- |
| P02-M1 | `npm run test -- confidence` | **10/10** pass — đúng 10 dòng bảng §6.3 |
| P02-M2 | `node scripts/probe_defects.mjs` | 4 dòng `DEF-0x OK`; `reason_code` và `gate` khớp `expected_defects.json`; exit 0 |
| P02-M3 | `npm run eval:golden -- --set=safety` | `safety: >=15/16`; exit 0 |
| P02-M4 | `npm run eval:golden -- --set=faq` | `answerable: >=34/40`; exit 0 |
| P02-M5 | `npm run test -- step-order` | `steps` đúng thứ tự ở cả 9 nhánh thoát sớm |
| P02-M6 | `psql -c "select count(*) from answer_turns where citations = '[]' and decision = 'answer'"` | **0** (BB-04) |
| P02-M7 | `bash scripts/check_no_confidence_ui.sh` | `matches: 0`; exit 0 |
| P02-M8 | `npm run test -- memory` | Tạo hội thoại → xoá cookie → đăng nhập lại → đọc lại đủ số lượt |
| P02-M9 | `node scripts/trace_sample.mjs <turn_id>` | In đúng **3** khối agent, mỗi khối có `model`, `ms`, `input_tokens`, `output_tokens` khác `null` |

`P02-M6` dùng `psql`; máy dev đã đo **không có `psql`** (`00-ARCHITECTURE` §11). Dùng
bản thay thế `node scripts/sql.mjs "<query>"` — xem [`OPERATIONS.md`](OPERATIONS.md) §6.
