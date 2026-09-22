# R11 — Thi công: vá lỗ hổng độ phủ P02-C10 (nhánh `clarify`)

Handoff: (bàn giao bằng lời từ SO, tiếp nối gói `handoffs/H06_bb11-memory-answer-turns.md` cùng phiên, không có file riêng)
Base: `main` tại `b28c3f6224dde71f7d92796a15362181654ca3b4` (đo lại 2026-09-22 từ `git log -- tests/memory.test.ts`)
Head: `1ab937de714540d52dc99133389b12980fd8d6e8` (commit sau đó gộp cả gói này và R12, xem `git show --stat 1ab937d`)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude, Sonnet 5 (claude-sonnet-5) · Bước 0: không chạy lại trong gói nối tiếp này (đã xác nhận exit 0 ở R06 cùng phiên, cây không đổi cấu trúc não) · hiểu việc: thêm ca canh nhánh `clarify` của `runTurn` vào `tests/memory.test.ts` (một lượt kết thúc ở chặng 4 vẫn phải ghi đúng 1 `answer_turns`, `decision='clarify'`, `lifecycle_state='clarification_required'`), chứng minh ca đó từng ĐỎ đúng bằng phép phá đã lọt qua ở `R09` mục C, rà đủ các đường thoát sớm khác của `runTurn` và nêu đường nào có ca canh. Phạm vi CHỈ `tests/memory.test.ts` và `lib/pipeline/index.ts` (chỉ nếu thật sự thiếu ghi — kết luận: KHÔNG thiếu, mã đã ghi đúng, chỉ thiếu test); CẤM đụng `lib/adapters/metrics-store.ts`, `scripts/eval_golden.mjs`, `lib/eval/**`, `app/(bql)/**`, `lib/adapters/bql-store.ts`.

## Lệnh + exit code (nguyên văn)

| Lệnh | Exit |
| :-- | :-- |
| `node scripts/run_tests.mjs memory` (sau khi thêm ca) | 0 — 5/5 pass |
| `node scripts/run_tests.mjs memory` (đã bơm lại phép phá `if (decision !== "clarify")`) | 1 — 4 pass / **1 fail đúng ca mới** |
| `node scripts/run_tests.mjs memory` (đã hoàn nguyên) | 0 — 5/5 pass |
| `npx tsc --noEmit` (toàn repo) | 0 |
| `npm run build` | 0 |
| `node scripts/run_tests.mjs` (= `npm test`, toàn repo) | 0 — 117 pass / 0 fail / 0 skip (chạy lặp lại 2 lần để xác nhận ổn định, cả hai lần đều 117/0/0) |
| `bash scripts/check_adapter_boundary.sh` | 0 — `violations: 0` |
| `bash scripts/check_no_confidence_ui.sh` | 0 — `matches: 0` |
| `bash scripts/check_no_hardcoded_knowledge.sh` | 0 — `matches: 0` |

Ghi chú một lần chạy `npm test` KHÔNG lặp lại được (transient): giữa phiên đo thấy đúng 1 lần `tests/metrics.test.ts` báo `0 !== 1` ở `computeGoldenEvalSummary`, nhưng tổng kết cuối `run` đó VẪN in `pass 117 / fail 0` — nghi là ghi đè checkpoint/DB dùng chung giữa `tests/metrics.test.ts` (thuộc gói khác, `lib/adapters/metrics-store.ts` đang có người sửa song song) và một script khác đang chạy cùng lúc, KHÔNG liên quan `tests/memory.test.ts`. Đã chạy lại 2 lần liên tiếp ngay sau đó, cả hai lần đều sạch 117/117. Không sửa `tests/metrics.test.ts` (ngoài phạm vi).

## Test tổng/pass/fail/skip

`node scripts/run_tests.mjs memory` (5 ca của gói này): **5 pass / 0 fail / 0 skip.**
`npm test` (toàn repo, 2 lượt liên tiếp để xác nhận không phải may rủi): **117 pass / 0 fail / 0 skip** cả hai lượt.

## `git diff --stat` + SHA

`HEAD`: `b28c3f6224dde71f7d92796a15362181654ca3b4` (base do điều phối viên chỉ định, cây sạch lúc nhận gói).

```
 tests/memory.test.ts | 64 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 64 insertions(+)
```

`lib/pipeline/index.ts`: **0 dòng khác HEAD** — đã tự hỏi "có thật sự thiếu ghi không?" trước khi sửa, đọc lại mã (`finally` ghi `insertAnswerTurn` KHÔNG có điều kiện nào quanh nó, chỉ có điều kiện quanh việc tạo `assistant message`), kết luận mã ĐÃ ghi đúng ở nhánh `clarify` — cái thiếu là TEST, không phải mã. Không sửa `lib/pipeline/index.ts`. Đã dùng file này để **tạo bằng chứng ĐỎ** (chèn tạm đúng phép phá của R09 mục C, chạy test, hoàn nguyên) — xác nhận hoàn nguyên sạch bằng `git diff --stat -- lib/pipeline/index.ts` rỗng.

Thư mục evidence mới: `planning/01_2026-09-20_resident-agent-v1/evidence/bb11-clarify/clarify-red-green.txt`.

`git status --short` tại thời điểm báo cáo (xác nhận không đụng file ngoài phạm vi):

```
 M lib/adapters/metrics-store.ts     ← worker khác (KHÔNG đụng)
 M tests/memory.test.ts              ← GÓI NÀY
?? lib/eval/                         ← worker khác (KHÔNG đụng)
?? planning/.../evidence/bb11-clarify/  ← GÓI NÀY
```

## Bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)

| Gói | Tầng yêu cầu | Model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| Thêm ca canh nhánh `clarify` (việc 1+2) | 🟠 | Sonnet 5 | Có SPEC (SPEC-P02 §2 chặng 4, 01-CONTRACTS §6 `lifecycle_state`/`decision`) + phép phá đã biết chính xác từ R09 mục C — tự đo đúng/sai bằng SQL thật, không cần quyết định kiến trúc mới |
| Rà đủ đường thoát của `runTurn` (việc 3) | 🟠 | Sonnet 5 | Đọc mã, liệt kê tất định, lập luận dựa trên cấu trúc `finally` đã có — không cần quyết định mới, chỉ cần đọc kỹ |
| Cổng tổng (việc 4) | 🟢 | Sonnet 5 | Chạy lệnh có sẵn, chép số |

## Việc 3 — Rà đủ các đường thoát sớm của `runTurn`

Đọc lại toàn bộ thân hàm (`lib/pipeline/index.ts`), liệt kê ĐÚNG 15 điểm thoát (dòng số theo file hiện tại):

| # | Dòng | Chặng | Loại thoát | Giá trị `decision` / có ném lỗi | Có ca canh DB-write? |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | 195 | 1 — validate | `throw EmptyQuestionError` | — (KHÔNG tạo `answer_turns`, đúng SPEC-P02 §9) | Có — `tests/pipeline-order.test.ts` (`assert.rejects`, EmptyQuestionError) canh KHÔNG có step nào được đẩy; không cần canh DB vì SPEC nói rõ không ghi |
| 2 | 290 | 2 — safety (emergency) | `return finish(escalate)` | `escalate` | **Chung nhóm `escalate`** — xem lập luận dưới |
| 3 | 295 | 2 — safety (ownership) | `return finish(escalate)` | `escalate` | Chung nhóm `escalate` |
| 4 | 299 | 2 — safety (legal do A1 gắn cờ) | `return finish(escalate)` | `escalate` | Chung nhóm `escalate` |
| 5 | 311 | 3 — intent (unsupported) | `return finish(escalate)` | `escalate` | Chung nhóm `escalate` |
| 6 | 314 | 3 — intent (unresolved) | `return finish(escalate)` | `escalate` | Chung nhóm `escalate` |
| 7 | 322 | 4 — context (missing fields) | `return finish({decision:"clarify",...})` | `clarify` | **CA MỚI của R11** (trực tiếp) |
| 8 | 339 | 5 — risk (hard-block pháp lý) | `return finish(escalate)` | `escalate` | **CA TRỰC TIẾP** — test "risk gate ở chặng 5" (đã có từ R06) |
| 9 | 369 | 7 — eligibility (conflict/zero) | `return finish(escalate)` | `escalate` | Chung nhóm `escalate` (không test trực tiếp riêng, xem lập luận) |
| 10 | 402 | 8 — draft (A2 trích section lạ) | `throw PipelineInvariantError` | — (`outcome` undefined ⇒ `failed`) | Chung nhóm "ném lỗi" |
| 11 | 417 | 8 — draft (A2 refused) | `return finish(escalate)` | `escalate` | Chung nhóm `escalate` |
| 12 | 453 | 9 — verify (gate G4/G5) | `return finish(escalate)` | `escalate` | Chung nhóm `escalate` |
| 13 | 461 | 9 — verify (BB-04 citations rỗng) | `throw PipelineInvariantError` | — (`outcome` undefined ⇒ `failed`) | Chung nhóm "ném lỗi" |
| 14 | 464 | 9 — verify (thành công) | `return finish({decision:"answer",...})` | `answer` | **CA TRỰC TIẾP** — test "R4/W3: hai messages..." (đã có từ R06) |
| — | bất kỳ | bất kỳ | ném lỗi upstream (429/503/…) chưa bắt | — (`outcome` undefined ⇒ `failed`) | **CA TRỰC TIẾP** — test "nhánh NÉM LỖI (429 hết retry ở A2)" (đã có từ R06) |

**Lập luận vì sao KHÔNG cần một ca riêng cho từng dòng trong 15 điểm trên (áp dụng đúng câu "hoặc ghi rõ vào report vì sao không cần" của việc 3):**

Khối `finally` (nơi `insertAnswerTurn` được gọi) đọc DUY NHẤT hai thứ để quyết định ghi gì:
`finalResult.decision` (chỉ nhận 1 trong 3 giá trị: `answer` / `clarify` / `escalate`, lấy từ `outcome ?? {decision:"escalate", reason_code:"system_error", ...}`), và biến `outcome` có được set hay không (set ⇒ hàm trả về bình thường; không set ⇒ có `throw` chưa bắt ⇒ `lifecycle_state = "failed"`).
Bản thân lời gọi `await store.insertAnswerTurn(...)` KHÔNG nằm trong bất kỳ `if` nào — nó chạy vô điều kiện ở cuối `finally`. Điều DUY NHẤT có rẽ nhánh quanh khu vực đó là việc có tạo `assistant message` hay không (`if decision==="answer"... else if decision==="clarify"...`), không phải việc có ghi `answer_turns` hay không.

Vì vậy một mutation kiểu "bỏ ghi ở nhánh X" (đúng lớp lỗi mà `R09` mục C tìm ra) chỉ có thể biểu diễn dưới dạng một điều kiện rẽ theo `decision` (3 giá trị) hoặc theo "có lỗi hay không" (`outcome` set/không set) — **KHÔNG thể** phân biệt được dòng 290 với dòng 295 hay dòng 453 với dòng 369, vì tất cả chúng đi tới CÙNG một `finalResult.decision === "escalate"` bằng CÙNG một cơ chế (`finish(escalateResult(...))`). Test canh theo GIÁ TRỊ ĐẦU RA (`decision`/`outcome`), không theo VỊ TRÍ MÃ NGUỒN sinh ra giá trị đó, là đủ để bắt lớp mutation này — thêm test cho từng trong 6 điểm `escalate` (dòng 290/295/299/311/314/339/369/417/453) sẽ trùng lặp hoàn toàn về việc CHÚNG CANH GÌ, không thêm khả năng phát hiện mutation nào mới.

**Kết luận: đủ 4 tổ hợp giá trị `{decision, outcome}` mà `finally` phân biệt được, nay đều có đúng 1 ca canh DB-write thật:**

| Tổ hợp | Ca canh (đã có từ trước hoặc mới thêm ở R11) |
| :-- | :-- |
| `decision="answer"` | `R4/W3: hai messages mỗi lượt...` (R06) |
| `decision="clarify"` | `BB-11 (R11): nhánh clarify...` (**MỚI, gói này**) |
| `decision="escalate"`, `outcome` có set (trả về bình thường) | `BB-11: nhánh escalate (risk gate ở chặng 5...)` (R06) |
| `outcome` KHÔNG set (`throw` chưa bắt ⇒ `lifecycle_state="failed"`) | `BB-11: nhánh NÉM LỖI (429 hết retry ở A2...)` (R06) |

Không có tổ hợp nào còn thiếu. Không sửa `lib/pipeline/index.ts` vì mã không có lỗi — chỉ thiếu đúng 1 test, đã thêm.

## Việc KHÔNG làm + lý do

- **Không sửa `lib/pipeline/index.ts`** ngoài việc tạm thời bơm rồi hoàn nguyên nguyên văn để lấy bằng chứng ĐỎ — mã đã ghi đúng ở nhánh `clarify` từ trước (R06), không có lỗi thật để vá.
- **Không thêm test riêng cho từng trong 6 điểm thoát `escalate`** (dòng 290/295/299/311/314/369/417/453) — giải trình đầy đủ ở bảng "Lập luận" trên; một test đại diện (`risk gate chặng 5`) đã đủ canh cơ chế `finish(escalate)` dùng chung.
- **Không sửa `tests/metrics.test.ts`** dù thấy 1 lần fail thoáng qua khi chạy `npm test` — file đó thuộc gói khác (`lib/adapters/metrics-store.ts` đang có người sửa song song), ngoài phạm vi được cấp; đã xác nhận không do `tests/memory.test.ts` gây ra (chạy `node scripts/run_tests.mjs memory` riêng luôn 0 fail) và đã chạy lại 2 lần `npm test` để xác nhận không phải lỗi thật lặp lại.
- **Không `git add`/`commit`/`stash`/`checkout`, không chạy `eval_golden.mjs`/`probe_defects.mjs`** — đúng luật bổ sung nhắc lại lần nữa.

## Danh sách file đã sửa/tạo

- Sửa: `tests/memory.test.ts` (thêm 1 test mới, +64 dòng)
- KHÔNG sửa: `lib/pipeline/index.ts` (0 diff so với HEAD — đã kiểm bằng `git diff --stat`)
- Tạo mới (evidence): `planning/01_2026-09-20_resident-agent-v1/evidence/bb11-clarify/clarify-red-green.txt`
- Kiểm `grep -cP '[\x08\x0c\x0b]'` trên `tests/memory.test.ts` và `lib/pipeline/index.ts` = 0 (cả hai).

## Tiếp theo

🖐 Cần tay người: không có quyết định nào cần người ngay bây giờ — lỗ hổng đã vá bằng test, mã nguồn không cần đổi.
🤖 Agent làm được ngay: chờ lệnh — gói W1–W5 + gói vá clarify đều đã đóng trong phạm vi được cấp.
⭐ Nên làm trước: super orchestrator đo lại `tests/memory.test.ts` (diff duy nhất của gói này) rồi commit riêng, trước khi `lib/adapters/metrics-store.ts`/`lib/eval/**` (đang có người sửa song song) đổi thêm và làm cây khó tách.
⏸ Chưa làm: không có việc nào trong phạm vi việc 1–4 bị bỏ lại. Câu hỏi mở tồn đọng từ `R06` (`is_golden_run`/`golden_case_id`, `getConversationOwner`) vẫn còn treo, ngoài phạm vi gói nối tiếp này.

---

**Phán quyết của Super Orchestrator (2026-09-22):**

✅ DUYỆT. Gói này làm đúng thứ khó nhất: đọc lại mã rồi kết luận KHÔNG có bug hành vi, chỉ thiếu test — `git diff` cho `lib/pipeline/index.ts` rỗng. Sửa mã khi không cần sửa là cách dễ nhất để đẻ ra lỗi mới.

SO tự kiểm lập luận "15 điểm thoát rút còn 4 lớp" bằng số thay vì nhận bằng lời: `grep -c insertAnswerTurn lib/pipeline/index.ts` = **1**, nằm trong khối `finally` (try dòng 215, finally 217, lời gọi 246). Lệnh ghi vô điều kiện ⇒ thứ duy nhất biến thiên là giá trị `decision`, không phải vị trí mã nguồn ⇒ bốn lớp là đủ. Lập luận đứng vững.

Ghi nhận thêm một điểm gói này không khoe: `EmptyQuestionError` được ném ở dòng 195, TRƯỚC khối `try`, nên câu hỏi rỗng không tạo dòng `answer_turns` nào — đúng `SPEC-P02` §9, và là ngoại lệ hợp lệ DUY NHẤT của bất biến "mọi lượt đều ghi".
