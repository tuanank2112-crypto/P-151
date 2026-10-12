Worker · thi công · Claude Sonnet 5.5 (claude-sonnet-5-5), 🟠 · Bước 0 exit=1 (MODULE_NOT_FOUND, không sửa) · hiểu việc: phạm vi = chỉ ghi P/deliverables/tools/{validate_day05.py,run_day05_baseline.py,build_review_pack.py,tests/test_*.py}, P/evidence/run01-tools/*.txt, P/reports/R03_tools.md; xong khi = pytest exit 0 và 0 skip, ruff check exit 0, ruff format --check exit 0, typecheck NOT_CONFIGURED; cấm = sửa src/seed/tests có sẵn, đọc/dùng dữ liệu H02 để làm xanh, mạng/LLM/Supabase, git add/commit/push, hạ gate, đoán reviewer là người
Handoff: handoffs/H03_tools.md
Base: 8dd6baa5e733fd9dd917b30522b131d520471e05
Head: (chưa commit)

P = planning/09_2026-10-07_day05-labels. Evidence = P/evidence/run01-tools/.

## 1. Lệnh và exit code (nguyên văn, stdout lưu trong evidence)

| Lệnh (từ C:\P-151-truong) | Exit | Evidence |
| :--- | :--- | :--- |
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 1 (`Cannot find module 'C:\brain4agent.release\.agents\skills\.xay-dung-nao-bo\scripts\init_brain.js'`, code MODULE_NOT_FOUND) | step0-boot.txt |
| `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest P/deliverables/tools/tests -q -p no:cacheprovider` | 0 (`95 passed in 3.31s`) | pytest.txt |
| `PYTHONUTF8=1 .venv/Scripts/python.exe -m pytest P/deliverables/tools/tests -v -rs -p no:cacheprovider` | 0 (95 PASSED, 0 SKIPPED/FAILED/ERROR dòng) | pytest-verbose.txt |
| `.venv/Scripts/python.exe -m ruff check P/deliverables/tools` | 0 (`All checks passed!`) | ruff-check.txt |
| `.venv/Scripts/python.exe -m ruff format --check P/deliverables/tools` | 0 (`4 files already formatted`) | ruff-format.txt |
| typecheck | NOT_CONFIGURED | typecheck.txt |

## 2. Test

tổng 95 / pass 95 / fail 0 / skip 0 (1 file: `tests/test_day05_tools.py`).

| Nhóm | Số test | Ghi chú |
| :--- | :--- | :--- |
| Negative control dataset (mỗi test = 1 mutation trên fixture hợp lệ ⇒ exit 1 + đúng mã lỗi + không `VALIDATOR_CRASH`) | 43 | DUP_ID x2, MISSING_REF x2, BAD_PAIR x3, BAD_QUOTE x2, BAD_SIGNAL_ID, EM_NO_TIER1 x2, ACCEPTED_INCOMPLETE x4, REVIEWER_SAME, REVIEWER_NOT_HUMAN x2, ACCEPTED_OPEN_DISPUTE x2, CLS_NOT_ELIGIBLE x2, SPLIT_MISMATCH x2, FAMILY_LEAK, FAMILY_TOO_BIG, BAD_EXCEPTION x3, D4_11_HELD_OUT, HELDOUT_NOT_AUTHORED, SECRET x5, BAD_SCHEMA x5, BAD_ID |
| Negative control file-level (thiếu file, JSON hỏng, root sai, manifest thiếu splits; thư mục rỗng ⇒ 6 MISSING_FILE) | 5 | |
| Negative control backlog | 14 | CRITICAL_NOT_P0, CLOSED_NO_RETEST, CLOSED_NO_REVIEWER, BAD_REF x3 (file không tồn tại, retest không tồn tại, đường dẫn tuyệt đối), CONFIRMED_NO_REVIEW x2, DUP_ID, BAD_SCHEMA x2, BAD_ID, BAD_DONE_WHEN x2 |
| Đối chứng xanh (fixture hợp lệ; đủ số đếm 80/40 ⇒ G2/G3 PASS; ngoại lệ family có lý do; PROPOSED không bị kiểm review field) | 4 | |
| Count-gate (fixture nhỏ ở chế độ mặc định ⇒ exit 1; hạ 1 gold ACCEPTED xuống NEEDS_REVIEW ⇒ COUNT_G2/COUNT_G3) | 4 | |
| Backlog xanh + issues phủ/không phủ (dict và list) + thiếu file | 4 | |
| Runner: chấm bằng rules thật (so với gọi `classify`/`assess` độc lập), manifest hash/UTC/HEAD/lexicon_version, giữ gold khi MISMATCH + đếm FN_EM, exception ⇒ ERROR không bịa, không gold ⇒ exit 2 không ghi file, thiếu file ⇒ exit 2, ELIGIBLE cần cả 2 gold, loại ca validator từ chối, luna ⇒ exit 2, held-out cần freeze (4 biến thể) + chạy được khi frozen+hash | 14 | |
| Không import openai/requests/httpx (grep nguồn + `sys.modules` sau khi chạy runner trong tiến trình con); exit code CLI thật (0/1/2) | 2 | |
| Blind sheet: chỉ case_id/text + 7 trường trống, không lộ khoá cấm/sentinel, thứ tự SHA256 xác định, từ chối cases.json hỏng | 3 | |
| Validator không sửa file nguồn; lỗi dùng CLI exit 2 | 2 | |

## 3. Bằng chứng control ĐỎ (chạy CLI thật trên fixture dựng ở scratchpad, stdout + exit lưu nguyên văn)

| File evidence | Nội dung | Kết quả đo |
| :--- | :--- | :--- |
| controls-red-dataset.txt | 1 đối chứng xanh + 43 mutation | EXIT=0 x1, EXIT=1 x43; cả 43 mutation in đúng mã lỗi kỳ vọng (đối chiếu máy) |
| controls-red-files.txt | thiếu file, JSON hỏng, root sai, thư mục rỗng | EXIT=1 x4 |
| controls-red-backlog.txt | 1 đối chứng xanh + 14 mutation + 1 issue không phủ | EXIT=0 x1, EXIT=1 x15; 14/14 mutation in đúng mã kỳ vọng |
| count-gates.txt | đủ 80/40 ⇒ `GATE G2: PASS`, `GATE G3: PASS` (exit 0); fixture nhỏ mặc định ⇒ exit 1; `--structure-only` ⇒ exit 0 và `GATE G2: OPEN`, `GATE G3: OPEN` | như cột trước |
| controls-runner.txt | không gold ⇒ `NO_VALID_GOLD` exit 2; thiếu file ⇒ exit 2; held-out chưa freeze ⇒ `HELDOUT_NOT_FROZEN` exit 2; luna ⇒ `LUNA_NOT_AUTHORIZED` exit 2; mỗi ca bị từ chối `OUTPUT_FILE=absent`; develop exit 0; held-out frozen exit 0; reviewer giống model bị loại (`['D5-C-0001']`); gold EMERGENCY vs rules NONE ⇒ exit 0, `FN_EM: 1` | như cột trước |
| review-pack.txt | blind sheet 7 bản ghi; cases.json thiếu ⇒ exit 1 | như cột trước |

## 4. File mới (tất cả untracked, chưa git add)

| File | Dòng |
| :--- | :--- |
| P/deliverables/tools/validate_day05.py | 473 |
| P/deliverables/tools/run_day05_baseline.py | 202 |
| P/deliverables/tools/build_review_pack.py | 56 |
| P/deliverables/tools/tests/test_day05_tools.py | 911 |
| P/evidence/run01-tools/{step0-boot,pytest,pytest-verbose,ruff-check,ruff-format,typecheck,controls-red-dataset,controls-red-files,controls-red-backlog,count-gates,controls-runner,review-pack}.txt | 12 file |
| P/reports/R03_tools.md | file này |

`git diff --stat -- src seed tests`: 3 file (`src/maintenance/models.py`, `src/maintenance/proposer.py`, `tests/test_maintenance/test_store_memory.py`) đã modified TRƯỚC phiên này (có trong git status đầu phiên); worker không ghi vào src/seed/tests.

## 5. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng |
| :--- | :--- | :--- |
| WP04 validator + runner + review-pack + tests + evidence | 🟠 | Claude Sonnet 5.5 (claude-sonnet-5-5), tự làm, không phóng subagent |

## 6. Quyết định diễn giải (handoff/contract không nêu; KHÔNG đổi contract)

1. split-manifest: `frozen` (bool), `hash` (string), `family_exceptions` nằm ở ROOT manifest; `family_exceptions` nhận list `{family_id, reason}` hoặc object `family_id -> reason`. 01-CONTRACTS §1 chưa định nghĩa. `hash` chỉ được kiểm là chuỗi không rỗng, KHÔNG tính lại.
2. MATCH an toàn = `risk_level` bằng nhau. `signal_ids` (PRESENT/UNCLEAR) ghi ở cả gold và actual; số ca MATCH nhưng khác tập tín hiệu nằm ở `summary.safety.signal_set_differs`. MATCH phân loại = đủ 4 trường (service_category, ticket_type, playbook_id, reason_code).
3. FN_EM tính cả ca ERROR (ERROR không được coi là đã bắt EMERGENCY).
4. Backlog CLOSED: "evidence retest" = `evidence_refs` không rỗng và mọi ref là file tồn tại; không có dấu hiệu nào phân biệt retest với evidence khác. `evidence_refs` bỏ phần `#fragment`, cấm đường dẫn tuyệt đối.
5. Số đếm dùng `>=` (thiếu mới lỗi); chỉ ACCEPTED; family đếm trên ca có safety gold ACCEPTED. G2 = tổng 80/40 + ACCEPTED classification gold phải có safety gold ACCEPTED NONE; G3 = quota theo split + ≥32 family. Các mã lỗi cấu trúc thuộc G2 trừ nhóm G3 (SPLIT_MISMATCH, FAMILY_LEAK, FAMILY_TOO_BIG, BAD_EXCEPTION, D4_11_HELD_OUT, HELDOUT_NOT_AUTHORED, COUNT_G3).
6. Validator yêu cầu đủ 6 file kể cả `label-proposals.json`; runner chỉ cần 5 (không cần proposals).
7. Regex reviewer áp cho `reviewed_by` của gold (khớp chuỗi con, không phân biệt hoa thường); không áp cho `reviewed_by` của backlog.
8. Runner: ca ELIGIBLE cần ĐỦ safety gold và classification gold ACCEPTED; ca SAFETY_STOP chỉ cần safety gold. Ca nào dính bất kỳ lỗi validator có gắn case_id đều bị loại khỏi chấm (liệt kê ở `summary.excluded_invalid_cases`).
9. `blind-review-sheet.json` có `created_at` (UTC hiện tại) nên byte không giống nhau giữa hai lần chạy; thứ tự bản ghi thì xác định.

## 7. Việc KHÔNG làm

- Không đọc, không chạy trên dữ liệu thật của H02 (cases.json, *-gold.json, backlog.json, ... trong P/deliverables/): theo CẤM của handoff; test và evidence chỉ dùng fixture tự dựng.
- Không chạy Luna, không gọi mạng/LLM/Supabase.
- Không chạy typecheck (NOT_CONFIGURED).
- Không kiểm thử đột biến trên chính mã công cụ (chỉ mutation trên dữ liệu); không chạy lại bộ test ứng dụng (2971 test).
- Không git add/commit/push; không tạo file ngoài scope; không cập nhật brain4agent/ (ngoài scope handoff).

## 8. Câu hỏi mở

1. Shape chính thức của `frozen`/`hash`/`family_exceptions` trong split-manifest (mục 6.1) và hash cần băm cái gì để runner có thể tính lại thay vì chỉ kiểm không rỗng.
2. Có cần MATCH an toàn so cả tập `signal_ids` thay vì chỉ `risk_level` (mục 6.2) không.
3. Backlog CLOSED: cần quy ước đường dẫn/nhãn để phân biệt evidence retest với evidence thường (mục 6.4).

## Đo lại của orchestrator + thẩm định cô lập
- Orchestrator đo lại: pytest 95 passed exit 0; ruff check/format exit 0; validator `--backlog` exit 0. Thẩm định cô lập (auditor-sonnet, không đọc report) đo thêm 1 BLOCKER + 5 MAJOR + 5 MINOR: blind sheet lộ nhãn qua `case_id`; reviewer kiểm yếu (NFD/NFC, "Codex", "TBD", date-only, backdate); hash freeze không kiểm; ELIGIBLE/EM không ép; runner không dừng khi lỗi không gắn case; không có chống rò text/family khác dạng chữ; `--output` đè được gold.
- Xử lý: handoff H05 → R05 (270 test). Bản H03 gốc không còn là bản dùng.

🔁 SỬA: B1 blind sheet lộ ID, M1 reviewer yếu, M2 freeze không kiểm hash, M3 eligibility, M4 runner không dừng khi lỗi, M5 rò text/family, m1–m3 — đã giao H05, xem R05
