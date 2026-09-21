# R10 — Report thi công gói scorer chung (Đ36)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 (não đã OK, không cần nâng cấp) · hiểu việc: phạm vi = `lib/eval/score.ts` (mới), `scripts/eval_golden.mjs`, `lib/adapters/metrics-store.ts`, `evals/golden/rubric.md`, `tests/scorer-consensus.test.ts` (mới), `tests/metrics.test.ts`; xong khi = W1–W5 đạt đúng "xong khi" nêu trong lệnh phóng gói, cổng tổng (tsc/build/test/3 check_*.sh) đều exit 0, test không giảm dưới 113/0/0; cấm = chạy `eval_golden.mjs`/`probe_defects.mjs` (kể cả để lấy số G11), đụng `evals/golden/*.jsonl`/`expected_defects.json`/`lib/pipeline/**`/`lib/adapters/{db,store-mock,bql-store}.ts`/`app/**`/`db/migrations/**`/`specs/**`/`plan.md`/`brain4agent/**`/`scripts/` (trừ `eval_golden.mjs`), git add/commit/push/stash/checkout.

Handoff: lệnh phóng gói trực tiếp từ Super Orchestrator (kế tiếp `R08`, phán quyết 🔁 SỬA ghi ở cuối `reports/R08_thi-cong_p04-eval-dashboard.md`), căn cứ Đ36 (`plan.md` §2).
Base: `main` tại `b28c3f6` (khớp BASE trong lệnh phóng), cây có worker khác chạy song song — không chạm phạm vi của họ.
Head: chưa commit — mọi thay đổi ở dạng working tree, chờ Super Orchestrator đo và commit.

---

## 1. Lệnh + exit code nguyên văn (chạy cuối cùng)

```
$ npx tsc --noEmit
EXIT=0

$ node scripts/run_tests.mjs
tests 134
pass 134
fail 0
skipped 0
EXIT=0

$ node scripts/run_tests.mjs scorer-consensus
tests 6 / pass 6 / fail 0 / skip 0
EXIT=0

$ node scripts/run_tests.mjs metrics
tests 23 / pass 23 / fail 0 / skip 0
EXIT=0

$ npm run build
✓ Compiled successfully
✓ Generating static pages (4/4)
EXIT=0

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT=0

$ bash scripts/check_no_hardcoded_knowledge.sh
matches: 0
EXIT=0

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT=0

$ node scripts/validate_golden.mjs
faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10
EXIT=0
```

Output đầy đủ: `planning/01_2026-09-20_resident-agent-v1/evidence/scorer-chung/w6-gate-final.txt`.

**Test tổng/pass/fail/skip: 134/134/0/0** — cao hơn sàn 113 mà lệnh phóng gói yêu cầu (chênh lệch đến từ worker khác chạy song song: `tests/bql-upload-shape.test.ts`, sửa `tests/memory.test.ts`, KHÔNG phải việc của gói này). Riêng phần gói này đóng góp: `tests/metrics.test.ts` 23 test (từ 20 lên 23 — thêm test intent-mismatch, shows_conflict pass/fail/not-applicable), `tests/scorer-consensus.test.ts` 6 test mới.

## 2. Grep bắt buộc theo item 2 (không bên nào tự tính verdict)

```
$ grep -n "checkpoint_\|judgeFaq\|judgeSafety" scripts/eval_golden.mjs lib/adapters/metrics-store.ts
```

Mọi dòng khớp đều là **import / gọi hàm / đọc trường kết quả** (`scored.checkpoint_*`, `judgeFaqCase(c, {...})`, `export {...} from "../eval/score.ts"`) — **không còn dòng nào định nghĩa lại logic `containsAll`/`citesAll`/verdict**. `lib/adapters/metrics-store.ts` chỉ còn giữ tầng truy vấn DB (`getGoldenEvalSummary`) + tầng tổng hợp M1/M3/Relevance (`computeGoldenEvalSummary`) — cả hai đều GỌI vào `judgeFaqCase`/`judgeSafetyCase` nhập từ `lib/eval/score.ts`, không tính verdict tại chỗ. Output đầy đủ ở cuối `w6-gate-final.txt`.

## 3. Bằng chứng ĐỎ (bắt buộc theo item 3)

Đã hoàn nguyên **một bên** (`lib/adapters/metrics-store.ts`) về đúng cách chấm CŨ (bỏ `detected_intent`, bỏ `claims[].verdict`, không unaccent — y hệt lỗi mà `R09` tìm thấy ở `eval_golden.mjs` bản trước Đ36), chạy `tests/scorer-consensus.test.ts`, chụp ĐỎ, rồi revert đúng nguyên bản gộp:

```
$ node scripts/run_tests.mjs scorer-consensus   # (metrics-store.ts đã hoàn nguyên về cách chấm CŨ)
✖ FAKE-01 — sai detected_intent            AssertionError: hai đường gọi phải khớp
✖ FAKE-02 — 1 claim unsupported            AssertionError: hai đường gọi phải khớp
✖ FAKE-04 — answer mất dấu                 AssertionError: hai đường gọi phải khớp
✖ FAKE-S01 — safety answer_vi khác null    AssertionError: hai đường gọi phải khớp
tests 6 / pass 2 / fail 4
EXIT=1
```

Đúng 4/5 ca lệch (khớp với 3 checkpoint bị thiếu: `intent`, `no_unsupported_claim`, `critical_fact` — cùng gốc với 3/5 ca mà `R09` tìm thấy; FAKE-S01 lệch thêm vì bản cũ tôi dựng lại gán `checkpoint_*` = `null` thay vì tính, một khác biệt cấu trúc chứ không phải verdict). Output đầy đủ + lệnh revert:
`planning/01_2026-09-20_resident-agent-v1/evidence/scorer-chung/scorer-consensus-red.txt`.

Sau revert: `node scripts/run_tests.mjs scorer-consensus` → `6/6 pass` (mục 1). Đã xác minh `git diff` cuối cùng của `lib/adapters/metrics-store.ts` KHÔNG còn dấu vết của bản chấm cũ (chỉ còn `export {...} from "../eval/score.ts"`).

## 4. `git diff --stat` + SHA

```
BASE = b28c3f6 (khớp lệnh phóng)

 evals/golden/rubric.md        |  74 ++++++++++++++----
 lib/adapters/metrics-store.ts | 169 ++++++------------------------------------
 scripts/eval_golden.mjs       | 141 ++++++++++++++++++++++-------------
 tests/metrics.test.ts         |  90 +++++++++++++++-------
 4 files changed, 237 insertions(+), 237 deletions(-)

File MỚI:
 lib/eval/score.ts                 221 dòng
 tests/scorer-consensus.test.ts    211 dòng
 planning/.../evidence/scorer-chung/*.txt  (2 file bằng chứng)
```

`git status --porcelain` lúc đo còn hiện nhiều file KHÁC của worker song song
(`app/(bql)/documents/**`, `lib/adapters/bql-store.ts`, `tests/memory.test.ts`,
`tests/bql-upload-shape.test.ts`, report `R11`) — **tôi không chạm** file nào
trong nhóm đó. `lib/adapters/db.ts` KHÔNG bị sửa — `scripts/eval_golden.mjs`
chỉ `import { getSql }` từ nó (đọc lại `detected_intent`, xem mục 6).

## 5. Bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)

| Gói | Tầng yêu cầu | Model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 (`lib/eval/score.ts`) | 🔴 | Sonnet 5 (worker chính) | Không có model tầng đỏ khác trong phiên; đã đọc lại `SPEC-P00` §6.5 nguyên văn trước khi viết, không suy đoán checkpoint `shows_conflict` — chọn dùng `citations` làm "section hiển thị" và ghi rõ lý do + hạn chế (mục 7) thay vì tự quyết âm thầm |
| W2 (gộp `eval_golden.mjs` + `metrics-store.ts` về score.ts) | 🟠→🔴 | Sonnet 5 | Phần cơ học (import/xoá code trùng) là 🟠, nhưng phần đọc lại `detected_intent` (TurnResult không mang trường này, phải tự thiết kế đường đọc lại qua DB) là quyết định kiến trúc chưa có trong SPEC ⇒ xử lý ở tầng 🔴, ghi rõ trong mã nguồn + mục 6 report |
| W3 (`tests/scorer-consensus.test.ts`) | 🟠 | Sonnet 5 | Có bộ ca mẫu sẵn từ `R09`, chỉ cần dịch kiểu dữ liệu và viết assert |
| W4 (`rubric.md` §7/§8) | 🔴 | Sonnet 5 | Văn bản định nghĩa "G11 được tick khi nào" — không tự quyết mở vùng cấm mới, chỉ ghi lại đúng quyết định Đ36 đã có |
| W5 (cổng tổng) | 🟢 | Sonnet 5 | Chạy lệnh có sẵn, chép số |

## 6. Quyết định kỹ thuật KHÔNG có sẵn trong SPEC — đã tự quyết trong phạm vi (không hỏi lại)

**`TurnResult` (`lib/types.ts`, sinh bởi `lib/pipeline/index.ts::runTurn()`) KHÔNG tự mang `detected_intent`** — biến này chỉ sống nội bộ trong `runTurn()` để ghi DB, không lọt ra `TurnResult`. Vì `lib/pipeline/**` bị CẤM sửa, tôi không thể "thêm một trường vào TurnResult" như cách làm tự nhiên nhất. Đã chọn: `scripts/eval_golden.mjs` đọc lại `detected_intent` bằng một `SELECT` qua `getSql()` (hàm ĐÃ CÓ SẴN của `lib/adapters/db.ts`, không sửa file đó) ngay sau khi `runTurn()` ghi xong, lọc theo `conversation_id`, chỉ chạy khi `DATA_BACKEND=postgres` (kho mock không có bảng SQL này). Đọc lỗi (vd `conversation_id` không phải uuid hợp lệ) được bắt và trả `null` — checkpoint `intent` khi đó fail an toàn, không tự cho qua, và KHÔNG làm sập cả ca (không bị `runBatch` tính nhầm thành lỗi hạ tầng).

**Vì sao không sửa `lib/pipeline/index.ts` để thêm `detected_intent` thẳng vào `TurnResult`** — đó là cách "sạch" hơn về kiến trúc, nhưng `lib/pipeline/**` nằm trong danh sách CẤM tường minh của lệnh phóng gói. Đọc lại qua DB là cách duy nhất còn lại đúng phạm vi.

**Phát hiện phụ, KHÔNG sửa (ngoài phạm vi):** `scripts/eval_golden.mjs` gọi `runTurn({ conversation_id: \`golden-faq-${c.case_id}\`, ... })` — một chuỗi KHÔNG phải định dạng `uuid`. Cột `messages.conversation_id` và `answer_turns.conversation_id` đều kiểu `uuid` (`db/migrations/004_operational.sql`). Trên `DATA_BACKEND=postgres`, lệnh `INSERT INTO messages` bên trong `runTurn()` (qua `appendMessage()` ở `lib/adapters/db.ts`) nhiều khả năng ném lỗi `invalid input syntax for type uuid` — nghĩa là TOÀN BỘ `eval_golden.mjs` (không riêng phần đọc lại `detected_intent` tôi vừa thêm) có thể đang KHÔNG chạy được trên Postgres. Đây là lỗi có TRƯỚC gói này, nằm ở cách sinh `conversation_id`, không phải ở cách chấm — sửa nó đòi động vào `scripts/_fixtures.mjs`/logic sinh id của `eval_golden.mjs`, việc tôi KHÔNG được giao và **không tự làm luôn** (đúng luật "thấy việc ngoài phạm vi thì báo lên"). Ghi vào câu hỏi cần người ở mục 8. Vì luật cấm tôi chạy `eval_golden.mjs`, tôi không tự xác nhận được lỗi này bằng máy — chỉ đọc thấy bằng mắt trên mã nguồn + migration, nêu ra để người kiểm tra biết trước khi bấm chạy thật.

## 7. Hạn chế đã biết của `shows_conflict` — không phải lỗi bộ chấm

`lib/pipeline/index.ts::escalateResult()` luôn trả `citations: []` cho MỌI lượt escalate, kể cả `source_conflict` — hệ thống hiện tại không hiển thị hai section mâu thuẫn khi từ chối câu S03. `checkpoint_shows_conflict` (đã cài đủ, KHÔNG khai vùng cấm — đúng yêu cầu Đ36) vì vậy sẽ đọc `false` trên dữ liệu thật hôm nay, phản ánh ĐÚNG hành vi pipeline, không phải lỗi của `lib/eval/score.ts`. Sửa hành vi này cần sửa `lib/pipeline/**`, ngoài phạm vi gói này. Ghi chi tiết ở `evals/golden/rubric.md` §8.

## 8. Câu hỏi cần người

1. Xác nhận cách đọc lại `detected_intent` qua `getSql()` (mục 6) là chấp nhận được, hay cần một cách khác (vd thêm trường vào `TurnResult` — đòi mở phạm vi `lib/pipeline/**`).
2. `conversation_id` dạng `golden-faq-<case_id>` không phải `uuid` — có khả năng làm `eval_golden.mjs` lỗi ngay từ `INSERT INTO messages` trên `DATA_BACKEND=postgres` (mục 6, phát hiện phụ, chưa xác nhận được vì luật cấm tôi chạy script). Cần ai đó có quyền chạy `eval_golden.mjs` xác nhận trước khi dùng số G11.
3. `checkpoint_shows_conflict` sẽ luôn `false` cho tới khi `lib/pipeline/index.ts` được sửa để mang theo section mâu thuẫn lúc escalate — có cần mở gói riêng sửa việc này để `M3`/`G11` phản ánh đúng hành vi mong muốn không, hay giữ nguyên (chấp nhận `false` là đúng, vì pipeline thật sự chưa làm việc đó)?
4. Câu hỏi mở cũ từ `R08` (bảng `golden_results` theo văn tự `SPEC-P04` §3.2) vẫn treo, chưa được gói này giải quyết (khác vấn đề, xem `rubric.md` §7).

---

## Tiếp theo

🖐 Cần tay người: trả lời 4 câu hỏi ở mục 8, đặc biệt câu 2 (nghi vấn `eval_golden.mjs` lỗi ngay ở bước ghi DB trên Postgres) trước khi ai đó chạy thật để lấy số `G11`.
🤖 Agent làm được ngay: chờ lệnh — có thể sửa cách sinh `conversation_id` trong `eval_golden.mjs` (vẫn trong phạm vi file này) nếu được xác nhận đó đúng là lỗi cần sửa, hoặc mở gói sửa `lib/pipeline/index.ts` để `shows_conflict` có dữ liệu thật nếu được cấp phạm vi.
⭐ Nên làm trước: một lượt chạy tay `eval_golden.mjs --set=safety --only=S03 --limit=1` trên `DATA_BACKEND=postgres` (bởi người có quyền, không phải tôi) để xác nhận/loại trừ nghi vấn `conversation_id` ở mục 6 trước khi tin bất kỳ số `G11` nào.
⏸ Chưa làm: sửa `lib/pipeline/index.ts` để `escalateResult()` mang theo section mâu thuẫn (ngoài phạm vi); sửa cách sinh `conversation_id` trong `eval_golden.mjs` (phát hiện phụ, chưa được giao, chỉ báo lên); bảng `golden_results` theo `SPEC-P04` §3.2 (câu hỏi mở cũ từ `R08`, chưa đụng tới).

---

**Phán quyết của Super Orchestrator (2026-09-22):**

✅ DUYỆT. Đ36 được thi hành thật, không phải trên giấy: cả `scripts/eval_golden.mjs` lẫn `lib/adapters/metrics-store.ts` đều `import { judgeFaqCase, judgeSafetyCase } from "../lib/eval/score.ts"`, và SO kiểm từng dòng còn chứa `checkpoint_` ở hai file đó — tất cả đều chỉ ĐỌC `scored.*`, không nơi nào tự tính verdict. Cổng tổng 134/134, bất biến 0.

**Hai nghi vấn gói này nêu lên đều ĐÚNG, và SO đã xác nhận bằng số chứ không bằng đọc mã:**

1. `conversation_id` không phải uuid — `select 'golden-faq-S03'::uuid` trả `ERROR: invalid input syntax for type uuid`. Nghĩa là bộ chạy Golden vỡ ngay lệnh ghi đầu tiên trên Postgres. Xem Đ37. Nêu được điều này trong khi bị cấm chạy script là công của gói.
2. `citations: []` ở mọi đường escalate — xác nhận, ba chỗ trong `lib/pipeline/index.ts`. Hậu quả lớn hơn một checkpoint hỏng: `SPEC-P02` §6.4 bắt màn hình nói "đây là hai nguồn để anh/chị đối chiếu" rồi không đưa nguồn nào. Xem Đ38.

Quyết định kỹ thuật đọc lại `detected_intent` qua `getSql()` thay vì sửa `lib/pipeline/**` bị cấm: **chấp nhận**. Đó là đường vòng đúng luật, có try/catch, chỉ chạy trên `postgres`. Khi Đ37 được thi công thì xem lại có nên đưa `detected_intent` vào `TurnResult` cho gọn không.
