1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `plan.md` §2 **Đ56** mục 1–2 → `specs/01-CONTRACTS.md` §5 bảng E-1…E-7 (dòng E-5, E-6 đã sửa theo Đ56) → `specs/SPEC-P02-Agent-Pipeline.md` §4 (eligibility, G1/G2) → `lib/pipeline/eligibility.ts` (toàn file) → `lib/pipeline/index.ts` quanh dòng 620–660 (`applyEligibility(...)`, `conflictDetected`, `buildConflictCitations`) → `tests/eligibility-top.test.ts`, `tests/g3-on-topic.test.ts`, `tests/conflict-citations.test.ts` (DEF-03 thật trên Postgres) → `evidence/so-g11-golden/phan_loai_truot_20260923_1200.txt` (ca F-I03-02, F-I05-04, F-I05-05).

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `feature/nhuy`, base = `git rev-parse --short HEAD`. Golden M1 = 28/40 (ngưỡng 34). Chủ tịch duyệt Đ56. Hai lỗi thật: (a) cư dân căn hộ hỏi "Hàng rào mặt tiền biệt thự được cao tối đa bao nhiêu?" / "Khu Thương mại dịch vụ hoạt động đến mấy giờ?" — section đúng xếp hạng 1 nhưng bị E-6 loại `scope_mismatch` ⇒ từ chối oan; (b) "Vườn Nướng BBQ mỗi hộ được đặt tối đa mấy lượt một tuần?" — section đúng `BBQ-BOOK-02` hạng 1, nhưng cặp mâu thuẫn về sức chứa (`CG-BBQ-CAPACITY`) lọt tập ⇒ G1 oan. Số nền: tsc 0 · test 263/263 · BB-05/07/10 = 0.

## 2. PHẠM VI
**Được ghi:** `lib/pipeline/eligibility.ts` · `lib/pipeline/index.ts` (CHỈ lời gọi `applyEligibility` để truyền câu hỏi) · `tests/eligibility-d56.test.ts` (mới) · sửa test cũ nếu chữ ký đổi (`eligibility-top`, `g3-on-topic`) · `planning/01_2026-09-20_resident-agent-v1/evidence/h27-eligibility/**` · `reports/R31_thi-cong_d56-eligibility.md`.
**CẤM chạm:** `lib/eval/**`, `evals/**`, `scripts/**` (một worker khác — H28 — đang sửa bộ chấm và dữ liệu Golden), `lib/adapters/**`, `lib/types.ts`, `db/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json`.
**CẤM** `git add/commit/push`. **CẤM `git stash` / `git checkout -- <file>` / `git reset` / `git clean`** (AGENTS.md §5.D.5 — cây làm việc CHUNG với H28). **CẤM** LLM trong eligibility (VC-04). **CẤM** chạy Golden (SO chạy sau).

## 3. VIỆC PHẢI LÀM
**W1 — E-6 theo loại câu hỏi nêu thẳng.** `applyEligibility(retrieved, principal, now, queryVi?: string)`: thêm hằng `PROPERTY_MENTIONS` + hàm export `mentionedPropertyTypes(queryVi): PropertyType[]` đúng từ điển ở `01-CONTRACTS` §5 dòng E-6 (so khớp sau bỏ dấu + chữ thường; dùng lại hàm bỏ dấu sẵn có trong repo nếu có, không thì viết thuần NFD). `loại_hiệu_lực = mentioned.length ? mentioned : principal.property_type`. `index.ts` truyền câu hỏi đã chuẩn hoá. **Xong khi:** test: "Hàng rào mặt tiền biệt thự…" ⇒ `['villa']`; "Khu Thương mại dịch vụ…" ⇒ `['commercial']`; "Nuôi thú cưng trong căn hộ…" ⇒ `['apartment']`; "Nuôi thú cưng cần điều kiện gì?" ⇒ `[]` (dùng loại của principal); và `applyEligibility` với principal `apartment` + chunk scope `{villa}` + câu có "biệt thự" ⇒ eligible, câu không nêu loại ⇒ `scope_mismatch`.
**W2 — E-5 chỉ báo khi nguồn hạng cao nhất bị tranh chấp.** Giữ nguyên việc LOẠI mọi thành viên nhóm mâu thuẫn (`conflict`). `conflict_groups` trả về CHỈ gồm nhóm chứa section của chunk xếp hạng cao nhất trong `passedFirstPass` (tập đã qua E-1..E-4/E-6, giữ thứ tự `retrieved`). Không nhóm nào như vậy ⇒ `conflict_groups = []` và pipeline đi tiếp với `eligible` còn lại. **Xong khi:** test đơn vị: tập [BOOK (không nhóm), CAP-01 (nhóm G), AMEN-07 (nhóm G)] ⇒ `conflict_groups=[]`, CAP-01/AMEN-07 trong `rejected` lý do `conflict`, BOOK trong `eligible`; tập [CAP-01, BOOK, AMEN-07] ⇒ `conflict_groups=['G']`. **VÀ** `tests/conflict-citations.test.ts` (DEF-03 thật, Postgres) VẪN XANH — S03 phải ra G1; nếu đỏ ⇒ DỪNG, ghi report số đo hạng thật của câu S03, KHÔNG nới test.
**W3 — Đo thật không gọi model:** script tạm trong `evidence/h27-eligibility/` (KHÔNG trong `scripts/`) gọi `searchLexical` + `applyEligibility` trên Postgres cho 4 câu: F-I05-04, F-I05-05, F-I03-02 (kỳ vọng: section đúng nằm trong `eligible`, `conflict_groups=[]`) và câu S03 "Vườn BBQ cho tối đa bao nhiêu người một lượt?" (kỳ vọng `conflict_groups=['CG-BBQ-CAPACITY']`). Lưu output `probe.txt`.
**W4 — Chứng minh đỏ:** mỗi test mới từng ĐỎ trên mã cũ (chạy trước khi sửa, lưu `red.txt`), xanh sau (`green.txt`).
**W5 — Cổng:** `npx tsc --noEmit` 0 · `node scripts/run_tests.mjs` ≥ 263 + mới, 0 fail, 0 skip (nếu test Postgres đỏ vì `EMAXCONNSESSION`/tranh kết nối thì chạy lại riêng file đó và ghi rõ) · `bash scripts/check_adapter_boundary.sh` 0 · `bash scripts/check_no_hardcoded_knowledge.sh` 0 (từ điển loại BĐS là từ chung, không phải document_id).

## 4. LUẬT
Sửa tối thiểu, comment tiếng Việt trỏ Đ56/§5. Không để lại dữ liệu/tiến trình nền. Thấy việc ngoài phạm vi ⇒ GHI report.

## 5. TẦNG
W1 🟠 · W2 🔴 (đổi hành vi cổng an toàn) · W3 🟠 · W4 🟢 · W5 🟢.

## 6. REPORT
`reports/R31_thi-cong_d56-eligibility.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc KHÔNG làm; câu hỏi cần người; dòng cuối ✅/🔁/⛔).
