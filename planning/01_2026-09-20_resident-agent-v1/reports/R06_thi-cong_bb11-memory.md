# R06 — Thi công BB-11 / Memory / Answer Turns
Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H06_bb11-memory-answer-turns.md`
Base: `7956ccc` (dựng lại 2026-09-23 từ git: cha của commit thi công)
Head: `c27015f` (commit đưa gói vào `main`; worker không tự commit)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude, Sonnet 5 (claude-sonnet-5) · Bước 0: exit 0 (não đã OK, không cần nâng cấp) · hiểu việc: cài `DataStore` mọc thêm 4 hàm vận hành (W1); `runTurn()` ghi đúng MỘT `answer_turns` mỗi lượt kể cả escalate/ném lỗi qua `try/finally` (W2, BB-11/P02-C10); `/api/chat` tái dùng-hoặc-tạo `conversation_id` có kiểm chủ sở hữu, 403 khi lệch (W3); `tests/memory.test.ts` mới, phải từng ĐỎ (W4); cổng tổng W5. Phạm vi CHỈ 4 file `lib/adapters/db.ts` · `lib/pipeline/index.ts` · `app/api/chat/route.ts` · `lib/types.ts` (không đụng) cộng `tests/memory.test.ts` mới; CẤM đụng `app/(bql)/**`, `lib/adapters/{bql-store,metrics-store}.ts`, `lib/pipeline/{eligibility,retrieval,ownership,errors}.ts`, `evals/golden/rubric.md`; CẤM `git add/commit/stash/checkout`; CẤM chạy `eval_golden.mjs`/`probe_defects.mjs`.

## Lệnh + exit code (chạy trực tiếp, nguyên văn)

| Lệnh | Exit |
| :-- | :-- |
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 |
| `npx tsc --noEmit` (toàn repo) | 0 |
| `npm run build` | 0 |
| `node scripts/run_tests.mjs` (= `npm test`) | 0 |
| `bash scripts/check_adapter_boundary.sh` | 0 — `violations: 0` |
| `bash scripts/check_no_confidence_ui.sh` | 0 — `matches: 0` |
| `bash scripts/check_no_hardcoded_knowledge.sh` | 0 — `matches: 0` |
| `node --test tests/memory.test.ts` (chạy riêng, DB thật) | 0 — 4/4 pass |

## Test tổng/pass/fail/skip

`npm test` (toàn repo, gồm cả file của 2 worker song song khác):

```
tests 113
suites 0
pass 113
fail 0
cancelled 0
skipped 0
todo 0
duration_ms ~32700-33200 (dao động giữa các lượt chạy)
```

Baseline handoff ghi 82 pass tại HEAD `10e2997`. Hiện 113 (82 + việc của 3 worker cộng lại). Bốn ca trong `tests/memory.test.ts` (của gói này) đều `pass`, 0 fail, 0 skip.

## `git diff --stat` + SHA

`HEAD` lúc bắt đầu và lúc báo cáo (cây làm việc, chưa ai commit thêm): `7956ccc643a01497fdaa114ad56bdbc8e5cdb924`

Diff CHỈ tính đúng 4 file trong phạm vi của gói này (xác nhận bằng `git status --short` đầy đủ — không đụng file nào khác, dán ở cuối):

```
 app/api/chat/route.ts      |  41 +++++++++++++-
 lib/adapters/db.ts         | 133 ++++++++++++++++++++++++++++++++++++++++++++-
 lib/adapters/store-mock.ts |  51 ++++++++++++++++-
 lib/pipeline/index.ts      | 121 +++++++++++++++++++++++++++++++++++------
 4 files changed, 325 insertions(+), 21 deletions(-)
```

Cộng 1 file mới `tests/memory.test.ts` (297 dòng) và thư mục evidence mới
`planning/01_2026-09-20_resident-agent-v1/evidence/bb11/` (2 file: `memory-red-green.txt`, `w2-real-postgres-turn.txt`) — cả hai đúng phạm vi được cấp ("tests/memory.test.ts (tạo mới)" + dòng cuối handoff chỉ định đường evidence).

**KHÔNG chạm `lib/types.ts`** — không cần thêm kiểu nào (mọi kiểu cần dùng: `LifecycleState`, `Decision`, `ReasonCode`, `Citation`, `ClaimVerdict` đã có sẵn từ trước).

**KHÔNG thêm migration `006_*.sql`** — `004_operational.sql` đã có đủ mọi cột cần cho W1–W4 (`conversations`, `messages`, `answer_turns` với `user_message_id`/`assistant_message_id`/`decision`/`reason_code`/`confidence`/`gate_triggered`/`citations`/`lifecycle_state`/`is_golden_run` và các cột có `DEFAULT`). Không có "Câu hỏi mở" về schema.

## Bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)

| Gói | Tầng yêu cầu (handoff §5) | Model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 (DataStore + 4 hàm vận hành) | 🟠 | Sonnet 5 | Đúng tầng — schema có sẵn ở `004_operational.sql`, chữ ký suy được, tsc tự biết đúng/sai |
| W2 (`runTurn` ghi `answer_turns` qua try/finally) | 🔴 | Sonnet 5 | Đúng tầng — chạm bất biến BB-11/P02-C10, cần quyết định kiến trúc (ai ghi message, khi nào viết assistant message, cách bọc try/finally không phá 8 return sớm hiện có) chưa có sẵn thành công thức trong SPEC |
| W3 (`/api/chat` resolve `conversation_id` + 403) | 🟠 | Sonnet 5 | Có SPEC-P02 §9 (`ConversationNotOwned`) + test đo được bằng `count(*)`; phần tự quyết duy nhất (thêm `getConversationOwner`) đã tách riêng và giải trình dưới |
| W4 (`tests/memory.test.ts`, phải từng ĐỎ) | 🟠 | Sonnet 5 | Viết test theo bất biến đã nêu, tự đo đúng/sai bằng SQL thật |
| W5 (cổng tổng) | 🟢 | Sonnet 5 | Chạy lệnh có sẵn, chép số |

Không có gói nào bị đẩy xuống tầng thấp hơn yêu cầu. W2 được xử lý ở đúng tầng 🔴 bằng cách đọc kỹ SPEC-P02 §1/§7/§9 + `00-ARCHITECTURE.md` §8 trước khi quyết cách bọc try/finally, thay vì đoán.

## Quyết định kỹ thuật đáng chú ý (không có trong SPEC theo câu chữ, đã tự quyết trong phạm vi + giải trình)

1. **Thêm `DataStore.getConversationOwner(conversationId): Promise<string | null>`** — ngoài 4 hàm được liệt kê tường minh ở handoff §3 W1 (`createConversation`, `appendMessage`, `listMessages`, `insertAnswerTurn`). W3 đòi 403 khi `conversation_id` không thuộc principal (`SPEC-P02` §9, `ConversationNotOwned`), và việc đó bắt buộc phải hỏi DB xem hội thoại thuộc `user_id` nào — không hàm nào trong 4 hàm gốc trả lời được câu đó. Route không được tự mở connection (BB-07), nên hàm phải sống trong `DataStore`. Đã cân nhắc dùng `listMessages` để suy luận nhưng không cho ra `user_id`. Ghi chú trực tiếp trong code (`lib/adapters/db.ts`) tại đúng vị trí khai báo.
2. **Kho mock: chọn "no-op có ghi chú", KHÔNG ném lỗi** (handoff cho phép cả hai: *"cài bản ném lỗi rõ ràng HOẶC no-op có ghi chú"*). Lý do đo được: `tests/pipeline-order.test.ts` và `tests/citations.test.ts` gọi thẳng `runTurn` với `DATA_BACKEND=mock` (mặc định) và `conversation_id` tuỳ ý (`"c1"`, `"c2"`, …) không hề tồn tại thật. Nếu mock ném lỗi ở `appendMessage`/`insertAnswerTurn`, `runTurn` (nay luôn gọi các hàm này) sẽ làm toàn bộ 9 ca ở 2 file đó fail ngay — phá cổng W5 ("`npm test` ≥ 82 + số ca mới, fail 0"). Đã xác nhận bằng cách chạy `npm test` sau khi đổi: 113/113 pass, đúng các test cũ không đổi một dòng nào.
3. **`ConversationNotOwned` định nghĩa CỤC BỘ trong `app/api/chat/route.ts`**, không phải `lib/pipeline/errors.ts` — vì `lib/pipeline/errors.ts` nằm trong danh sách CẤM đụng của handoff, và về mặt kiến trúc việc xác định chủ sở hữu `conversation_id` là quyết định ở TẦNG HTTP (trước khi gọi `runTurn`), không phải một trong 9 chặng pipeline tất định (BB-08). Ghi rõ lý do trong comment tại chỗ khai báo.
4. **`assistant_message_id`/message thứ hai chỉ được ghi khi `decision ∈ {answer, clarify}`**, KHÔNG ghi khi `decision = escalate` hoặc khi `runTurn` ném lỗi (`failed`) — theo đúng chú thích DDL `004_operational.sql`: `assistant_message_id uuid REFERENCES messages(id), -- NULL khi escalate`. Với `clarify`, nội dung ghi là `clarify_question_vi` (có nội dung thật đáng lưu cho lịch sử hội thoại — SPEC không cấm điều này, chỉ cấm với escalate).
5. **`is_golden_run` luôn `false`** từ `runTurn` — không có cơ chế truyền cờ này từ Golden runner trong phạm vi W1–W5 (đụng vào `scripts/eval_golden.mjs` là ngoài phạm vi + bị cấm chạy). Ghi vào "Câu hỏi mở" bên dưới.
6. **`detected_intent`** chỉ được set khi A1 phân giải được một `IntentId` cụ thể (`I-01..I-05`); các nhánh thoát sớm hơn (emergency, ownership, legal, unsupported, unresolved) ghi `null` — khớp đúng comment cột DDL (`'I-01'..'I-05' | NULL`).
7. **`lifecycle_state = 'failed'`** chỉ dùng cho nhánh ném lỗi KHÔNG được `finish()` chặn lại (tức lỗi thật sự thoát ra ngoài `runPipelineBody`) — phân biệt với `'escalated'` (mọi nhánh `escalate` trả về bình thường qua `return`). Diễn giải này dựa trên bảng lỗi `00-ARCHITECTURE.md` §8 cột "Có ghi `answer_turns`?" của E1 ghi *"decision = system_error"* — nhưng cột DB `decision` là enum `('answer','clarify','escalate')`, không có giá trị `system_error`. Đã diễn giải câu đó là ý nói `reason_code = system_error` + `decision = escalate` (giá trị hợp lệ gần nhất), không phải literal set `decision` thành chuỗi không tồn tại trong enum.

## Bằng chứng ĐỎ→XANH (W4, BB-11)

File: [`../evidence/bb11/memory-red-green.txt`](../evidence/bb11/memory-red-green.txt)

Cách tạo: tạm chèn 1 dòng vào `finally` của `runTurn` (`lib/pipeline/index.ts`) để BỎ hẳn lời gọi `store.insertAnswerTurn()` khi `finalResult.decision === "escalate"`, chạy `node --test tests/memory.test.ts` → **2/4 ca ĐỎ** đúng 2 ca đo nhánh escalate/ném lỗi (`0 !== 1`), 2 ca còn lại (R4 messages, W3 owner) vẫn xanh vì không phụ thuộc đường đó. Sau đó hoàn nguyên nguyên văn (đã kiểm bằng `npx tsc --noEmit` exit 0 + chạy lại `node --test tests/memory.test.ts` → 4/4 xanh, dán trong cùng file evidence).

Bằng chứng thứ hai, THẬT trên Postgres, KHÔNG mock transport (chạy tay trước khi viết test, dùng đúng câu hỏi D1 `"Sân pickleball mở cửa mấy giờ?"`): Gemini API trả **429 thật** (hạn mức chung của đội đang cạn — đúng bối cảnh Đ19/Đ26 đã ghi), `runTurn` ném `UpstreamRateLimited` ra ngoài, `answer_turns` count từ **0 → 1**, dòng ghi `decision=escalate · reason_code=system_error · lifecycle_state=failed · confidence=0.0000`. File: [`../evidence/bb11/w2-real-postgres-turn.txt`](../evidence/bb11/w2-real-postgres-turn.txt).

## Việc KHÔNG làm + lý do

- **Không sửa `evals/golden/rubric.md`, `app/(bql)/**`, `lib/adapters/{bql-store,metrics-store}.ts`** — ngoài phạm vi, đang do 2 worker khác giữ song song.
- **Không nối `is_golden_run` với Golden runner thật** — cần đụng `scripts/eval_golden.mjs` (CẤM đụng + CẤM chạy trong nhiệm vụ này). Golden runner hiện sẽ ghi `is_golden_run=false` cho mọi lượt gọi qua `runTurn` (không sai, chỉ chưa gắn cờ Golden).
- **Không chạy `scripts/eval_golden.mjs` hay `scripts/probe_defects.mjs`** — cấm tường minh trong nhiệm vụ, tránh đốt hạn mức Gemini chung.
- **Không `git add`/`commit`/`stash`/`checkout`** — theo luật bổ sung của điều phối viên; mọi thay đổi ở dạng chưa commit, để super orchestrator đo rồi commit.
- **Không thêm migration `006_*.sql`** — không cần, `004_operational.sql` đã đủ cột (xem mục diff ở trên).

## Câu hỏi mở (cần người quyết, không tự chế)

1. **`is_golden_run` / `golden_case_id`** — khi Golden runner (`scripts/eval_golden.mjs`, ngoài phạm vi gói này) được nối vào `runTurn` thật, cần quyết cách truyền `is_golden_run: true` + `golden_case_id` vào (ví dụ mở rộng `RunTurnArgs`?). Hiện `runTurn` không nhận tham số này, mặc định luôn `false`/không set.
2. **`getConversationOwner`** — đã thêm như một hàm thứ 5 ngoài danh sách tường minh của handoff (giải trình ở mục "Quyết định kỹ thuật" #1). Nếu điều phối viên muốn tên khác hoặc muốn gộp logic vào một hàm khác, xin chỉ định lại — hiện tại API đã hoạt động đúng và có test (`tests/memory.test.ts`, ca thứ 4).

## Danh sách file đã sửa/tạo (đầy đủ)

- Sửa: `lib/adapters/db.ts`, `lib/adapters/store-mock.ts`, `lib/pipeline/index.ts`, `app/api/chat/route.ts`
- Tạo mới: `tests/memory.test.ts`
- Tạo mới (evidence): `planning/01_2026-09-20_resident-agent-v1/evidence/bb11/memory-red-green.txt`, `planning/01_2026-09-20_resident-agent-v1/evidence/bb11/w2-real-postgres-turn.txt`
- Kiểm `grep -cP '[\x08\x0c\x0b]'` trên 5 file mã nguồn đã sửa/tạo = 0 (đã chạy, dán trong phần lệnh trên báo cáo gốc gửi điều phối viên).

`git status --short` đầy đủ tại thời điểm báo cáo (xác nhận không đụng file ngoài phạm vi):

```
 M app/(bql)/dashboard/page.tsx          ← worker khác
 M app/(bql)/documents/page.tsx          ← worker khác
 M app/(bql)/eval/page.tsx               ← worker khác
 M app/(bql)/review/page.tsx             ← worker khác
 M app/api/chat/route.ts                 ← GÓI NÀY
 M app/globals.css                       ← worker khác
 M lib/adapters/db.ts                    ← GÓI NÀY
 M lib/adapters/store-mock.ts            ← GÓI NÀY
 M lib/pipeline/index.ts                 ← GÓI NÀY
 M planning/01_2026-09-20_resident-agent-v1/plan.md   ← worker khác (super orchestrator?)
?? app/(bql)/documents/DocumentsTable.tsx    ← worker khác
?? app/(bql)/documents/actions.ts            ← worker khác
?? app/(bql)/eval/labels.ts                  ← worker khác
?? app/(bql)/review/ReviewQueueList.tsx      ← worker khác
?? app/(bql)/review/actions.ts               ← worker khác
?? evals/golden/rubric.md                    ← worker khác
?? lib/adapters/bql-store.ts                 ← worker khác
?? lib/adapters/metrics-store.ts             ← worker khác
?? planning/.../evidence/bb11/               ← GÓI NÀY
?? planning/.../evidence/p03/                ← worker khác
?? planning/.../evidence/p04/                ← worker khác
?? planning/.../reports/R07_...              ← worker khác
?? planning/.../reports/R08_...              ← worker khác
?? tests/bql-authz.test.ts                   ← worker khác
?? tests/bql-review.test.ts                  ← worker khác
?? tests/memory.test.ts                      ← GÓI NÀY
?? tests/metrics.test.ts                     ← worker khác
```

## Tiếp theo

🖐 Cần tay người: quyết `is_golden_run`/`golden_case_id` khi nối Golden runner thật (Câu hỏi mở #1), và xác nhận tên hàm `getConversationOwner` (Câu hỏi mở #2) trước khi super orchestrator commit.
🤖 Agent làm được ngay: chờ lệnh — không còn việc độc lập nào trong phạm mà chưa làm.
⭐ Nên làm trước: super orchestrator đo lại 4 file trong phạm vi (đã liệt kê ở trên) rồi commit riêng gói này, vì 2 worker khác đang chạm file khác trên cùng cây — vì cây đang lẫn 3 gói việc, càng để lâu càng khó tách diff sạch.
⏸ Chưa làm: nối `is_golden_run` thật với `eval_golden.mjs` (ngoài phạm vi + cấm chạy trong nhiệm vụ này); không có việc nào khác trong phạm vi W1–W5 bị bỏ lại.

---

**Phán quyết của Super Orchestrator (2026-09-22, sau khi tự đo lại và sau thẩm định đối kháng `R09`):**

🔁 SỬA: mục C của `R09` — phép phá "bọc `insertAnswerTurn` trong `if (decision !== \"clarify\")`" **LỌT QUA**, toàn bộ 113 test vẫn xanh. Bất biến P02-C10 nói "mọi lượt", nhưng không ca nào chạm nhánh `clarify`. Cần thêm ca canh nhánh đó, và phải chứng minh nó ĐỎ với đúng phép phá trên.

Phần còn lại đạt: cổng xanh, phạm vi sạch, và SO tự phá lệnh ghi `answer_turns` → 3/4 đỏ, hoàn nguyên → xanh (`evidence/so-gate-wave1/red_bb11_so_kiem.txt`). Ghi nhận: bàn giao H06 tự mâu thuẫn — W1 yêu cầu cài kho mock trong khi §2 liệt `store-mock.ts` vào danh sách cấm. Lỗi của SO, không tính là vi phạm phạm vi.
