1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `brain4agent/-known-gotchas.md` **G37** → `specs/SPEC-P03-BQL-Console.md` **§2.1, §2.5** (bảng ảnh hưởng tới retrieval) → `specs/TESTING-ACCEPTANCE.md` dòng 37 (`T-R7`) và dòng 486 (`G09`: "3 dòng đúng thứ tự") → `scripts/_batch.mjs`, `scripts/_pg.mjs`, `scripts/_fixtures.mjs`, `scripts/trace_sample.mjs` (mẫu gọi `runTurn` từ script) → 4 file test: `tests/memory.test.ts`, `tests/conversation-id.test.ts`, `tests/conflict-citations.test.ts`, `tests/eval-golden-injection.test.ts`.

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base = `git rev-parse --short HEAD` lúc bạn bắt đầu (ghi vào report). Demo local ngày mai. (a) `scripts/demo_r7.mjs` mà `TESTING-ACCEPTANCE` đòi cho gate `G09` **không tồn tại** — đây là cảnh demo thuyết phục nhất của vai BQL (đổi status tài liệu ⇒ agent đổi câu trả lời ngay). (b) 4 file test ép `DATA_BACKEND=postgres` và gọi `runTurn()` thật vào Supabase demo, **không dọn** ⇒ 430 dòng `answer_turns` gần như toàn fixture (119 lần cùng một câu) đang nhuộm dashboard. Dọn DB xong mà test không tự dọn thì lần `npm test` kế tiếp nhuộm lại.
Số nền: `tsc` 0 · test 172/172 · `.env.local` có `DATA_BACKEND=postgres`, `MODEL_A2=gemini-3.6-flash` (A2 gốc đang 429/503 — G34; A2 mới có thể mất 20–30 s một lượt).

## 2. PHẠM VI
**Được ghi:** `scripts/demo_r7.mjs` (mới) · 4 file test ở mục 3 (chỉ thêm dọn dẹp, không đổi assertion) · `tests/_pg-cleanup.ts` hoặc helper tương đương (mới, nếu cần) · `evidence/h17-r7/**`.
**CẤM chạm:** `lib/**` · `app/**` · `scripts/*` khác ngoài file mới · `evals/**` · `knowledge/**` · migration · `package.json` · `planning/**` ngoài evidence+report · `brain4agent/**`.
**CẤM** `git add/commit/push/stash/reset/checkout`. **CẤM** xoá dữ liệu ngoài dữ liệu do chính script/test vừa tạo. **CẤM** sửa thẳng `documents` bằng SQL trong `demo_r7.mjs` — phải đi qua `setDocumentStatus`/`setEffectiveStatus` của `lib/adapters/bql-store.ts` (đúng đường Server Action).

## 3. VIỆC PHẢI LÀM
**W1 — `scripts/demo_r7.mjs`.** Kịch bản 3 bước, in đúng 3 dòng theo thứ tự: (1) hỏi một câu có nguồn Approved/Current (mặc định `"Trẻ em dưới 12 tuổi có được vào bể bơi một mình không?"`, tài liệu `OCP1-POOL-RULES-001`) ⇒ in `[1] TRƯỚC: decision=answer citations=[…]`; (2) gọi `setDocumentStatus({document_id, status:'Deprecated'})` ⇒ hỏi lại ⇒ in `[2] SAU KHI HẠ STATUS: decision=escalate reason_code=…`; (3) khôi phục `Approved` ⇒ hỏi lại ⇒ in `[3] KHÔI PHỤC: decision=answer`. Dùng `try/finally` để **luôn khôi phục status** kể cả khi lỗi. Cờ `--question=`, `--document=`; tự nạp `.env.local` như `_batch.mjs`. Lỗi Tầng 1 (429/503) ⇒ in `BLOCKED` và exit 3, không exit 1. Mã thoát: 0 = đủ 3 dòng đúng; 1 = sai hành vi; 3 = chưa kết luận. Mỗi lượt `runTurn` dùng hội thoại riêng và **xoá hội thoại đó ở cuối** (cascade). **Xong khi:** chạy thật trên Postgres ⇒ exit 0, output lưu `evidence/h17-r7/demo_r7_exit0.txt`; `node scripts/sql.mjs "select status from documents where document_id='OCP1-POOL-RULES-001'"` ⇒ `Approved` sau khi chạy.
**W2 — Test tự dọn.** Trong 4 file test ghi Postgres: gom `conversation_id` đã tạo, `after()` chạy `DELETE FROM conversations WHERE id = ANY($1)` (cascade xoá messages/answer_turns/review_queue). Không đổi assertion. **Xong khi:** `node scripts/sql.mjs "select count(*) from answer_turns"` TRƯỚC và SAU `node scripts/run_tests.mjs` cho **cùng một số**; lưu cả hai vào `evidence/h17-r7/w2_count_before_after.txt`; test tổng ≥ 172 / 0 fail / 0 skip.
**W3 — Cổng chung:** `tsc` 0 · `node scripts/run_tests.mjs` 0 · `bash scripts/check_adapter_boundary.sh` `violations: 0`.

## 4. LUẬT
Bộ đo mới phải từng ĐỎ: chạy `demo_r7.mjs` với `--document=` sai ⇒ exit ≠ 0, ghi evidence. Luật phân lập Tầng 1 (Đ26): 429/503 ⇒ BLOCKED, không phải trượt. Thấy việc ngoài phạm vi ⇒ GHI vào report.

## 5. TẦNG
W1 🟠 · W2 🟢 · W3 🟢.

## 6. REPORT
Ghi `reports/R20_thi-cong_demo-r7-test-tu-don.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 Handoff/Base/Head; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc KHÔNG làm; câu hỏi cần người; dòng cuối ✅/🔁/⛔).
