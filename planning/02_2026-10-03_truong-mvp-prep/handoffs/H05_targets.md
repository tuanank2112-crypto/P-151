Bạn là worker của repo này. THI CÔNG WP5 🟠, một gói; không thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit, hub thiếu không tự sửa.
Thứ tự đọc: memory-distill → index → TESTING-ACCEPTANCE → SPEC-P04-SAFETY → baseline tickets → catalog.py → safety.py → CR-BPTN-03 §6/14.

## 1. Bối cảnh
Chuẩn bị fixture CR03 P0 độc lập; group pending, D01–07 user confirmed. Engine chưa tích hợp safety.
## 2. Phạm vi
Chỉ ghi seed/maintenance_cr03/tickets.yaml, tests/test_maintenance/test_cr03_targets.py,
specs/TESTING-ACCEPTANCE.md, handoffs/H05_targets.md, reports/R05_targets.md, evidence/wp5/*.txt.
CẤM baseline, engine/model/catalog, mã agent khác, stage/commit/push.
## 3. Việc và xong khi
Thi công TESTING-ACCEPTANCE §1–4; chờ WP4 API ổn định trước đo.
`python -m pytest tests/test_maintenance/test_cr03_targets.py -q -p no:cacheprovider` ⇒ exit0, 9pass/0fail/0skip.
Ruff check/format --check target ⇒ exit0; falsification §4 ⇒ exit1/AssertionError, không ghi fixture.
Lưu evidence máy. Runtime/group/online theo §5 vẫn mở; root đo full regression.
## 4. Luật
Giữ nguyên raw/mười oracle; không skip/xfail hoặc coi target green là runtime ready.
Không sửa evidence bằng tay. H05 đối ứng đúng R05; handoff≤80 dòng.
## 5. Tầng
WP5 fixture/tests/evidence: 🟠, có contract và máy đo đúng/sai; model kế thừa phiên.
Không thêm agent do user giới hạn tổng đúng năm agent.
## 6. Report
Dòng1 vai/loại/model/Bước0/hiểu việc; dòng2–4 Handoff/Base/Head.
Lệnh+exit, total/pass/fail/skip, diffstat+SHA, phân công thực tế, chưa làm+lý do, câu hỏi.
Chỉ trỏ evidence máy; dòng cuối ✅/🔁/⛔.
