1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `brain4agent/-known-gotchas.md` **G35, G36** → `specs/SPEC-P03-BQL-Console.md` **§3.1** (cái gì vào hàng đợi — nguyên văn), §3.3, §3.4, §3.5, §5 (vùng cấm P03-C3/C5) → `lib/adapters/db.ts` phần `insertAnswerTurn` của `PostgresDataStore` và `MockDataStore` → `app/(bql)/layout.tsx`, `app/(bql)/review/ReviewQueueList.tsx`, `lib/adapters/bql-store.ts` `listReviewQueue`.

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base = `git rev-parse --short HEAD` lúc bạn bắt đầu (ghi vào report). Demo local ngày mai. Đo thật 2026-09-23: (a) toàn app **0 thẻ `<a>`/`<Link>`**, BQL vào `/documents` không có đường sang `/review`/`/dashboard`/`/eval`, không có nút đăng xuất; (b) `INSERT INTO review_queue` chỉ tồn tại ở `scripts/eval_golden.mjs:285` (fixture) — **sản phẩm không có đường ghi vào hàng đợi**, dù SPEC-P03 §3.1 đòi "mọi `answer_turn` escalate ⇒ một dòng `review_queue` pending, cùng transaction"; (c) 3 nút Duyệt/Sửa/Từ chối chỉ khoá theo `useTransition`, không theo `state`.
Số nền (đo lại): `tsc` 0 · test 172/172 · `.env.local` có `DATA_BACKEND=postgres`.

## 2. PHẠM VI
**Được ghi:** `lib/adapters/db.ts` (chỉ trong `insertAnswerTurn` hai cài đặt + kiểu `AnswerTurnInput` nếu cần) · `lib/adapters/store-mock.ts` (chỉ `insertAnswerTurn`) · `lib/adapters/bql-store.ts` · `app/(bql)/**` · file CSS đang dùng cho BQL (nếu cần class nav) · `tests/hitl-enqueue.test.ts` (mới) · `evidence/h16-bql/**`.
**CẤM chạm:** `app/(resident)/**`, `app/api/**` (gói H15 song song) · `lib/pipeline/**` · `lib/confidence.ts` · `lib/adapters/model.ts` · `scripts/**` (gói H17 song song) · `evals/**` · `knowledge/**` · migration đã chạy · `package.json` · `planning/**` ngoài evidence+report · `brain4agent/**`.
**CẤM** `git add/commit/push/stash/reset/checkout`. **CẤM** xoá dữ liệu DB ngoài dữ liệu test của chính bạn. **CẤM** đưa `decision='answer'` hay `'clarify'` vào hàng đợi (P03-C3).

## 3. VIỆC PHẢI LÀM
**W1 — Enqueue trong `insertAnswerTurn` (Postgres).** Khi `decision === 'escalate'` **và** `is_golden_run === false`: trong CÙNG transaction với INSERT `answer_turns`, INSERT `review_queue(answer_turn_id, state='pending', original_draft_vi)`. `original_draft_vi` = câu từ chối hiển thị cho cư dân, lấy qua `reasonMessageVi(reason_code)` ở `lib/reason-messages.ts` (import thuần, không mở connection), tiền tố `[Từ chối tự động · <reason_code>] `. Quyết định đã chốt bởi SO (🔴): golden run KHÔNG vào hàng đợi (script tự lo fixture của nó, tránh 66 ca nhuộm hàng đợi). Mock: ghi vào một mảng nội bộ đọc được từ test (giữ tinh thần Đ43: mock không dễ tính hơn Postgres về hình dạng dữ liệu). **Xong khi:** `tests/hitl-enqueue.test.ts` chạy trên Postgres thật (cách nạp env như `tests/memory.test.ts`): một lượt escalate ⇒ đúng 1 dòng `review_queue` pending trỏ tới đúng `answer_turn_id`; một lượt `answer` ⇒ 0 dòng; một lượt escalate với `is_golden_run=true` ⇒ 0 dòng. Test PHẢI tự dọn: `DELETE FROM conversations WHERE id=$1` ở `after()` (cascade). Lưu `node scripts/sql.mjs "select count(*) from review_queue r join answer_turns a on a.id=r.answer_turn_id where a.decision<>'escalate'"` ⇒ 0 vào `evidence/h16-bql/p03_m4.txt`.
**W2 — Thanh điều hướng BQL.** Trong `app/(bql)/layout.tsx` thêm header có 4 `<Link>`: Tài liệu `/documents` · Hàng đợi duyệt `/review` · Dashboard `/dashboard` · Eval `/eval`, kèm email đang đăng nhập và nút Đăng xuất (`<form method="post" action="/api/auth/logout">`). **Xong khi:** `grep -c "<Link" "app/(bql)/layout.tsx"` ≥ 4; `npm run build` 0; curl 4 trang với cookie BQL ⇒ 200 và body chứa 4 href (lưu `evidence/h16-bql/w2_nav.txt`).
**W3 — Khoá nút theo state + pending trước.** `ReviewQueueList`: dòng có `state !== 'pending'` ⇒ 3 nút `disabled` + nhãn trạng thái; danh sách sắp xếp pending trước, mới nhất trước. Nếu `listReviewQueue` chưa trả `state` thì thêm cột vào SELECT. **Xong khi:** `tsc` 0 và một test unit nhỏ cho logic sắp xếp/khoá.
**W4 — Cổng chung:** `tsc` 0 · `npm run build` 0 · `node scripts/run_tests.mjs` ≥ 173 pass / 0 fail / 0 skip · `bash scripts/check_adapter_boundary.sh` `violations: 0`.

## 4. LUẬT
Bộ đo mới phải từng ĐỎ (tắt enqueue ⇒ test đỏ; ghi output vào evidence). Một câu SQL cho một việc, đúng phong cách `bql-store.ts`. Thấy việc ngoài phạm vi ⇒ GHI vào report, không tự làm.

## 5. TẦNG
W1 🟠 · W2 🟢 · W3 🟢 · W4 🟢.

## 6. REPORT
Ghi `reports/R19_thi-cong_bql-nav-hitl-enqueue.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 Handoff/Base/Head; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc KHÔNG làm; câu hỏi cần người; dòng cuối ✅/🔁/⛔).
