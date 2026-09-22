# R20 — Thi công: demo R7 + test tự dọn (H17)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude, Sonnet 5 · Bước 0: exit 0 ·
hiểu việc: viết `scripts/demo_r7.mjs` (kịch bản 3 bước BQL đổi status tài liệu ⇒ câu trả lời
đổi ngay, đi qua `setDocumentStatus` của `lib/adapters/bql-store.ts`) + làm 4 file test ghi
Postgres tự dọn `conversation_id` chúng tạo ra, KHÔNG đổi assertion, KHÔNG chạm `lib/**`/`app/**`.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H17_demo-r7-test-tu-don.md`
Base: `18cbd29`
Head (chưa commit — worktree, chưa `git add/commit` theo CẤM của handoff): `4037c27` + working
tree hiện tại (xem `git diff --stat` bên dưới; HEAD dịch sang `4037c27` trong lúc làm vì gói
khác đã commit song song — không phải do tôi).

## 1. Lệnh + exit code nguyên văn

```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!
EXIT:0

$ npx tsc --noEmit
(không có output)
EXIT:0

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT:0

$ node --env-file=.env.local --test tests/memory.test.ts tests/conversation-id.test.ts \
       tests/conflict-citations.test.ts tests/eval-golden-injection.test.ts
tests 18
pass 18
fail 0
cancelled 0
skipped 0
todo 0
EXIT:0

$ node --env-file=.env.local scripts/run_tests.mjs   (TOÀN BỘ 175 test, không lọc theo file)
tests 175
pass 174
fail 1   -- tests/eligibility-top.test.ts (NGOÀI phạm vi H17 — xem mục "việc KHÔNG làm")
EXIT:1

$ node --env-file=.env.local scripts/demo_r7.mjs --document=NOT-A-REAL-DOCUMENT-ID
[1] TRƯỚC: decision=answer citations=["POOL-SAFE-03"]
SAI HÀNH VI: setDocumentStatus("NOT-A-REAL-DOCUMENT-ID", "Deprecated") thất bại: NotFound...
EXIT:1   -- bộ đo mới ĐỎ đúng (evidence/h17-r7/demo_r7_wrong_document_red.txt)

$ node --env-file=.env.local scripts/demo_r7.mjs   (document đúng, 13 lần thử trong ~25 phút)
BLOCKED: UpstreamRateLimited (12/13 lần) — 1 lần lọt qua bước [1]:
[1] TRƯỚC: decision=answer citations=["POOL-SAFE-03"]
rồi vẫn BLOCKED ở bước [2]
EXIT:3 mọi lần -- CHƯA đạt exit=0 (xem mục "việc KHÔNG làm" — quota A2 cạn thật)
```

## 2. Test tổng/pass/fail/skip

- 4 file trong phạm vi H17 (chạy cô lập): **18 tổng / 18 pass / 0 fail / 0 skip**.
- Toàn bộ `tests/` (175 file `.test.ts`, gồm cả file MỚI ngoài phạm vi của gói khác):
  **175 tổng / 174 pass / 1 fail / 0 skip** — ca fail duy nhất (`tests/eligibility-top.test.ts`)
  nằm ngoài 4 file được giao, xem mục 5.

## 3. `git diff --stat` + SHA

```
tests/conflict-citations.test.ts    | 23 +++++++++++++++++++++--
tests/conversation-id.test.ts       | 18 ++++++++++++++++++
tests/eval-golden-injection.test.ts | 12 ++++++++++++
tests/memory.test.ts                | 19 +++++++++++++++++++
4 files changed, 70 insertions(+), 2 deletions(-)
```
File MỚI (không nằm trong `git diff --stat`, `git status` báo `??`):
`scripts/demo_r7.mjs`, `tests/_pg-cleanup.ts`, `evidence/h17-r7/**`.
HEAD tại thời điểm viết report: `4037c27` (gói khác đã commit song song trong lúc tôi làm —
không phải commit của tôi; tôi KHÔNG `git add/commit/push` theo đúng CẤM của handoff).

## 4. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Tầng đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 — `scripts/demo_r7.mjs` | 🟠 | 🟠 (tự làm, đọc SPEC-P03 §2.1/§2.2/§2.5 trước) | Logic đúng theo SPEC; BLOCKED do quota A2, không phải lỗi tầng này |
| W2 — test tự dọn (4 file) | 🟢 | 🟢 (tự làm, theo mẫu `test.afterEach`/`test.after` sẵn có trong `tests/backoff.test.ts`) | Xác minh bằng cách log id + query lại DB, không chỉ tin log |
| W3 — cổng chung | 🟢 | 🟢 (chạy lệnh có sẵn) | tsc 0, boundary 0; `run_tests.mjs` toàn bộ có 1 fail ngoài phạm vi |

## 5. Việc KHÔNG làm + lý do

1. **W1 "xong khi" (exit=0, `evidence/h17-r7/demo_r7_exit0.txt`) CHƯA đạt.** Đã thử 13 lần
   trong ~25 phút (2 đợt lặp nền + vài lần tay, cách nhau 60–90s). 12/13 lần `BLOCKED:
   UpstreamRateLimited` — model A2 (`MODEL_A2=gemini-3.6-flash`) trả 429 "You exceeded your
   current quota" (xác minh ĐỘC LẬP bằng `scripts/trace_sample.mjs`, không liên quan gì tới
   code của tôi — cùng lỗi, cùng model). Đây là lỗi Tầng 1 thật (AGENTS.md §5.E/Đ26), script
   phân lập đúng (`BLOCKED`, exit=3, không tính là trượt). 1 lần lọt qua được bước [1] (ra
   đúng `decision=answer citations=["POOL-SAFE-03"]`) rồi vẫn dính BLOCKED ở bước [2] — đủ để
   xác nhận LOGIC bước [1] đúng, nhưng KHÔNG đủ điều kiện "xong khi" (cần đủ 3 dòng, exit=0).
   Chi tiết đầy đủ + bằng chứng: `evidence/h17-r7/W1_STATUS.txt`,
   `evidence/h17-r7/demo_r7_retry_log.txt`, `evidence/h17-r7/demo_r7_retry_log2.txt`.
   Trạng thái tài liệu demo vẫn đúng `Approved` sau mọi lần thử (script luôn khôi phục ở
   `finally`, kể cả khi BLOCKED) — xác minh bằng `scripts/sql.mjs`.
2. **`tests/eligibility-top.test.ts` fail khi chạy `run_tests.mjs` toàn bộ.** File này NẰM
   NGOÀI 4 file được giao trong handoff H17 mục 2. `git status` cho thấy nó KHÔNG bị tôi sửa;
   thất bại lặp lại ổn định (`top1=COM-HOURS-02` thay vì `expired_or_unknown`) và
   `lib/adapters/db.ts`/`lib/adapters/bql-store.ts` đang bị SỬA SONG SONG bởi gói khác (đúng
   như handoff đã cảnh báo) — CẤM chạm `lib/**` nên tôi không điều tra/sửa. Báo lên để người
   phụ trách gói đó (hoặc gói giữ `lib/adapters/db.ts`) kiểm tra.
3. **W2 — số đếm `answer_turns` "trước/sau" không tuyệt đối ổn định khi đo trên TOÀN BỘ
   `run_tests.mjs`**, vì các file test MỚI khác (`tests/eligibility-top.test.ts`,
   `tests/hitl-enqueue.test.ts`, `tests/chat-history.test.ts` — đều `??`, thuộc gói khác,
   ngoài phạm vi H17) tự ghi Postgres mà KHÔNG tự dọn. Đã đo CÔ LẬP đúng 4 file thuộc phạm vi
   2 lần: lần 1 count TRƯỚC=SAU=454 (bằng nhau tuyệt đối, lúc DB yên); lần 2 (20 phút sau, gói
   khác vẫn đang chạy) 455→457 (lệch do việc khác, không phải 4 file này — đã xác minh bằng
   cách log trực tiếp 5 `conversation_id` do `tests/memory.test.ts` tạo rồi truy vấn lại: cả 5
   đều KHÔNG còn tồn tại sau `test.after`). Cả hai lần đo lưu trong
   `evidence/h17-r7/w2_count_before_after.txt` theo đúng yêu cầu "nếu lệch, chạy lại đo một
   lần nữa lúc yên và ghi cả hai lần".

## 6. Câu hỏi cần người

1. **W1 chưa có bằng chứng exit=0.** Đề nghị: chạy lại `node --env-file=.env.local scripts/demo_r7.mjs`
   khi quota Gemini A2 hồi (kiểm rẻ bằng `trace_sample.mjs` trước), hoặc cấp API key/billing
   khác riêng cho phiên demo ngày mai để tránh rủi ro đúng lúc trình diễn. Script đã sẵn sàng,
   không cần sửa gì thêm về logic (đã thấy chạy đúng ở bước [1] và ở nhánh lỗi NotFound).
2. **`tests/eligibility-top.test.ts` đang đỏ** do thay đổi song song ở `lib/adapters/db.ts` —
   cần người giữ gói đó xác nhận có chủ đích hay là hồi quy.

---
✅ DUYỆT (W2, W3) / 🔁 SỬA: W1 cần chạy lại `demo_r7.mjs` khi quota A2 hồi để lấy bằng chứng
exit=0 — code đã sẵn sàng, chỉ thiếu bằng chứng do hạ tầng (Tầng 1), không phải lỗi thi công.
