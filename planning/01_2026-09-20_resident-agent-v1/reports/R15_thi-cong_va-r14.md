# R15 — Thi công vá bảy phát hiện của R14 (Đ42/Đ43/Đ44)

Vai · **worker** · loại **thi công** · họ/model: Claude Sonnet 5 · Bước 0: exit **0** (não OK, không cần nâng cấp) · hiểu việc: **phạm vi** = vá 6 file đã liệt kê ở H12 §2 quanh hai bản vá Đ37/Đ38 đứng vững, KHÔNG được đụng `eligibility.ts`/`confidence.ts`/`score.ts`/`bql-store.ts`/`metrics-store.ts`/`app/**`/migration đã chạy/`knowledge/**`/`evals/golden/**`/`planning/**` khác report này/`brain4agent/**`/`package.json`; **xong khi** mỗi W1–W6 có test/lệnh + mã thoát nguyên văn đúng hợp đồng Đ42/Đ43/Đ44, W2/W3 phải tự chứng minh ĐỎ trên bản sao tạm; **cấm** `git add`/`commit`/`push`, chạy `eval_golden.mjs` toàn lượt hay `probe_defects.mjs`, thêm dependency, tick `G11`, xoá dữ liệu DB, tự đổi ngưỡng 300/sàn 80/phương án `RunTurnArgs`.

Handoff: [`handoffs/H12_va-r14-snippet-uuid-golden.md`](../handoffs/H12_va-r14-snippet-uuid-golden.md)
Base: `27c38f5c086c1d432d489e651f9b23687970e158`
Head: working tree chưa commit (theo luật CẤM commit của handoff)

## 1. Bảng W1–W6

| Gói | Làm gì | Lệnh | Mã thoát |
| :-- | :-- | :-- | :-- |
| W1 | `toSnippet()` — cắt cứng ở 299 + `…` (tổng 300); cắt theo câu CHỈ khi dấu câu ở sau sàn 80; export hàm để test gọi thẳng (`lib/pipeline/index.ts:183-197`) | `npx tsc --noEmit` | `0` |
| W2 | Test unit MỚI `tests/to-snippet.test.ts` — 7 ca (≤300 giữ nguyên · >300 không dấu câu · dấu câu sau sàn · dấu câu trước sàn `"1."` · dấu câu ở vị trí 0 · đúng 300 · đúng 301) | `node --test tests/to-snippet.test.ts` (trong repo thật, sau vá) | `0`, `pass 7` |
| W3 | `appendMessage()` + `insertAnswerTurn()` ném khi `!isValidUuid(conversation_id)` ở CẢ `PostgresDataStore` (`db.ts`) và `MockDataStore` (`store-mock.ts`); đổi 6 chỗ nhãn chữ (`tests/citations.test.ts:70,96`, `tests/pipeline-order.test.ts:67,94,109,136`) sang `conversationIdFromLabel(...)`; thêm 2 test mới canh cổng ở `tests/conversation-id.test.ts` (Postgres `insertAnswerTurn`, và Mock cả hai hàm) | `node scripts/run_tests.mjs` | `0` |
| W4 | Bỏ uuid hardcode `"86e44c36-…"` ở `tests/conversation-id.test.ts:27`(cũ) và `tests/conflict-citations.test.ts:30`(cũ) — thay bằng `findUserByEmail("resident@demo.local")` tra sống, giống `scripts/_fixtures.mjs` | `node --test tests/conversation-id.test.ts tests/conflict-citations.test.ts` | `0` |
| W5 | Thêm `is_golden_run?`/`golden_case_id?` (tuỳ chọn) vào `RunTurnArgs`; `insertAnswerTurn` ghi `args.is_golden_run ?? false`/`args.golden_case_id ?? null` thay vì ghim cứng `false`; thêm cột `golden_case_id` vào câu `INSERT` + `AnswerTurnInput`; `scripts/eval_golden.mjs` truyền `is_golden_run: true, golden_case_id: c.case_id` ở cả `judgeFaq` và `judgeSafety` | `npx tsc --noEmit` | `0` |
| W6 | Đổi tên `ensureConversationOwner` → `createConversationIfMissing` (tham số + JSDoc nói thật: KHÔNG kiểm chủ sở hữu, authz ở route) trong `DataStore` interface và `PostgresDataStore.appendMessage`; cập nhật 2 chỗ mô tả trong `tests/conversation-id.test.ts` | `grep -rn ensureConversationOwner lib/ tests/ scripts/ app/` | `0` khớp trong file được ghi (còn đúng 1 dòng comment ở `scripts/_fixtures.mjs`, NGOÀI phạm vi, không sửa) |

## 2. Bằng chứng test TỪNG ĐỎ (bắt buộc, W2 + W3)

Cả hai được đo trên **bản sao tạm** ở scratchpad (`node_modules` nối bằng Windows Junction, tháo bằng `rmdir` xong xoá thư mục — repo gốc không đổi một byte, xác nhận bằng `git status`/`git diff --stat` không đổi trước/sau).

### W2 — mutant M2 (xoá sạch giới hạn 300, y hệt phép phá của R14)
```
toSnippet mutant: return trimmed; // không còn cắt gì cả
$ node --test tests/to-snippet.test.ts
✖ toSnippet: >300 ký tự, KHÔNG có dấu câu ⇒ ... (301 !== 300)
✖ toSnippet: dấu câu nằm TRƯỚC sàn 80 ... (401 !== 300)
✖ toSnippet: chỉ MỘT dấu chấm ở vị trí 0 ... (501 !== 300)
✖ toSnippet: đúng 301 ký tự ... (301 !== 300)
ℹ tests 7
ℹ pass 2
ℹ fail 5
EXIT:1
```
Bằng chứng đầy đủ: [`evidence/va-r14/w2-mutant-toSnippet-M2-red.txt`](../evidence/va-r14/w2-mutant-toSnippet-M2-red.txt)

### W3 — mutant (tắt cổng canh uuid ở CẢ hai backend: `if (false && !isValidUuid(...))`)
```
$ node --test tests/conversation-id.test.ts
✖ Đ37/Đ43 (thật, Postgres): appendMessage với conversation_id dạng chữ THÔ ...
✖ Đ37/Đ43 (thật, Postgres): insertAnswerTurn với conversation_id dạng chữ THÔ ...
✖ Đ43 (thật, mock): appendMessage/insertAnswerTurn ... ở kho MOCK ...
ℹ tests 9
ℹ pass 6
ℹ fail 3
EXIT:1
```
Bằng chứng đầy đủ: [`evidence/va-r14/w3-mutant-uuid-gate-red.txt`](../evidence/va-r14/w3-mutant-uuid-gate-red.txt)

Sau khi đo xong, cả hai mutant bị xoá cùng bản sao tạm — không có mutant nào lọt vào repo thật (đã xác nhận: bản vá trong `lib/pipeline/index.ts`/`lib/adapters/db.ts`/`lib/adapters/store-mock.ts` của repo thật giữ nguyên bản ĐÚNG, xem cổng đo §3 dưới đây chạy XANH trên chính các file này).

## 3. Cổng đo trên repo THẬT (sau khi vá, TRƯỚC commit)

```
node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check   EXIT=0
npx tsc --noEmit                                                                             EXIT=0
npm run build                                                                                 EXIT=0
node scripts/run_tests.mjs   → tests 152 / pass 152 / fail 0 / skipped 0                      EXIT=0
check_adapter_boundary.sh    → violations: 0                                                  EXIT=0
```
Bằng chứng máy: [`evidence/va-r14/tsc-noemit.txt`](../evidence/va-r14/tsc-noemit.txt) · [`evidence/va-r14/npm_build.txt`](../evidence/va-r14/npm_build.txt) · [`evidence/va-r14/run_tests_full.txt`](../evidence/va-r14/run_tests_full.txt) · [`evidence/va-r14/check_adapter_boundary.txt`](../evidence/va-r14/check_adapter_boundary.txt)

**Tests tổng/pass/fail/skip: 152 / 152 / 0 / 0** (nền trước khi tôi bắt đầu: 143 — tăng đúng 9: 7 ca `to-snippet.test.ts` mới + 2 ca cổng canh uuid mới ở `conversation-id.test.ts`; ≥143 và 0 skip — đúng luật §4 handoff).

## 4. `git diff --stat`

```
 lib/adapters/db.ts           | 101 ++++++++++++++++++++++++++++++++++++++++---
 lib/adapters/store-mock.ts   |  20 ++++++++-
 lib/pipeline/index.ts        |  94 +++++++++++++++++++++++++++++++++++++---
 scripts/eval_golden.mjs      |  16 +++++--
 tests/citations.test.ts      |   5 ++-
 tests/pipeline-order.test.ts |   9 ++--
 6 files changed, 222 insertions(+), 23 deletions(-)
```
Cộng thêm 2 file **untracked đã sửa tiếp** (do Đ37/Đ38 để lại chưa commit, tôi sửa thêm trong phạm vi cho phép): `tests/conflict-citations.test.ts` (131 dòng, sửa W4), `tests/conversation-id.test.ts` (295 dòng, sửa W3+W4+W6). File test MỚI: `tests/to-snippet.test.ts` (67 dòng, W1+W2).
SHA (HEAD không đổi, chưa commit theo luật): `27c38f5c086c1d432d489e651f9b23687970e158`.

## 5. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :-- | :-- | :-- |
| W1–W6 (thi hành hợp đồng Đ42/Đ43/Đ44, không quyết định mới) | 🟠 | Claude Sonnet 5 — làm trọn, không giao xuống 🟢, không cần lên 🔴 (mọi con số đã chốt sẵn trong plan.md) |

## 6. Việc KHÔNG làm + lý do

- **Không sửa `scripts/_fixtures.mjs`** dù nó còn 1 dòng comment nhắc tên cũ `ensureConversationOwner` (dòng 9) — file này KHÔNG nằm trong danh sách "được ghi" của H12 §2. Ghi lại ở đây làm việc ngoài phạm vi, không tự sửa.
- **Không chạy `scripts/eval_golden.mjs` toàn lượt hay `probe_defects.mjs`** — đúng vùng cấm H12 §2 (hạn mức Gemini đã cạn) và Đ36.
- **Không dọn/xoá dữ liệu `answer_turns`/`conversations` nhiễm test** — CẤM xoá dữ liệu DB theo H12 §2, đây là quyết định của chủ tịch (Luật L.3).
- **Không tick `G11`** ở bất kỳ đâu — đúng CẤM của H12 §2.
- **Công khai phần tự thêm vào DB thật:** các lượt test Postgres (`conflict-citations`, `conversation-id`, 2 lần chạy đầy đủ `run_tests.mjs` trên repo thật, cộng 2 lần chạy `conversation-id.test.ts` trên bản sao tạm để đo ĐỎ/XANH W3) đã ghi thêm dữ liệu thật. Đo trước khi tôi bắt đầu (R14 phụ lục): `answer_turns 239`. Đo sau khi tôi xong: **`answer_turns 263 · conversations 297`**. Không có hàng nào bị xoá (chỉ tăng, đúng cơ chế `--resume`/tất định của `conversationIdFromLabel` nên không đẻ hội thoại trùng cho cùng nhãn cố định, riêng ca e2e/resume dùng nhãn có `Date.now()` nên mỗi lần chạy đẻ hội thoại mới — đúng như thiết kế của chính test đó).
- **Không đổi `SNIPPET_SENTENCE_FLOOR`/ngưỡng 300/phương án `RunTurnArgs`** — đúng hợp đồng Đ42/Đ44, không tự quyết thay.

## 7. Câu hỏi cần người quyết

Không có — mọi chỗ đụng tới đều được Đ42/Đ43/Đ44 phủ đủ, không gặp trường hợp ngoài hợp đồng cần dừng hỏi.

## 8. Ghi chú kỹ thuật cho người thẩm định kế tiếp

- Cột `golden_case_id` đã tồn tại từ `004_operational.sql:47` nhưng câu `INSERT` cũ của `insertAnswerTurn` **chưa từng liệt kê nó** — không chỉ thiếu tham số ở `RunTurnArgs`, mà thiếu cả ở câu SQL. Đã vá cả hai lớp (interface `AnswerTurnInput` + câu `INSERT ... VALUES ($1..$15)`).
- `MockDataStore.appendMessage`/`insertAnswerTurn` nay import `isValidUuid` (giá trị, không phải type) từ `db.ts` — tạo một vòng import lẫn nhau về mặt tĩnh (`store-mock.ts` import `db.ts`, `db.ts` import động `store-mock.ts` bên trong `getDataStore()`). An toàn vì `db.ts` được nạp và chạy xong thân module (định nghĩa `isValidUuid`) TRƯỚC khi `import("./store-mock.ts")` động ở `getDataStore()` được gọi lần đầu — đã xác nhận bằng test XANH (`tests/pipeline-order.test.ts`, `tests/citations.test.ts` chạy backend mock).

---

**Kết quả của tôi (thi công, không phải thẩm định — đây là số đo, không phải tự tuyên bố ĐẠT cổng):** cả 6 gói W1–W6 xong, bằng chứng ĐỎ có cho W2/W3, cổng `tsc`/`build`/test/adapter-boundary đều XANH trên repo thật, test không giảm (152 ≥ 143), 0 skip. Đề xuất người duyệt đo lại độc lập trước khi commit.

✅ DUYỆT (theo số đo ở trên; người duyệt tự chạy lại theo Luật K.5 trước khi commit)
