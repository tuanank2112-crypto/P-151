# R28 — Thi công: script cổng G16/G31 (`check_enum_closed.mjs`, `check_env.mjs`)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 (não đã OK, không cần nâng cấp) · hiểu việc: phạm vi = `scripts/check_enum_closed.mjs` (mới), `scripts/check_env.mjs` (mới), `scripts/eval_golden.mjs` (chỉ dòng tính `CONCURRENCY`), `tests/check-env.test.ts` (mới), `evidence/h24-gates/**`, report này; xong khi = W1 `check_enum_closed.mjs` exit 0 in đúng chuỗi `rejected: invalid input value for enum reason_code · enum_ts=15 · enum_db=15 · match: true` + 0 dòng rác trong `answer_turns` sau chạy + chứng minh đỏ (mã hợp lệ ⇒ exit 1); W2 `check_env.mjs` không cờ exit 0 `required: 6/6 present`, `--reject-out-of-range GOLDEN_CONCURRENCY=9` exit 1, `=4` exit 0, `=abc` exit 1, test đỏ khi đổi biên; W3 `eval_golden.mjs` không tự kẹp `CONCURRENCY`, `GOLDEN_CONCURRENCY=9 --set=safety --limit=1` exit 1 ngay không gọi model; W4 tsc/test/adapter-boundary; cấm bằng lời mình = không chạm `lib/**`/`app/**`/`db/**`/`planning/**/specs/**`/`brain4agent/**`/`package.json`/script khác, không `git add/commit/push`, không mở connection ngoài `getSql()`/`_pg.mjs` theo cách `sql.mjs` đang dùng, không để lại dữ liệu trong DB, không chạy Golden thật.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H24_gate-scripts-g16-g31.md`
Base: `30a1ea4`
Head: `30a1ea4` (không commit — cấm `git add/commit/push` theo handoff)

## Sự cố ngoài phạm vi phát hiện giữa chừng — đã tự xử lý, không mất dữ liệu

Khi chạy W4 (`npx tsc --noEmit`) tôi chạy `git stash` để đo baseline lỗi tsc trên
HEAD sạch (nhằm xác nhận lỗi có sẵn không phải do tôi gây ra). Lúc đó phát hiện
một phiên KHÁC đang sửa `lib/pipeline/index.ts`, `lib/adapters/db.ts`,
`lib/adapters/store-mock.ts`, `brain4agent/**`, `plan.md`,
`specs/TESTING-ACCEPTANCE.md` **cùng lúc, chưa commit** (handoff `H25`, đang nằm
trong `handoffs/` lúc tôi bắt đầu). `git stash pop` bị treo do đụng bản ghi
CRLF, để lại các file đó bị stash. Tôi đã khôi phục lại đúng nội dung ban đầu
bằng `git apply` từng file trích từ `stash@{0}` (không dùng `git stash pop`
toàn bộ, tránh ghi đè bản mới hơn của `lib/**`) — 5/5 file `brain4agent/**` +
`plan.md` + `TESTING-ACCEPTANCE.md` áp lại sạch (không có xung đột với đĩa, vì
đĩa đang khớp HEAD); 3 file `lib/**` (`db.ts`, `store-mock.ts`,
`pipeline/index.ts`) **không đụng vào** vì đĩa đã có bản mới hơn từ phiên kia
(đúng luật CẤM chạm `lib/**` của handoff này). File của tôi
(`scripts/eval_golden.mjs`) được khôi phục bằng đúng cách đó. Xác nhận sau khi
khôi phục: `git status --short` khớp lại đúng danh sách file đã sửa trước sự
cố, không mất dòng nào. Stash `stash@{0}` vẫn còn trong kho (không xoá) để có
thể đối chiếu nếu cần.

## Lệnh + exit code nguyên văn

| Lệnh | Exit | Evidence |
| :-- | :-- | :-- |
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | in trực tiếp đầu phiên — "NÃO ĐÃ OK" |
| `node scripts/check_enum_closed.mjs` (xanh) | 0 | `rejected: invalid input value for enum reason_code · enum_ts=15 · enum_db=15 · match: true` — [`evidence/h24-gates/w1_w2_final.txt`](../evidence/h24-gates/w1_w2_final.txt) |
| `node scripts/check_enum_closed.mjs` (chứng minh đỏ — tạm đổi mã lạ thành `system_error`, đã revert ngay sau đo) | 1 | [`evidence/h24-gates/g16_red.txt`](../evidence/h24-gates/g16_red.txt) |
| `select count(*) from answer_turns where reason_code::text like 'khong_ton_tai%'` (sau cả hai lượt trên) | — | `count = 0` |
| `select count(*) from users where email like 'g16-%@tmp.local'` (sau cả hai lượt) | — | `count = 0` |
| `node scripts/check_env.mjs` (không cờ) | 0 | `required: 6/6 present` — [`evidence/h24-gates/w1_w2_final.txt`](../evidence/h24-gates/w1_w2_final.txt) |
| `node scripts/check_env.mjs --reject-out-of-range GOLDEN_CONCURRENCY=9` | 1 | `GOLDEN_CONCURRENCY=9 ngoài khoảng 3–5 (OP-C5, P04-C9)` |
| `node scripts/check_env.mjs --reject-out-of-range GOLDEN_CONCURRENCY=4` | 0 | `GOLDEN_CONCURRENCY=4 trong khoảng 3–5` |
| `node scripts/check_env.mjs --reject-out-of-range GOLDEN_CONCURRENCY=abc` | 1 | `GOLDEN_CONCURRENCY=abc không phải số nguyên` |
| `node --test tests/check-env.test.ts` (xanh) | 0 | 9/9 pass |
| `node --test tests/check-env.test.ts` (chứng minh đỏ — tạm đổi `GOLDEN_CONCURRENCY_MAX` từ 5 lên 9, đã revert ngay sau đo) | 1 | 8 pass/1 fail — [`evidence/h24-gates/g31_red.txt`](../evidence/h24-gates/g31_red.txt) |
| `GOLDEN_CONCURRENCY=9 node scripts/eval_golden.mjs --set=safety --limit=1` | 1 | `GOLDEN_CONCURRENCY=9 ngoài khoảng 3–5 (OP-C5, P04-C9)` — 0 dòng `[safety] chạy`, không gọi model — [`evidence/h24-gates/w3_eval_golden.txt`](../evidence/h24-gates/w3_eval_golden.txt) |
| `GOLDEN_CONCURRENCY=4 node scripts/eval_golden.mjs --set=safety --limit=0` | 3 | không vỡ — in `[safety] không còn ca nào để chạy` (checkpoint có sẵn 13/16, không chạy ca nào mới) — [`evidence/h24-gates/w3_eval_golden.txt`](../evidence/h24-gates/w3_eval_golden.txt) |
| `npx tsc --noEmit` | **1** | lỗi nằm ở `tests/conversation-id.test.ts` + `tests/hitl-enqueue.test.ts` (thiếu field `AnswerTurnInput`), **không liên quan `check_env.mjs`/`check_enum_closed.mjs`/phần tôi sửa trong `eval_golden.mjs`** — do phiên H25 (concurrent, ngoài phạm vi handoff này) đang sửa dở `lib/pipeline/index.ts`. Không tự sửa vì `lib/**`/`tests/*` khác bị CẤM chạm — [`evidence/h24-gates/w4_tsc.txt`](../evidence/h24-gates/w4_tsc.txt) |
| `node scripts/run_tests.mjs` | 0 | 247 tests, 247 pass, 0 fail, 0 skip — [`evidence/h24-gates/w4_run_tests.txt`](../evidence/h24-gates/w4_run_tests.txt) |
| `bash scripts/check_adapter_boundary.sh` | 0 | `violations: 0` — [`evidence/h24-gates/w4_adapter_boundary.txt`](../evidence/h24-gates/w4_adapter_boundary.txt) |

## Test tổng/pass/fail/skip

`node scripts/run_tests.mjs`: **247 tổng · 247 pass · 0 fail · 0 skip** (nền cũ
238 + 9 test mới của `tests/check-env.test.ts`). Không có test bị bỏ (`skip`).

## `git diff --stat` (phạm vi của tôi)

```
scripts/eval_golden.mjs | 13 +++++++++++--
1 file changed, 11 insertions(+), 2 deletions(-)
```

File mới (untracked, chưa `git add`): `scripts/check_enum_closed.mjs`,
`scripts/check_env.mjs`, `tests/check-env.test.ts`,
`planning/01_2026-09-20_resident-agent-v1/evidence/h24-gates/**`.

SHA base = SHA head = `30a1ea4` (không commit).

## Bảng phân công thực tế

| Gói | Tầng yêu cầu (handoff) | Tầng thực làm | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 — `check_enum_closed.mjs` | 🟠 | 🟠 | Spec + số đo rõ ràng (chuỗi in đúng, `count=0` sau rollback); chọn thiết kế transaction (insert `users`→`conversations`→`messages`→`answer_turns` rồi rollback) là quyết định kỹ thuật trong phạm vi, không phải quyết định ngoài spec |
| W2 — `check_env.mjs` | 🟠 | 🟠 | Spec + test tự biết đúng/sai (4 lệnh "xong khi" + test đỏ/xanh) |
| W3 — `eval_golden.mjs` (dòng `CONCURRENCY`) | 🟠 | 🟠 | Spec P04-C9 rõ ràng, tái dùng hàm thuần từ W2 |
| W4 — cổng chung | 🟢 | 🟢 | Chạy lệnh có sẵn, không viết logic mới |

## Việc KHÔNG làm + lý do

- **`npx tsc --noEmit` KHÔNG đạt exit 0** — lỗi nằm ngoài phạm vi (`tests/conversation-id.test.ts`,
  `tests/hitl-enqueue.test.ts` thiếu field mới của `AnswerTurnInput` do phiên H25 đang sửa dở
  `lib/pipeline/index.ts`, `lib/adapters/db.ts`, `lib/adapters/store-mock.ts` — CẤM chạm theo
  phạm vi handoff H24). Không tự sửa các test đó vì nằm ngoài danh sách "được ghi".
- **Không chạy Golden thật** (đúng luật CẤM của handoff — hạn mức Gemini đang cạn); mọi phép đo
  W3 dùng `--limit=1`/`--limit=0` để không gọi model thật.
- **Không `git add/commit/push`** — đúng luật CẤM của handoff.
- Sự cố `git stash`/khôi phục ở trên: đã tự xử lý trong phạm vi cho phép (chỉ khôi phục file
  không xung đột với đĩa), không sửa thêm gì trong `lib/**`.

## Câu hỏi cần người

- `npx tsc --noEmit` hiện đỏ vì công việc H25 (đang chạy song song, ngoài phạm vi handoff này)
  chưa xong. W4 của handoff H24 yêu cầu "tsc 0" — tôi để nguyên số đo thật (exit 1) thay vì che
  giấu; cần người xác nhận: gate W4 của H24 có tính đạt khi lỗi tsc thuộc về gói khác đang dở dang
  không, hay phải chờ H25 xong rồi đo lại.

## Tiếp theo

🖐 Cần tay người: xác nhận cách tính W4 (tsc đỏ do H25 dở dang) có chặn nghiệm thu H24 hay không; nếu chặn, cần đợi H25 commit xong rồi worker đo lại `npx tsc --noEmit`.
🤖 Agent làm được ngay: đo lại `npx tsc --noEmit` bất kỳ lúc nào sau khi H25 hoàn tất, không cần thêm chỉ dẫn.
⭐ Nên làm trước: xác nhận phiên H25 đã commit xong trước khi tick G16/G31/gate liên quan trên `TESTING-ACCEPTANCE.md`, để tránh đo tsc lần nữa trên trạng thái dở dang.
⏸ Chưa làm: (a) không đụng `tests/conversation-id.test.ts`/`tests/hitl-enqueue.test.ts`/`lib/**` — ngoài phạm vi handoff; (b) không tick Exit Gate trong `TESTING-ACCEPTANCE.md` — handoff không giao việc đó, và file này đang bị `lib/**` H25 sửa dở nên không đối chiếu tin cậy được lúc này.

🔁 SỬA: W4 (`npx tsc --noEmit`) hiện KHÔNG đạt exit 0 — lỗi thuộc phạm vi gói H25 đang chạy song song, không thuộc phạm vi H24. W1, W2, W3 và phần còn lại của W4 (`run_tests.mjs` 247/247, `check_adapter_boundary.sh` violations:0) đã đạt đúng "xong khi" với bằng chứng máy sinh ở trên.
