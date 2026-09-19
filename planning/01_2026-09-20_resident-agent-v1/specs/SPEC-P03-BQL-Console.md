# SPEC-P03 — CONSOLE BQL: VÒNG ĐỜI TÀI LIỆU & DUYỆT CÂU TRẢ LỜI (HITL)

> Tầng 🟠 · Ngày D4–D5 · Phụ thuộc P01 (auth, DB) + P02 (pipeline, `answer_turns`).
> Phụ thuộc đọc: [`01-CONTRACTS.md`](01-CONTRACTS.md) §3, §6;
> [`SPEC-P02-Agent-Pipeline.md`](SPEC-P02-Agent-Pipeline.md) §6.
> Phủ rubric **R7, R8**.

---

## 1. Hai màn hình, hai việc

| Route | Vai | Việc |
| :-- | :-- | :-- |
| `/bql/documents` | `bql` | Vòng đời tài liệu: tải lên, đổi phiên bản, đổi trạng thái, loại mục |
| `/bql/review` | `bql` | Hàng đợi HITL: Duyệt / Sửa rồi duyệt / Từ chối |

Cả hai route đi qua middleware chặn vai. Vai `resident` chạm vào ⇒ HTTP 403,
**không** trả nội dung một phần (`01-CONTRACTS.md` §9, `AuthzError`).

---

## 2. Vòng đời tài liệu `[R7]`

### 2.1 — Yêu cầu cốt lõi, đây là chỗ được chấm

> Đổi `status` hoặc `effective_status` của một tài liệu phải làm **câu trả lời liên
> quan đổi hành vi ngay trong cùng phiên demo**, không cần deploy lại, không cần
> restart, không cần seed lại.

Đây là lý do BB-10 tồn tại: tri thức là **dữ liệu có phiên bản**, không phải hằng số
trong code. Nếu nội quy nằm trong prompt thì gạch R7 không thể tick được.

### 2.2 — Server Actions

```ts
// app/(bql)/documents/actions.ts

export async function uploadDocument(input: {
  document_id: string;                  // CẤM trùng — 409 nếu đã có
  title_vi: string;
  doc_kind: "rules" | "guide" | "fee_schedule" | "directory";
  version: string;
  scope_property: Array<"apartment" | "villa" | "commercial">;
  effective_from: string;               // 'YYYY-MM-DD'
  effective_to: string | null;
  sections: Array<{
    section_id: string; ordinal: number; heading_vi: string; body_vi: string;
    intents: string[]; facility_ids: string[]; conflict_group: string | null;
  }>;
}): Promise<{ ok: true; document_id: string; chunks_created: number }
          | { ok: false; error: DocumentError }>;

export async function setDocumentStatus(input: {
  document_id: string;
  status: "Draft" | "Approved" | "Deprecated";
}): Promise<{ ok: true; reindexed: boolean } | { ok: false; error: DocumentError }>;

export async function setEffectiveStatus(input: {
  document_id: string;
  effective_status: "Current" | "Expired" | "Unknown";
  effective_to: string | null;
}): Promise<{ ok: true } | { ok: false; error: DocumentError }>;

export async function setSectionExcluded(input: {
  section_id: string;
  is_excluded: boolean;
  exclusion_note_vi: string | null;      // BẮT BUỘC non-null khi is_excluded = true
}): Promise<{ ok: true } | { ok: false; error: DocumentError }>;

export async function newDocumentVersion(input: {
  base_document_id: string;              // bản cũ
  new_document_id: string;               // bản mới, ID khác
  version: string;
  sections: UploadSection[];
}): Promise<{ ok: true; superseded: string } | { ok: false; error: DocumentError }>;
```

### 2.3 — `newDocumentVersion` làm đúng 4 việc, theo đúng thứ tự, trong MỘT transaction

1. `INSERT` tài liệu mới, `supersedes = base_document_id`, `effective_status = 'Current'`.
2. `UPDATE` tài liệu cũ: `effective_status = 'Expired'`, `effective_to = current_date - 1`.
   **Giữ nguyên `status = 'Approved'` và `allowed_for_rag = true`** — để bản cũ vẫn bị
   cổng E-2 loại (đúng cơ chế khuyết tật #4), không phải bị E-1 hay E-3 loại.
3. Chunk hoá section mới, ghi `chunks`.
4. Ghi `audit_log` sự kiện `document.version_created`.

**Vùng cấm:** CẤM `DELETE` tài liệu cũ, CẤM ghi đè bản cũ. Kế thừa
`docs/MVP_DATA_SCOPE_LOCK.md` §11 điều 1 (*"Không ghi đè hoặc xóa bản raw cũ"*).
Xoá bản cũ làm mọi `citations` lịch sử trỏ vào hư vô và dashboard mất khả năng truy vết.

### 2.4 — Chunk hoá

```ts
export function chunkSection(body_vi: string): string[];
```

| Tham số | Giá trị |
| :-- | :-- |
| Đơn vị cắt | Theo câu (dấu `.` `!` `?` + khoảng trắng), **không** cắt giữa câu |
| Kích thước mục tiêu | 250–400 ký tự |
| Chồng lấn | **0** — chồng lấn làm một sự kiện xuất hiện ở 2 chunk, `S2` bị thổi phồng |
| Section ngắn hơn 250 ký tự | Giữ nguyên một chunk |

Chunk hoá chạy **đồng bộ trong Server Action**, không đưa vào hàng đợi nền. Corpus
~97 section; đo trên máy dev thì đây là việc dưới một giây. Hàng đợi nền làm hỏng
đúng cảnh demo R7 (đổi trạng thái → hỏi lại ngay).

### 2.5 — Bảng ảnh hưởng tới retrieval

| Thao tác của BQL | Cổng eligibility chặn ở | Câu trả lời đổi thế nào |
| :-- | :-- | :-- |
| `status: Approved → Draft` | E-1 `not_approved` | Mất nguồn ⇒ `no_eligible_source` |
| `status: Approved → Deprecated` | E-1 `not_approved` | Như trên |
| `effective_status: Current → Expired` | E-2 `expired_or_unknown` | ⇒ `source_expired_or_unknown` |
| `allowed_for_rag: true → false` | E-3 `not_allowed_for_rag` | ⇒ `no_eligible_source` |
| `is_excluded: false → true` | E-4 `section_excluded` | Mục đó biến khỏi citation |
| Thêm section cùng `conflict_group` với section đang có | E-5 `conflict` | ⇒ `source_conflict` |

**Kịch bản demo R7 khuyến nghị** (đã chọn vì nó cho thấy cả hai chiều):

1. Hỏi `Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?` → trả lời, có citation
   `POOL-SAFE-03`.
2. Vào `/bql/documents`, đặt `OCP1-POOL-RULES-001` → `effective_status = Expired`.
3. Hỏi lại **cùng câu** → `source_expired_or_unknown`, không còn câu trả lời.
4. Đặt lại `Current` → hỏi lại → trả lời lại như cũ.

Ba lần hỏi cùng một câu ra ba kết quả khác nhau, không deploy lại lần nào. Đây là
bằng chứng mạnh nhất cho R7 — và là lý do P02-C8 cấm cache theo câu hỏi.

---

## 3. Hàng đợi HITL `[R8]`

### 3.1 — Cái gì vào hàng đợi

**Mọi `answer_turn` có `decision = 'escalate'`** ⇒ tự động tạo một dòng
`review_queue` với `state = 'pending'`, trong cùng transaction với `answer_turns`.

Turn có `decision = 'answer'` **không** vào hàng đợi. Lý do: sản phẩm này là **trợ lý
cư dân trả lời trực tiếp** (Đ01), không phải công cụ soạn nháp cho BQL của v0.2. Bắt
BQL duyệt từng câu trả lời tốt thì R3 (trả lời có trích dẫn) không còn nghĩa gì.

> **Khác v0.2 ở chỗ nào, và nó có mâu thuẫn không:** `PRD` §8 SR-09 nói *mọi
> substantive answer output đều là AI draft cho tới khi BQL approve*. Ràng buộc đó
> đúng với actor cũ (BQL soạn nháp gửi cư dân). Với actor mới (cư dân hỏi trực tiếp),
> giữ nguyên SR-09 nghĩa là **không có câu trả lời tự động nào**, và rubric mục
> "dashboard tỉ lệ câu hỏi tự động giải quyết" (R10) sẽ luôn bằng 0%. Đây là hệ quả
> trực tiếp của Đ01 (mục tiêu là rubric, không phải v0.2). HITL vẫn tồn tại đầy đủ và
> vẫn được chấm — nhưng nó phủ **nhánh escalate**, đúng chỗ con người thật sự cần vào.

### 3.2 — Server Actions

```ts
// app/(bql)/review/actions.ts

export async function approveAnswer(input: {
  review_id: string;
}): Promise<{ ok: true } | { ok: false; error: ReviewError }>;

export async function editAndApprove(input: {
  review_id: string;
  edited_draft_vi: string;               // ≥ 10 ký tự sau khi trim
}): Promise<{ ok: true } | { ok: false; error: ReviewError }>;

export async function rejectAnswer(input: {
  review_id: string;
  reject_reason_vi: string;              // ≥ 10 ký tự, BẮT BUỘC
}): Promise<{ ok: true } | { ok: false; error: ReviewError }>;
```

### 3.3 — Máy trạng thái `review_queue.state`

```text
                 approveAnswer()
        ┌────────────────────────────► approved
        │
pending ┼────────────────────────────► edited_approved
        │        editAndApprove()
        │
        └────────────────────────────► rejected
                 rejectAnswer()
```

**Ba trạng thái cuối đều là cuối — không có đường quay lại `pending`.** Cho quay lại
thì `resolved_at` mất ý nghĩa và số trên dashboard đếm hai lần.

| Hành động | `state` | Ghi gì thêm | Cư dân thấy gì |
| :-- | :-- | :-- | :-- |
| `approveAnswer` | `approved` | `reviewer_id`, `resolved_at` | Bản gốc, kèm nhãn **Đã được Ban quản lý duyệt** |
| `editAndApprove` | `edited_approved` | thêm `edited_draft_vi`. **Giữ nguyên `original_draft_vi`** | Bản đã sửa, cùng nhãn |
| `rejectAnswer` | `rejected` | `reject_reason_vi`; ghi `answer_turns.reason_code = 'reviewer_rejected_draft'` | *Ban quản lý đã xem và chưa đồng ý với câu trả lời này* |

**Giữ cả hai bản (gốc + đã sửa) là bắt buộc**, không phải tuỳ chọn: `SPEC-P04` §3.3
dùng chênh lệch giữa chúng làm tín hiệu relevance. Kế thừa `PRD` §5 FR-07 (*"Lưu
generated draft và edited/approved output nếu có để evaluation"*).

### 3.4 — Ràng buộc chống chạy đua

`review_queue.answer_turn_id` có `UNIQUE` (`01-CONTRACTS.md` §6). Mọi action đổi
trạng thái dùng:

```sql
UPDATE review_queue SET state = $2, reviewer_id = $3, resolved_at = now()
WHERE id = $1 AND state = 'pending'
RETURNING id;
```

Trả về 0 dòng ⇒ ai đó đã xử lý trước ⇒ trả `ReviewError.AlreadyResolved`, **không**
ghi đè. Hai tab BQL cùng mở là chuyện bình thường khi demo.

### 3.5 — Giao diện hàng đợi

Mỗi dòng phải hiện đủ, **không bắt bấm vào mới thấy**:

- Câu hỏi của cư dân
- `reason_code` + câu tiếng Việt tương ứng (`SPEC-P02` §6.4)
- Bản nháp gốc (nếu có) hoặc ghi chú từ chối của A2
- Danh sách citation, bấm mở được đoạn gốc
- Với `source_conflict`: **cả hai** section mâu thuẫn đặt cạnh nhau, CẤM chỉ hiện một
- Link sang `/bql/trace/[answer_turn_id]`

Bộ lọc tối thiểu: theo `reason_code`, theo `state`. Sắp xếp mới nhất trước.

---

## 4. Bảng phân loại lỗi & hành vi caller

| Lỗi | Khi nào | Caller BẮT BUỘC làm gì | HTTP |
| :-- | :-- | :-- | :-- |
| `DocumentError.DuplicateId` | `document_id` đã tồn tại | Hiện lỗi, giữ nguyên form. **CẤM** tự sinh hậu tố `-2` | 409 |
| `DocumentError.DuplicateSectionId` | `section_id` trùng | Như trên. Trùng làm citation trỏ nhầm tài liệu | 409 |
| `DocumentError.BodyLength` | `body_vi` ngoài [60, 900] | Chỉ đích danh `section_id` và độ dài thực | 422 |
| `DocumentError.MissingExclusionNote` | `is_excluded=true` mà note rỗng | Từ chối. Loại mục không ghi lý do là mất dấu vết | 422 |
| `DocumentError.InvalidDateRange` | `effective_to < effective_from` | Từ chối | 422 |
| `DocumentError.ChunkingFailed` | `chunkSection` trả mảng rỗng | **Rollback cả transaction.** CẤM để tài liệu có 0 chunk — nó vô hình với retrieval mà vẫn hiện trong danh sách | 500 |
| `ReviewError.AlreadyResolved` | `state ≠ 'pending'` | Nạp lại dòng, hiện trạng thái hiện tại. CẤM ghi đè | 409 |
| `ReviewError.EmptyEdit` | bản sửa < 10 ký tự | Từ chối | 422 |
| `ReviewError.EmptyRejectReason` | lý do < 10 ký tự | Từ chối. Từ chối không lý do là vô dụng cho eval | 422 |
| `AuthzError` | vai `resident` gọi action của `bql` | 403, redirect `/chat`. CẤM trả nội dung một phần | 403 |

---

## 5. Vùng cấm của gói P03

| # | CẤM | Lý do |
| :-- | :-- | :-- |
| P03-C1 | CẤM `DELETE` tài liệu hoặc section | `MVP_DATA_SCOPE_LOCK.md` §11. Citation lịch sử trỏ vào hư vô |
| P03-C2 | CẤM đặt `allowed_for_rag=false` cho bản cũ khi tạo version mới | Đổi mã trả về từ `source_expired_or_unknown` sang `no_eligible_source` (§2.3 bước 2) |
| P03-C3 | CẤM đưa `decision='answer'` vào hàng đợi duyệt | §3.1 — R10 sẽ luôn bằng 0% |
| P03-C4 | CẤM cho `rejected`/`approved` quay lại `pending` | §3.3 — dashboard đếm hai lần |
| P03-C5 | CẤM ghi đè `original_draft_vi` khi BQL sửa | `SPEC-P04` §3.3 cần cả hai bản |
| P03-C6 | CẤM chunk hoá trong hàng đợi nền | §2.4 — giết cảnh demo R7 |
| P03-C7 | CẤM dựng trình soạn thảo văn bản giàu định dạng, xem trước PDF, kéo thả | VC-11. Ô `textarea` + JSON là đủ. Không được chấm |
| P03-C8 | CẤM để vai `bql` đọc hội thoại cư dân ngoài phạm vi hàng đợi | `00-ARCHITECTURE` §6 |
| P03-C9 | CẤM tự động duyệt theo ngưỡng confidence | HITL nghĩa là có người bấm. Tự duyệt là bỏ đúng thứ đang được chấm |

---

## 6. Số đo nghiệm thu

| # | Lệnh / thao tác | Kết quả PASS |
| :-- | :-- | :-- |
| P03-M1 | `npm run test -- document-lifecycle` | 6/6 dòng bảng §2.5 đúng mã trả về |
| P03-M2 | `node scripts/demo_r7.mjs` | In 3 dòng: `1) answer POOL-SAFE-03` · `2) source_expired_or_unknown` · `3) answer POOL-SAFE-03`; exit 0 |
| P03-M3 | `npm run test -- review-state-machine` | Chuyển từ trạng thái cuối bị từ chối `AlreadyResolved` ở cả 3 đường |
| P03-M4 | `node scripts/sql.mjs "select count(*) from review_queue r join answer_turns a on a.id=r.answer_turn_id where a.decision<>'escalate'"` | **0** (P03-C3) |
| P03-M5 | `node scripts/sql.mjs "select count(*) from review_queue where state='edited_approved' and original_draft_vi is null"` | **0** (P03-C5) |
| P03-M6 | `npm run test -- authz` | Vai `resident` gọi cả 8 action ⇒ 8/8 trả 403 |
| P03-M7 | `node scripts/sql.mjs "select count(*) from documents d where not exists (select 1 from chunks c where c.document_id=d.document_id)"` | **0** (không tài liệu nào 0 chunk) |
| P03-M8 | Thao tác tay: mở 2 tab `/bql/review`, cùng bấm Duyệt một dòng | Tab thứ hai hiện `AlreadyResolved`, không đổi dữ liệu |

`P03-M2` là số đo quan trọng nhất của gói — nó chứng minh R7 bằng máy, không bằng lời.
