1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `plan.md` §2 **Đ56** mục 3 → `specs/SPEC-P00-Knowledge-Golden.md` §6.5 (dòng `citation`, `critical_fact` đã sửa theo Đ56) → `lib/eval/score.ts` (`GoldenFaqCase`, `citesAll`, `containsAllVi`, `judgeFaqCase`) → `lib/adapters/metrics-store.ts` (chỗ import từ `score.ts`) → `scripts/validate_golden.mjs` (K-M2) → `evals/golden/golden_faq.jsonl` (ca F-I01-05, F-I01-06, F-I04-05) → `evals/golden/rubric.md` → `tests/scorer-consensus.test.ts`, `tests/gate-set.test.ts` (mẫu test bộ chấm).

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `feature/nhuy`, base = `git rev-parse --short HEAD`. Chủ tịch duyệt Đ56: ba ca Golden trả lời ĐÚNG nhưng bị chấm trượt vì dữ kiện có ở nhiều section / cùng nghĩa khác chữ. `lib/eval/score.ts` là bộ chấm Golden DUY NHẤT (cả `scripts/eval_golden.mjs` lẫn `/eval` import từ đó). Số nền: tsc 0 · test 263/263.

## 2. PHẠM VI
**Được ghi:** `lib/eval/score.ts` · `scripts/validate_golden.mjs` · `evals/golden/golden_faq.jsonl` (CHỈ 3 ca F-I01-05, F-I01-06, F-I04-05) · `evals/golden/rubric.md` · `tests/golden-any-of.test.ts` (mới) · `planning/01_2026-09-20_resident-agent-v1/evidence/h28-golden-any-of/**` · `reports/R32_thi-cong_d56-golden-any-of.md`.
**CẤM chạm:** `lib/pipeline/**` (worker H27 đang sửa), `lib/adapters/**`, mọi ca Golden khác, `golden_safety.jsonl`, `expected_defects.json`, `knowledge/**`, `db/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json`.
**CẤM** `git add/commit/push`. **CẤM `git stash` / `git checkout -- <file>` / `git reset` / `git clean`** (AGENTS.md §5.D.5 — cây chung với H27). **CẤM** chạy Golden (SO chạy sau). **CẤM** dùng cơ chế "một trong các" cho ca nào ngoài 3 ca đã nêu.

## 3. VIỆC PHẢI LÀM
**W1 — Bộ chấm.** `must_cite_section_ids: Array<string | string[]>`, `must_contain_vi: Array<string | string[]>`. `citesAll`: phần tử chuỗi ⇒ phải có; phần tử mảng ⇒ có ít nhất một. `containsAllVi`: phần tử mảng ⇒ ít nhất một biến thể xuất hiện (cùng chuẩn hoá bỏ dấu/hoa thường như hiện tại). Dạng chuỗi cũ giữ nguyên nghĩa. **Xong khi:** `tests/golden-any-of.test.ts`: mảng `[A,B]` + trích B ⇒ pass; trích C ⇒ fail; chuỗi `A` + trích B ⇒ fail (hành vi cũ); `must_contain_vi: [["x","y"]]` + câu có "y" ⇒ pass, không có cả hai ⇒ fail.
**W2 — Dữ liệu 3 ca** (giữ nguyên mọi trường khác, giữ kiểu xuống dòng của file): F-I01-05 `must_cite_section_ids: [["CARD-TIME-06","CARD-NEW-02"]]`; F-I01-06 `must_cite_section_ids: [["CARD-CONTACT-07","BQL-CONTACT-03"]]`; F-I04-05 `must_contain_vi: [["cấp phép thi công","được cấp phép"]]`. TRƯỚC khi ghi, xác minh bằng `grep` trên `knowledge/` rằng dữ kiện ("3 ngày làm việc", "hotline nội bộ", nội dung cấp phép) THỰC SỰ có trong section thay thế — nếu không có ⇒ KHÔNG thêm section đó, ghi report.
**W3 — K-M2.** `validate_golden.mjs` chấp nhận phần tử mảng (mỗi section_id trong mảng phải tồn tại trong `knowledge/` như luật hiện có với chuỗi); vẫn in `faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10`, exit 0. **Chứng minh đỏ:** tạm đưa một section_id không tồn tại vào mảng ⇒ exit ≠ 0 (lưu `red_km2.txt`), rồi hoàn lại.
**W4 — rubric.md** thêm một dòng giải thích "phần tử mảng = một trong các (Đ56)".
**W5 — Cổng:** `npx tsc --noEmit` 0 · `node scripts/run_tests.mjs` ≥ 263 + mới, 0 fail, 0 skip (test Postgres đỏ vì tranh kết nối ⇒ chạy lại riêng, ghi rõ) · `node scripts/validate_golden.mjs` exit 0 · `node scripts/validate_knowledge.mjs` `defects_ok: 4/4`. Chứng minh đỏ cho test mới (`red.txt`/`green.txt`).

## 4. LUẬT
Sửa tối thiểu. Không để lại tiến trình nền. Thấy việc ngoài phạm vi ⇒ GHI report.

## 5. TẦNG
W1 🟠 · W2 🟢 · W3 🟠 · W4 🟢 · W5 🟢.

## 6. REPORT
`reports/R32_thi-cong_d56-golden-any-of.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc KHÔNG làm; câu hỏi cần người; dòng cuối ✅/🔁/⛔).
