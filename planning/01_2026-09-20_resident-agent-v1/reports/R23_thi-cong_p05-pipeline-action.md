# R23 — THI CÔNG — P05: hợp đồng A1 `action` + nhánh `action` trong pipeline + dashboard

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: claude-opus-5 (1M) · Bước 0: exit 0 · hiểu việc: phạm vi ghi = `lib/pipeline/**`, phần classifier của `lib/adapters/model.ts`, `lib/reason-messages.ts`, chỗ đếm `auto_resolved` của `lib/adapters/metrics-store.ts`, 2 file test `tests/p05-pipeline-*.test.ts` + `tests/_fake-simbackend.ts`, thư mục evidence; xong khi = `tsc` exit 0, bộ test ≥184 + test mới với 0 fail 0 skip, `check_adapter_boundary.sh` in `violations: 0`, `check_no_confidence_ui.sh` in `matches: 0`, và 5 ca (a)–(e) của W2 xanh trên backend giả; CẤM = chạm `lib/simbackend/**` (H19) và `app/**`/`scripts/**` (H21), CẤM `git add/commit/push`, CẤM thêm agent thứ 4, CẤM để agent thử lệnh ghi để dò luật, CẤM retry khi `WriteTimeout`, CẤM dùng kết quả hành động làm căn cứ cho phát biểu nội quy, CẤM lộ `confidence` ra UI.
Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H20_p05-pipeline-action.md`
Base: `9cd093c`
Head: `71ce548` (working tree, chưa commit — SO commit chen vào giữa phiên nên HEAD đã nhích khỏi base)

## Bước 0

```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
👉 Trạng thái: NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!
EXIT=0
```

## Lệnh đã chạy + exit code nguyên văn

```
$ npx tsc --noEmit   (nền, trước khi sửa gì)
TSC_EXIT=0
```

```
$ node --env-file=.env.local scripts/run_tests.mjs   (nền, trước khi sửa gì)
ℹ tests 184 · pass 184 · fail 0 · skipped 0
EXIT=0
```
(evidence: `evidence/h20-pipeline-action/00_baseline_tests.txt`)

```
$ npx tsc --noEmit   (cuối phiên, toàn dự án)
tests/p05-idempotency.test.ts(89,19): error TS2352 …
tests/p05-idempotency.test.ts(95,19): error TS2352 …
tests/p05-precheck-guard.test.ts(83,19): error TS2352 …
EXIT=2
```
**Cả 3 lỗi nằm trong 2 file test của gói H19 đang thi công dở, KHÔNG thuộc phạm vi H20.**
Lọc theo phạm vi H20 ⇒ `(không có lỗi nào thuộc phạm vi H20)`.
(evidence: `evidence/h20-pipeline-action/02_typecheck.txt`)

```
$ npx tsc --noEmit <cùng cờ tsconfig> lib/pipeline/action.ts lib/pipeline/index.ts \
    lib/adapters/model.ts lib/reason-messages.ts lib/adapters/metrics-store.ts \
    tests/_fake-simbackend.ts tests/p05-pipeline-action.test.ts tests/p05-pipeline-a1-action.test.ts
EXIT=0
```
(evidence: `evidence/h20-pipeline-action/07_typecheck_h20_scope.txt`)

```
$ node --env-file=.env.local scripts/run_tests.mjs   (cuối phiên, toàn bộ)
ℹ tests 226 · pass 224 · fail 2 · skipped 0
EXIT=1
✖ P05-M4/M5 (mock): 2 lần cùng idempotency_key ⇒ 1 booking, 1 receipt, lần 2 duplicate:true
✖ P05-M4/M5 (postgres): 2 lần cùng idempotency_key ⇒ 1 dòng bookings, 1 dòng receipts
```
**Cả 2 ca đỏ thuộc `tests/p05-idempotency.test.ts` của H19 đang thi công dở.**
(evidence: `evidence/h20-pipeline-action/03_tests_full.txt`)

```
$ DATA_BACKEND=mock node --env-file=.env.local --test <toàn bộ tests/ TRỪ 2 file H19 đang dở>
ℹ tests 222 · pass 222 · fail 0 · skipped 0
EXIT=0
```
(evidence: `evidence/h20-pipeline-action/08_tests_excl_h19_inflight.txt`)

```
$ node scripts/run_tests.mjs p05-pipeline      → tests 22 · pass 22 · fail 0 · skipped 0 · EXIT=0
$ node scripts/run_tests.mjs pipeline-order    → tests  5 · pass  5 · fail 0 · skipped 0 · EXIT=0
$ node scripts/run_tests.mjs g3-on-topic       → tests  8 · pass  8 · fail 0 · skipped 0 · EXIT=0
$ node scripts/run_tests.mjs pii-other-party   → tests  6 · pass  6 · fail 0 · skipped 0 · EXIT=0
$ node scripts/run_tests.mjs metrics           → tests 23 · pass 23 · fail 0 · skipped 0 · EXIT=0
$ node scripts/run_tests.mjs adapter           → tests 12 · pass 12 · fail 0 · skipped 0 · EXIT=0
$ node scripts/run_tests.mjs citations         → tests  4 · pass  4 · fail 0 · skipped 0 · EXIT=0
$ node scripts/run_tests.mjs risk-gate         → tests  5 · pass  5 · fail 0 · skipped 0 · EXIT=0
```
(evidence: `evidence/h20-pipeline-action/05_targeted_tests.txt`)

```
$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT=0

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT=0
```
(evidence: `evidence/h20-pipeline-action/04_gates.txt`)

## Test: tổng / pass / fail / skip

| Phép đo | Tổng | Pass | Fail | Skip |
| :-- | --: | --: | --: | --: |
| Nền (base `9cd093c`) | 184 | 184 | 0 | 0 |
| Bộ test H20 mới (`p05-pipeline*`) | 22 | 22 | 0 | 0 |
| Toàn bộ, trừ 2 file H19 đang dở | 222 | 222 | 0 | 0 |
| Toàn bộ, gồm cả file H19 đang dở | 226 | 224 | **2 (của H19)** | 0 |

Số test **không giảm** (184 → 222) và **0 skip** ở mọi lần chạy.

## Bộ đo mới — bằng chứng TỪNG ĐỎ

Mỗi lần pha hỏng **cài đặt sản phẩm** (không sửa test), chạy lại, rồi phục hồi nguyên trạng
(`action.ts restored identical: true`). Evidence: `evidence/h20-pipeline-action/01_red_proofs.txt`.

| # | Phép phá | Vi phạm luật nào | Kết quả | Ca bị đỏ |
| :-- | :-- | :-- | :-- | :-- |
| red-a | gọi `checkEligibility` TRƯỚC `getBookingPolicy` | BB-03 / VC-10 / P05-C7 | EXIT=1, fail 2 | (a), (b) |
| red-b | nới `IntakeFacts` cho lọt `operating_hours` rồi nói giờ mở cửa | BB-02 / P05-C6 | EXIT=1, fail 2 | (b), (b′) |
| red-d | retry lệnh ghi khi `WriteTimeout` | P05-C10 | EXIT=1, fail 2 | (d), (d′) |
| red-c | huỷ luôn ở lượt 1, không hỏi xác nhận | B2 / §7 `IrreversibleUnconfirmed` | EXIT=1, fail 1 | (c) |
| red-e | ánh xạ `Forbidden` thành `decision='action'` | Đ06 + BB-11 | EXIT=1, fail 1 | (d″) |
| red-w1 | bỏ `action` khỏi `CLASSIFIER_RESPONSE_SCHEMA.required` | schema-parity (T-PARITY/R12) | EXIT=1, fail 1 | W1 schema-parity |

## `git diff --stat` + SHA

Base `9cd093c` · Head `71ce548` · **chưa commit** (handoff CẤM `git add/commit/push`).

```
 lib/adapters/metrics-store.ts |  25 +++++++++-
 lib/adapters/model.ts         | 103 +++++++++++++++++++++++++++++++++++++++++-
 lib/pipeline/index.ts         |  70 ++++++++++++++++++++++++++--
 lib/reason-messages.ts        |  18 ++++++--
 4 files changed, 204 insertions(+), 12 deletions(-)
```

File tạo mới của H20:

| File | Dòng |
| :-- | --: |
| `lib/pipeline/action.ts` | 718 |
| `tests/p05-pipeline-action.test.ts` | 463 |
| `tests/_fake-simbackend.ts` | 254 |
| `tests/p05-pipeline-a1-action.test.ts` | 218 |
| `planning/…/evidence/h20-pipeline-action/*.txt` | 8 file |

**`lib/types.ts` KHÔNG bị sửa một dòng nào** — hợp đồng đã có sẵn đủ (`ActionRequest`,
`ActionResult`, `TurnResult.action_result`, `PipelineStep.step: 'action'`), không phải
thêm trường tuỳ chọn nào. Mọi file còn lại trong `git status` (`app/**`, `scripts/**`,
`lib/simbackend/**`, `db/**`, `README`, `presentation/**`) là của H19/H21 chạy song song —
H20 **không chạm**. (evidence: `evidence/h20-pipeline-action/06_diffstat.txt`)

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 — hợp đồng A1 `action` | 🔴 | claude-opus-5 (1M) | đổi hợp đồng đã duyệt ⇒ tự làm, không hạ tầng |
| W2 — chặng `action` trong `runTurn()` | 🔴 | claude-opus-5 (1M) | nhánh pipeline + ánh xạ 9 mã lỗi ⇒ tự làm |
| W3 — dashboard + câu tiếng Việt | 🟠 | claude-opus-5 (1M) | **LÊN một tầng**: không có model 🟠 tách rời trong phiên này; W3 chạm cùng 2 file mà W1/W2 vừa sửa, tách ra một worker khác là mời xung đột ghi |
| W4 — cổng chung | 🟢 | claude-opus-5 (1M) | chạy lệnh, cùng lý do trên |

## THAY ĐỔI HỢP ĐỒNG A1 — nguyên văn, để SO cập nhật `01-CONTRACTS` §8.1

**1. `ClassifierOutputSchema` (Zod) thêm đúng một khoá:**

```ts
export const ActionRequestSchema = z.object({
  capability: z
    .enum(["amenity.create_booking", "amenity.cancel_booking", "amenity.list_my_bookings"])
    .nullable(),
  facility_hint_vi: z.string().nullable(),
  slot_start: z.string().nullable(),
  slot_end: z.string().nullable(),
  party_size: z.number().nullable(),
  booking_ref: z.string().nullable(),
  confirmed: z.boolean(),
});

export const EMPTY_ACTION_REQUEST = {
  capability: null, facility_hint_vi: null, slot_start: null, slot_end: null,
  party_size: null, booking_ref: null, confirmed: false,
} as const satisfies ActionRequest;

// trong ClassifierOutputSchema:
  action: ActionRequestSchema.default({ ...EMPTY_ACTION_REQUEST }),
```

**2. `CLASSIFIER_RESPONSE_SCHEMA`** thêm `action` vào `properties`, vào `required` và vào
`propertyOrdering` (giữ parity với Zod — `tests/adapter.test.ts::schema-parity` vẫn xanh).
`capability` là `STRING` + `enum` 3 giá trị + `nullable: true`; `party_size` là `INTEGER`
+ `nullable: true`.

**3. `ClassifierInput` thêm một trường BẮT BUỘC:**

```ts
export interface ClassifierInput {
  question_vi: string;
  conversation_tail: Array<{ role: "user" | "assistant"; content_vi: string }>;
  principal_summary: { owned_property_ids: string[]; property_type: string[] };
  server_time: string;   // MỚI — ISO-8601 CÓ offset "+07:00", tôn trọng SIM_NOW
}
```
`runClassifier` chỉ có đúng một nơi gọi (`lib/pipeline/index.ts`), nên để `server_time`
bắt buộc chứ không tuỳ chọn — tuỳ chọn thì quên truyền sẽ im lặng và cảnh 23:39 sai lệch
7 tiếng mà không ai đỏ.

**4. Prompt A1 thêm khối `TRƯỜNG "action"`** — 3 capability, quy tắc `capability = null`
cho câu HỎI, quy tắc `confirmed = true` cho câu xác nhận trống, quy đổi `slot_start` từ
`server_time`, `intent = I-03` cho câu yêu cầu tiện ích, và **`party_size` mặc định 1 khi
cư dân không nói số người**.

**5. Tương thích ngược:** A1 cũ (và mọi transport giả viết trước Đ48) không trả `action`
⇒ Zod `.default()` điền `EMPTY_ACTION_REQUEST` ⇒ lượt hỏi–đáp thường đi y như cũ.
Đã đo: `pipeline-order` 5/5, `g3-on-topic` 8/8, `pii-other-party` 6/6, `citations` 4/4 đều xanh.

## Quyết định thiết kế cần người duyệt biết

1. **`party_size` mặc định 1 nằm ở PROMPT A1, không nằm ở pipeline.** Handoff W2 bảo
   thiếu `party_size` ⇒ `clarify`, nhưng kịch bản §9 bước 1 (*"Đặt giúp tôi sân bóng bàn
   9 giờ sáng mai"*) không có số người mà bước 4 lại phải ra `blocked`, không phải
   `clarify`. Giải bằng cách để A1 điền 1; pipeline vẫn `clarify` khi thật sự `null`
   (A1 cũ). Hai yêu cầu cùng thoả.
2. **`write_calls` đếm LỜI GỌI ghi, không đếm bản ghi.** `createBooking` bị backend từ
   chối (`ok:false`) vẫn tính `write_calls: 1` vì lệnh đã phát đi; bị policy chặn trước
   khi gọi thì `0`. Khớp `ActionResult.write_calls` ("0 khi blocked" — blocked ở đây là
   blocked-trước-khi-ghi) và khớp P05-M8.
3. **BB-02 được canh bằng KIỂU, không bằng mắt.** `blockedMessageVi()` nhận
   `IntakeFacts = Pick<BookingPolicy, "server_time"|"facility_name_vi"|"intake_windows"|
   "next_intake_open_at"|"slot_calendar">` — cố tình KHÔNG có `operating_hours`. Muốn nói
   giờ mở cửa phải sửa kiểu trước, và đó là red-b.
4. **Không có `assertCitedOrEscalate()` trong repo.** Bất biến đó đang tồn tại dưới dạng
   một kiểm tra nội tuyến ở cuối nhánh `answer` (`citations.length === 0` ⇒
   `PipelineInvariantError`). Nhánh `action` thoát ở chặng 6′ nên không bao giờ chạm nó;
   đã ghi chú tường minh tại chỗ kiểm để agent sau không "sửa lại cho tốt hơn".
5. **Import tách đôi khỏi `lib/simbackend/`.** `action.ts` lấy kiểu/hằng/lớp lỗi từ
   `./contract.ts` và CHỈ lấy `getSimBackend` từ `./index.ts`. Giữa phiên, H19 đã có lúc
   bỏ `export * from "./contract.ts"` khỏi `index.ts` và làm đỏ `app/api/actions/undo/logic.ts`
   của H21; tách import khiến H20 miễn nhiễm với việc H19 đổi danh sách re-export.
6. **`getSimBackend()` được gọi bằng `await`** dù H19 vừa đổi nó thành đồng bộ — `await`
   chạy đúng với cả hai chữ ký, nên không cần sửa lại khi H19 chốt.

## Việc KHÔNG làm + lý do

| Việc | Vì sao không làm |
| :-- | :-- |
| Ghi thật vào bảng `audit_log` khi `WriteTimeout` | Không có đường dùng lại: mọi `INSERT INTO audit_log` nằm trong CTE của `lib/adapters/bql-store.ts`, và cả `bql-store.ts` lẫn `db.ts` đều trong **CẤM chạm** của H20. Đã làm sink đổi được (`__setActionAuditSinkForTesting`) in đúng hình dạng dòng audit ra stderr và test đếm được. **Việc treo: thêm một hàm ghi `audit_log` vào `DataStore`** rồi nối sink vào đó. |
| Thêm dòng `action` vào JSX của dashboard | `app/**` là phạm vi H21. Đã mở sẵn số liệu: `AutoResolutionSummary.actioned` và `IntentBreakdownEntry.actioned`. **Việc treo cho H21/SO: render 2 trường này.** |
| Sửa `SPEC-P04` §3 và `01-CONTRACTS` §8.1 | Worker không viết SPEC. Nội dung cần chép đã nêu nguyên văn ở mục "THAY ĐỔI HỢP ĐỒNG A1" trên. |
| Tích hợp thật với backend H19 | Handoff §4 nói rõ SO sẽ chạy tích hợp khi H19 xong. H20 đo bằng backend giả. |
| Sửa 2 file test đỏ của H19 | Ngoài phạm vi. Đã báo lên ở mục dưới. |
| Đổi `lib/types.ts` | Không cần — hợp đồng đã đủ. |
| `git add` / `commit` / `push` | Handoff CẤM. |

## Việc ngoài phạm vi phát hiện được (báo, không tự sửa)

1. `tests/p05-idempotency.test.ts` (H19) — 2 ca đỏ `P05-M4/M5` (mock + postgres) và 2 lỗi
   `tsc` TS2352 ở dòng 89, 95.
2. `tests/p05-precheck-guard.test.ts` (H19) — 1 lỗi `tsc` TS2352 ở dòng 83.
3. Giữa phiên, `lib/simbackend/index.ts` (H19) đã có lúc import `./facilities-seed.ts`
   chưa tồn tại và bỏ `export * from "./contract.ts"`, làm đỏ `app/api/actions/undo/logic.ts`
   (H21). Đến cuối phiên H19 đã vá; ghi lại vì đó là bề mặt ba gói cùng dựa vào.

## Câu hỏi cần người

1. **`write_calls` khi lệnh ghi bị backend TỪ CHỐI** — H20 tính `1` (đã phát lệnh). Nếu
   dashboard muốn "số bản ghi thật sự tạo" thì phải là `0`; hai cách đọc cho hai con số
   khác nhau ở P05-M8. Chốt giúp một cách.
2. **`confirmed = true` kèm `capability = 'amenity.cancel_booking'` mà KHÔNG có hành động
   chờ** — H20 cho chạy thẳng `getBookingDetail` → `cancelBooking(confirmed: true)`, đúng
   Đ48 mục 5 (nút *Hoàn tác* là xác nhận tường minh). Nếu muốn mọi lệnh huỷ từ CHAT đều
   phải qua hai lượt kể cả khi câu chat có chữ "xác nhận", nói để siết lại.
3. **Cổng W4 `tsc` exit 0** hiện bị 2 file test của H19 chặn. H20 sạch trong phạm vi
   (evidence 07). Cần H19 vá rồi SO đo lại toàn cục.

---

✅ **DUYỆT trong phạm vi H20** — W1/W2/W3 xong, W4 xanh hết trừ một mục không do H20 gây ra:
22/22 test mới xanh, 222/222 toàn bộ (trừ 2 file H19 đang dở), 0 skip, `tsc` exit 0 trên
phạm vi H20 (exit 2 toàn cục, cả 3 lỗi thuộc 2 file test của H19), `violations: 0`,
`matches: 0`, 6 phép đỏ đều bắt được. Cổng `tsc` toàn cục chỉ đóng được sau khi H19 vá —
SO đo lại. Còn treo: ghi `audit_log` thật, render `actioned` trên dashboard, tích hợp với
backend H19 — đã nêu ở trên.
