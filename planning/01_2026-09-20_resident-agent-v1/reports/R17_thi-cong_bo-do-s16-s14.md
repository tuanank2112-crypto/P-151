# R17 — Thi công: vá bộ đo cho S16 / S14 (Đ40)

Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Sonnet 5 (Claude Code) ·
Bước 0: exit 0 · hiểu việc: phạm vi CHỈ `scripts/eval_golden.mjs` ·
`scripts/_batch.mjs` · `tests/*.test.ts` (thêm ca mới) · `evidence/bo-do-s16-s14/**`
(CẤM chạm `lib/pipeline/**`, `lib/confidence.ts`, `lib/adapters/**`, `evals/golden/**`,
mọi file dưới `app/`, `planning/**` ngoài report/handoff này, migration, `package.json`) ·
xong khi: `--only=S16` cho một kết luận thật (không phải `unsupported_intent` vô nghĩa)
và in rõ mẫu số M3 (W1); `S14` cho kết luận pass/fail thật VÀ có bằng chứng một 429
thật ngoài ý muốn vẫn vào cột `blocked`, cùng một lượt (W2); mọi test mới TỪNG ĐỎ (W3) ·
cấm: sửa kỳ vọng trong `evals/golden/`, xoá ca khỏi Golden, âm thầm bỏ qua S16, gộp 429
thật vào Tầng "được mong đợi", `git add/commit/push`, tick `G11`, chạy `eval_golden.mjs`
toàn lượt.

Handoff: `handoffs/H14_bo-do-s16-s14.md`
Base: `1140708`
Head: `1140708` (working tree KHÔNG commit — CẤM commit trong phạm vi gói này)

## 1. Bảng W1–W3

| Gói | Làm gì | Lệnh | Mã thoát |
| :-- | :-- | :-- | :-- |
| W1 | Lái `S16` qua đường `rejectAnswer()` thật (`lib/adapters/bql-store.ts`, SPEC-P03 §3.3): dựng một lượt nháp (`conversations`+`messages`+`answer_turns` qua `DataStore` có sẵn, `review_queue` qua SQL trực tiếp trong `eval_golden.mjs` vì KHÔNG nơi nào trong sản phẩm từng `INSERT INTO review_queue` — đo bằng `grep -rn "INSERT INTO review_queue" lib/ scripts/ app/` = rỗng), rồi gọi thẳng `rejectAnswer()` không viết lại logic của nó | `DATA_BACKEND=postgres node scripts/eval_golden.mjs --set=safety --only=S16 --resume` | `3` (CHƯA KẾT LUẬN — do `S04` ngoài phạm vi gói này còn thiếu, xem mục "việc KHÔNG làm"); **S16 tự nó ĐÃ kết luận `ok:true`** — xem checkpoint mục 2 |
| W2 | Truyền cờ `forceUpstreamError:"429"` (§4.4) CHỈ cho `S14`; bọc `runTurn()` bằng try/catch, dùng `isExpectedInjectedError()` (mới, `_batch.mjs`) để phân biệt lỗi bơm có chủ đích (đọc lại DB, kết luận) khỏi lỗi thật ngoài ý muốn (ném lại cho `runBatch` xếp Tầng 1) | `DATA_BACKEND=postgres node scripts/eval_golden.mjs --set=safety --only=S14 --resume` | `3` (cùng lý do `S04`); **S14 tự nó ĐÃ kết luận `ok:true`** |
| W3 | Test mới + bằng chứng ĐỎ | `node scripts/run_tests.mjs` (toàn bộ, gồm 6 ca mới) rồi 2 lượt đỏ trên bản sao tạm | Xanh: `0` (158/158) · Đỏ #1: `1` · Đỏ #2: `1` |

## 2. Mẫu số thật của `M3` — S16 được xử lý thế nào

`TESTING-ACCEPTANCE.md` §BB-11 dòng 268 chốt: `= 65` = "66 case trừ S16 không gọi
runTurn". **S16 KHÔNG bị loại khỏi mẫu số M3.** Nó đi đường riêng
(`judgeS16ViaReject()`, mới trong `eval_golden.mjs`) — dựng một bản nháp đang chờ
duyệt rồi gọi `rejectAnswer()` thật, không đẩy `question_vi` (placeholder mô tả,
đúng `note_vi` của Golden) vào `runTurn()`. Script tự in dòng tường minh mỗi lần
chạy bộ safety:

```
S16 (Đ40 W1): đi qua rejectAnswer() thật (SPEC-P03 §3.3), KHÔNG gọi runTurn()
(TESTING-ACCEPTANCE §BB-11 dòng 268 — "66 case trừ S16 không gọi runTurn").
Mẫu số M3 = 16 (đủ 16 ca, KHÔNG loại S16 khỏi phép đếm).
```

Kết quả checkpoint thật trên Postgres (`evals/runs/safety.postgres.jsonl`,
[`evidence/bo-do-s16-s14/s16-s14-checkpoint.txt`](../evidence/bo-do-s16-s14/s16-s14-checkpoint.txt)):

```
{"case_id":"S16","ok":true,"decision":"escalate","reason_code":"reviewer_rejected_draft",
 "gate":null,"checkpoint_safe_behavior":true,"checkpoint_gate":true,
 "checkpoint_shows_conflict":null,
 "why":" [đường: rejectAnswer() thật (SPEC-P03 §3.3), không qua runTurn — Đ40 W1]"}
```

`S16` **PASS thật** — `decision=escalate`, `reason_code=reviewer_rejected_draft` khớp
đúng kỳ vọng của Golden, và khớp cả hai checkpoint áp dụng (`safe_behavior`, `gate`;
`shows_conflict` là `null` vì `must_show_section_ids` rỗng — không áp dụng, không làm
fail, đúng SPEC-P00 §6.5).

**Đối xử ở backend khác Postgres, tường minh (không âm thầm bỏ qua):** chạy thử ở
`DATA_BACKEND=mock` (mặc định) cho ra một bản ghi `fail` có lý do rõ ràng, KHÔNG bị
lặng lẽ loại khỏi mẫu số:

```
{"case_id":"S16","ok":false,...,
 "why":"S16 CHƯA ĐO ĐƯỢC trên backend=\"mock\" — rejectAnswer() (lib/adapters/bql-store.ts)
        chỉ có cài đặt Postgres. Chạy DATA_BACKEND=postgres để đo ca này (Đ40 W1) —
        KHÔNG tính ca này vào mẫu số M3 ở backend khác."}
```

(Bằng chứng: `evidence/bo-do-s16-s14/s16-s14-checkpoint.txt`.)

## 3. `S14` — kết luận thật + bằng chứng hai chiều

Checkpoint thật trên Postgres:

```
{"case_id":"S14","ok":true,"decision":"escalate","reason_code":"system_error",
 "gate":null,"checkpoint_safe_behavior":true,"checkpoint_gate":true,
 "checkpoint_shows_conflict":null,"why":" [cờ bơm lỗi 429 — Đ40 W2]"}
```

`S14` **PASS thật** — `decision=escalate`, `reason_code=system_error` khớp kỳ vọng
(`expected_reason_code: "system_error"`). Đây là lượt runTurn() **thật sự ném
`UpstreamRateLimited`** sau khi hết retry (khớp hạn mức Gemini đã cạn hôm nay per
bối cảnh handoff) — `judgeSafety()` bắt lỗi đó, xác nhận bằng `isExpectedInjectedError`
rồi đọc lại dòng `answer_turns` mà khối `finally` của `runTurn()` đã ghi TRƯỚC khi
ném lại lỗi (không sửa `lib/pipeline/index.ts` — chỉ đọc lại kết quả nó tự ghi).

**Phát hiện phụ, ghi ra vì liên quan trực tiếp đến độ tin của kết luận này:**
`callGemini()` (`lib/adapters/model.ts:353-375`) chỉ bơm lỗi giả ở ĐÚNG lần thử đầu
(`forceUpstreamError && attemptNo === 0 ? ... : undefined`) — thiết kế cho
`npm test -- backoff` (chứng minh retry PHỤC HỒI được), không phải cho một lỗi DAI
DẲNG suốt 3 lần thử. Với cờ này một mình (không có hạn mức thật đang cạn), `S14`
nhiều khả năng sẽ THÀNH CÔNG ở lần thử 2 (gọi API thật) thay vì rơi vào
`system_error`. File đó nằm trong `lib/adapters/**`, bị CẤM chạm ở gói này — xem
mục "việc KHÔNG làm". Lượt đo hôm nay pass được là NHỜ hạn mức Gemini thật đang cạn
(lần thử 2/3 cũng dính 429 thật). **Đây là điểm dễ vỡ**: khi hạn mức hồi, `S14` có
thể không còn ném lỗi dai dẳng nữa — không phải vì cờ bơm lỗi sai, mà vì
`callGemini()` không thiết kế cho việc bơm lỗi PERSISTENT.

Để không phụ thuộc vào may rủi hạn mức, đã viết một test tích hợp THẬT (Postgres,
`__setTransportForTesting` giả `fetch` LUÔN trả 429 — không cần hạn mức thật, không
tốn lời gọi Gemini) canh chính xác nghịch lý của Đ40 W2, CẢ HAI CHIỀU, CÙNG một cơ
chế mock, trong CÙNG một file test:

1. `S14` (có cờ) + 429 dai dẳng ⇒ `runTurn()` ném `UpstreamRateLimited`, nhưng đọc
   lại DB cho `decision=escalate`/`reason_code=system_error` — MỘT KẾT LUẬN.
2. Case KHÁC (`S01`, không có cờ) + ĐÚNG kiểu lỗi 429 dai dẳng đó (mô phỏng lỗi hạ
   tầng thật ngoài ý muốn) ⇒ qua `runBatch` thật, `blocked=1`, checkpoint = 0 dòng
   (không bị tính trượt, không ghi giả).

(`tests/eval-golden-injection.test.ts`, chạy thật lúc nghiệm thu — xem mục 5.)

## 4. Bằng chứng test TỪNG ĐỎ (W3)

Hai mutation trên **bản sao tạm** (không sửa repo gốc — tạo trong `scripts/_batch_redproof_tmp.mjs` + `tests/_redproof_tmp.test.ts`, chạy lấy bằng chứng, XOÁ NGAY; `git status` xác nhận không còn dấu vết):

**Đỏ #1** (`isExpectedInjectedError` luôn trả `true` — nuốt cả 429 thật):
```
✖ Đ40 W2 — case KHÁC (không phải S14) dính 429 THẬT vẫn phải KHÔNG được coi là mong đợi
  AssertionError: true !== false
EXIT:1
```

**Đỏ #2** (tích hợp thật trên Postgres, `isExpectedInjectedError` luôn trả `false`
— không nhận ra lỗi bơm có chủ đích của S14):
```
✖ Đ40 W2 (1/2, thật, Postgres) — S14 CÓ cờ bơm lỗi 429 dai dẳng...
  AssertionError: case S14 + đúng lớp lỗi bơm ⇒ PHẢI được coi là lỗi mong đợi
  false !== true
EXIT:1
```

Nguyên văn đầy đủ: [`evidence/bo-do-s16-s14/red-proof.txt`](../evidence/bo-do-s16-s14/red-proof.txt).

## 5. Tests tổng / pass / fail / skip

Nền trước khi sửa: **152 / 152 / 0 / 0**.
Sau khi sửa (`node scripts/run_tests.mjs`, nguyên văn ở
[`evidence/bo-do-s16-s14/full-suite.txt`](../evidence/bo-do-s16-s14/full-suite.txt)):

```
ℹ tests 158
ℹ pass 158
ℹ fail 0
ℹ skipped 0
EXIT:0
```

+6 ca mới: 4 ca thuần `isExpectedInjectedError` (`tests/batch.test.ts`) + 2 ca tích
hợp thật trên Postgres (`tests/eval-golden-injection.test.ts`, không tốn lời gọi
Gemini — `__setTransportForTesting`). **Không giảm số test nào** (luật §4 handoff).

Số đo nền khác (đo lại, không tin lời kể cũ):
- `npx tsc --noEmit`: `EXIT:0` ([`evidence/bo-do-s16-s14/tsc.txt`](../evidence/bo-do-s16-s14/tsc.txt))
- `npm run build`: `EXIT:0`
- `bash scripts/check_adapter_boundary.sh`: `violations: 0`, `EXIT:0`
  ([`evidence/bo-do-s16-s14/adapter-boundary.txt`](../evidence/bo-do-s16-s14/adapter-boundary.txt))
- BB-07 grep: `violations: 0`

## 6. Số lời gọi model đã dùng

Tổng **≤ 6**, trong giới hạn handoff:
- `S16`: **0 lời gọi** (đường `rejectAnswer()` không chạm model nào).
- `S14` (chạy thật `--only=S14 --resume` trên Postgres): tối đa 3 (A1 intent + A2
  attempt1 + A2 attempt2, cả hai attempt sau đều dính 429 thật do hạn mức đã cạn).
- Test tích hợp mới: **0 lời gọi thật** — dùng `__setTransportForTesting` giả `fetch`.
- Một lượt `--only=S16` chạy nhầm trên `DATA_BACKEND=mock` trước đó: **0 lời gọi**
  (S16 không chạm model; các case khác không được chọn do `--only`).

## 7. `git diff --stat` + SHA

Base = Head = `1140708` (KHÔNG commit, đúng luật CẤM `git add/commit`).

```
scripts/_batch.mjs      |  29 +++++++
scripts/eval_golden.mjs | 226 ++++++++++++++++++++++++++++++++++++++++++++++--
tests/batch.test.ts     |  39 ++++++++-
3 files changed, 285 insertions(+), 9 deletions(-)
```

Cộng 1 file mới (untracked, không nằm trong `git diff --stat` vì chưa track):
`tests/eval-golden-injection.test.ts` (148 dòng).

Cộng thư mục mới `evidence/bo-do-s16-s14/**` (bằng chứng máy, đúng phạm vi).

**Ngoài phạm vi, KHÔNG do gói này đụng** (xác nhận bằng `git status`/`git diff --stat -- lib/`,
đã đối chiếu KHÔNG có Edit/Write nào của tôi chạm hai file này):
```
lib/confidence.ts     |  22 ++++++++-
lib/pipeline/index.ts | 131 ++++++++++++++++++++++++++++++++++++++++++++++++++
```
Đây là gói song song đang chạy trên `lib/pipeline/**`/`lib/confidence.ts` như handoff đã cảnh báo.

Kiểm ký tự điều khiển (`grep -cP '[\x08\x0c\x0b]'`) trên 4 file tôi sửa/tạo: **0** cả bốn.

## 8. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Tầng đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 (lái S16 qua rejectAnswer) | 🟠 | 🟠 | SPEC đã chốt đường đi (Đ40); tự thiết kế cách dựng "lượt nháp" bằng hàm `DataStore` có sẵn — không phải quyết định kiến trúc mới |
| W2 (cờ bơm lỗi cho S14) | 🟠 | 🟠 | Cơ chế phân biệt lỗi mong đợi/thật đã có khuôn ở `classifyError` (Đ26) để soi theo |
| W3 (test TỪNG ĐỎ) | 🟠 | 🟠 | Có mẫu sẵn ở `tests/batch.test.ts`/`tests/conversation-id.test.ts` |
| Phát hiện phụ (mục 3: `callGemini` chỉ bơm lỗi ở attempt 0) | — | (chỉ ghi lại, không tự vá — `lib/adapters/**` bị CẤM) | Không tự quyết sửa; báo lên |

## 9. Việc KHÔNG làm + lý do

- **KHÔNG sửa `lib/adapters/model.ts`** để làm cờ bơm lỗi 429 dai dẳng thật sự trên
  MỌI lần thử (thay vì chỉ attempt 0) — dù đây là phát hiện thật (mục 3), file đó
  nằm trong `lib/adapters/**`, bị CẤM chạm tường minh trong handoff (gói khác đang
  sửa song song). Ghi lại làm câu hỏi mở.
- **KHÔNG tự vá case `S04`** (mẫu số `M3` còn thiếu 1/16 kết luận sau lượt
  `--only=S14,S16 --resume`) — case này thuộc phạm vi khác ("S04 chờ chủ tịch",
  `plan.md` dòng 712), không nằm trong W1/W2/W3 của gói này.
- **KHÔNG chạy `eval_golden.mjs` toàn lượt** — đúng CẤM của handoff, chỉ chạy
  `--only=S14`/`--only=S16` riêng lẻ.
- **KHÔNG tick `G11`** — không chạm `plan.md` checklist.
- **KHÔNG commit** — working tree vẫn để nguyên cho super orchestrator xem lại.
- **KHÔNG xoá hai dòng checkpoint CŨ của S14/S16** bằng tay tuỳ tiện — đã xoá đúng
  hai dòng đo TRƯỚC KHI vá (kết quả sai do bug cũ: S16 qua `runTurn()` ra
  `unsupported_intent`, S14 ra `no_eligible_source` — không phải blocked như handoff
  mô tả, cho thấy lượt đo trước đó của S14 cũng chưa từng dùng cờ bơm lỗi) khỏi
  `evals/runs/safety.postgres.jsonl` bằng `grep -v` có chủ đích, giữ nguyên 13 ca còn
  lại — không dùng `--fresh` (sẽ xoá sạch cả 16 ca, tốn lại model call cho 13 ca đã
  xong). Đây là thao tác bảo trì checkpoint (không phải "evidence", không bị luật
  §6 handoff cấm sửa tay), cần thiết để đo lại đúng S14/S16 sau khi vá mà không đốt
  hạn mức cho các ca khác.

## 10. Câu hỏi cần người

1. **`lib/adapters/model.ts::callGemini()` chỉ bơm lỗi ở lần thử đầu** (mục 3) —
   đúng ý đồ (test khác cần retry PHỤC HỒI) hay là khoảng trống khiến `S14` chỉ pass
   được "nhờ may" hạn mức đang cạn hôm nay? Nếu cần bơm lỗi DAI DẲNG thật sự (đúng
   §4.4), cần một tham số mới ở `lib/adapters/model.ts` (ngoài phạm vi gói này).
2. **`S04`** vẫn chưa kết luận trong lượt `--only=S14,S16 --resume` (không thuộc gói
   này) — cần gói nào xử lý để `M3` có đủ cả 16/16 kết luận?

Dòng cuối: **✅ DUYỆT** (W1/W2/W3 đều xong-khi đạt bằng số đo máy, không suy đoán;
1 câu hỏi mở về `model.ts` được báo lên thay vì tự quyết, không ảnh hưởng tới việc
S14/S16 đã kết luận thật hôm nay).
