Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 (`init_brain.js --check` ⇒ "NÃO ĐÃ OK") · hiểu việc: phạm vi = `lib/adapters/db.ts` (`AnswerTurnInput` + `PostgresDataStore.insertAnswerTurn`), `lib/adapters/store-mock.ts` (`MockDataStore.insertAnswerTurn` + kho/getter test), `lib/pipeline/index.ts` (chỗ dựng `AnswerTurnInput`/gọi `insertAnswerTurn`), 4 test cũ + 1 test mới, `evidence/h25-pipeline-steps/**`, report này; xong khi = `tsc` 0 sau W2/W3, test mới xanh trên mock + đỏ chứng minh + round-trip Postgres thật, `run_tests.mjs`/2 script check 0 vi phạm; cấm bằng lời mình = không đánh số lại `$1..$16`, không chạm `lib/types.ts`/`db/**`/`app/**`/`scripts/**`/`planning/**/specs/**`, không git add/commit/push, không gọi model thật, không chạm 4 file của H24.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H25_persist-pipeline-steps.md`
Base: `30a1ea4`
Head: `30a1ea4` (không commit — đúng luật CẤM git add/commit/push)

## Sự cố giữa phiên — mất dữ liệu working tree một lần

Giữa lúc thi công, `lib/adapters/db.ts` và `lib/adapters/store-mock.ts` bị hệ thống báo "changed on disk" và khi kiểm lại thì các sửa đổi trước đó của tôi trên hai file này (và một phần `lib/pipeline/index.ts`) đã biến mất, quay về đúng bản gốc — không phải do tôi tự sửa lại. `git status`/`git diff --stat` tại thời điểm phát hiện chỉ còn đúng 5 dòng thêm ở `lib/pipeline/index.ts` (khối gán `s1RetrievalTop1 = dec.s1` đầu tiên). Tôi đã đọc lại toàn bộ ba file để xác nhận trạng thái thật rồi làm lại từ đầu các đoạn đã mất, xác minh bằng `grep`/`git diff` sau mỗi bước. Không rõ nguyên nhân (không phải tôi chạy git reset/checkout); nêu ra để SO biết, không tự đoán.

## Lệnh + exit code

```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
EXIT:0

$ npx tsc --noEmit
EXIT:0   (evidence/h25-pipeline-steps/tsc.txt)

$ node scripts/run_tests.mjs
EXIT:0 — tests 251, pass 251, fail 0, skip 0   (evidence/h25-pipeline-steps/run_tests.txt, full_test_run.txt)

$ node --experimental-strip-types --test tests/pipeline-steps-persist.test.ts
EXIT:0 — tests 4, pass 4, fail 0, skip 0   (evidence/h25-pipeline-steps/green.txt)

$ bash scripts/check_adapter_boundary.sh
violations: 0   EXIT:0   (evidence/h25-pipeline-steps/check_adapter_boundary.txt)

$ bash scripts/check_no_confidence_ui.sh
matches: 0   EXIT:0   (evidence/h25-pipeline-steps/check_no_confidence_ui.txt)

$ node --experimental-strip-types "planning/.../evidence/h25-pipeline-steps/pg_roundtrip.ts"
PASS — jsonb_array_length=2, s3_faithfulness=0.7500, cascade cleanup ok   (evidence/h25-pipeline-steps/pg_roundtrip.txt)
```

## Test tổng/pass/fail/skip

- Toàn repo (`run_tests.mjs`): **251 / 251 pass / 0 fail / 0 skip** (số nền handoff ghi 238 — chênh 13 do worker H24 song song đang thêm test riêng của họ, tôi không đụng file nào của họ; số 251 là số ĐO TẠI THỜI ĐIỂM BÁO CÁO, không phải tôi tự thêm 13 test).
- File mới `tests/pipeline-steps-persist.test.ts`: **4 / 4 pass / 0 fail / 0 skip**, gồm ca (a) escalate sớm, (b) answer đầy đủ, (c) action, (d) conflict thật trên Postgres.
- Chứng minh đỏ (W3): tạm ép `store-mock.ts::insertAnswerTurn` bỏ `pipeline_steps` (dùng `[]` cứng) ⇒ 3/4 ca (a)/(b)/(c) đỏ đúng như dự kiến, ca (d) (đọc Postgres thật, không qua đường bị ép hỏng) vẫn xanh — `evidence/h25-pipeline-steps/red.txt`. Khôi phục ⇒ 4/4 xanh lại — `evidence/h25-pipeline-steps/green.txt`.

## `git diff --stat`

```
 lib/adapters/db.ts            | 32 ++++++++++++++++++++++++++++----
 lib/adapters/store-mock.ts    | 40 ++++++++++++++++++++++++++++++++++++++++
 lib/pipeline/index.ts         | 30 ++++++++++++++++++++++++++++++
 tests/conversation-id.test.ts | 12 ++++++++++++
 tests/hitl-enqueue.test.ts    |  7 +++++++
 5 files changed, 117 insertions(+), 4 deletions(-)
```
Mới (untracked, chưa `git add`): `tests/pipeline-steps-persist.test.ts`, `planning/01_2026-09-20_resident-agent-v1/evidence/h25-pipeline-steps/**`, report này.
`tests/memory.test.ts` và `tests/p05-pipeline-action.test.ts` (2 trong 4 file test "đã nêu" ở handoff) **KHÔNG cần sửa** — cả hai gọi `runTurn()` chứ không tự dựng literal `AnswerTurnInput`, nên `tsc` xanh mà không đụng chúng.
`tests/check-env.test.ts` (của H24) — không chạm, chỉ thấy trong `git status` do worker khác tạo.

## Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :-- | :-- | :-- |
| W1 — hợp đồng `AnswerTurnInput` + INSERT ($17..$22, không đánh số lại) | 🟠 | Claude Sonnet 5 |
| W2 — pipeline truyền `pipeline_steps` ở mọi nhánh (answer/clarify/escalate sớm/action/lỗi) | 🟠 | Claude Sonnet 5 |
| W3 — sửa 2 test cũ dựng `AnswerTurnInput` trực tiếp + chứng minh đỏ/xanh | 🟢 | Claude Sonnet 5 |
| W4 — round-trip thật trên Postgres, tự dọn | 🟠 | Claude Sonnet 5 |
| W5 — cổng chung (tsc/run_tests/2 script check) | 🟢 | Claude Sonnet 5 |
| W6 (bổ sung) — 4 tín hiệu Đ07 + histogram, cùng file/cùng câu INSERT | 🟠 | Claude Sonnet 5 |

## Việc KHÔNG làm + lý do

- **`scripts/trace_sample.mjs` chưa đọc `answer_turns.pipeline_steps`/4 tín hiệu mới** — script nằm trong `scripts/**`, ngoài phạm vi được ghi của handoff này (và đụng vào có nguy cơ giẫm lên H24 đang sửa `scripts/`). G08 (`node scripts/trace_sample.mjs <id>` ⇒ 3 khối có model/ms/tokens) vẫn cần một gói riêng cập nhật script đó để đọc cột thật thay vì tính lại/giả định.
- **`lib/adapters/metrics-store.ts`** (đọc `s3_faithfulness` cho `/eval`) — không nằm trong phạm vi "Được ghi" của handoff; W6 chỉ đảm bảo cột DB có giá trị thật, chưa xác minh `/eval` đã đọc đúng cột đó (nội dung file chưa được tôi mở).
- Không sửa `db/**`, `app/**`, `lib/types.ts`, `package.json` — đúng CẤM.
- Không đụng 4 file của H24 (`scripts/check_env.mjs`, `scripts/check_enum_closed.mjs`, `scripts/eval_golden.mjs`, `tests/check-env.test.ts`).
- Cột khác vẫn rỗng ngoài phạm vi W6 (không kiểm lại — W6 đã phủ đúng 5 cột SO nêu, không còn cột nào khác được biết là rỗng ngoài phạm vi này).

## Câu hỏi cần người

1. Có cần mở thêm một handoff riêng để cập nhật `scripts/trace_sample.mjs` đọc `pipeline_steps`/4 tín hiệu thật (đang ngoài phạm vi H25) để chốt G08 hoàn toàn không?
2. Có cần xác minh `lib/adapters/metrics-store.ts` đọc đúng `s3_faithfulness` mới hay không (nằm ngoài phạm vi ghi của H25, chỉ đổi giá trị cột nguồn)?
3. Sự cố "mất dữ liệu working tree giữa phiên" ở trên — có cần điều tra thêm (ví dụ tool nào đã chạm `git checkout`/`reset` ngoài ý muốn) trước khi giao việc song song khác vào cùng thư mục?

✅ ĐẠT — W1–W6 hoàn thành theo "xong khi" của từng gói; tsc/run_tests/2 script check đều 0 lỗi/0 vi phạm; round-trip Postgres thật xanh và tự dọn sạch; 2 việc ngoài phạm vi (trace_sample.mjs, metrics-store.ts) đã ghi rõ ở mục "KHÔNG làm", chờ người quyết có mở gói tiếp theo hay không.
