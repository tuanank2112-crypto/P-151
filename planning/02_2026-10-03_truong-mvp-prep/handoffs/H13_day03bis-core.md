Bạn là worker của repo này. THI CÔNG Day03-bis D3-02/03/04 🟠, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → deliverables/day03-summary.md + day03-results.json (bản cũ, SHA 0ea04ad) → specs/SPEC-P06-DAY03.md §2–§4 → specs/OPERATIONS.md.

## 1. Bối cảnh
HEAD = develop đã merge (engine CR-03 P0, rating-once đã sửa, safety nối engine). Chạy lại 11 record: ASSET-01..03, STOCK-01..04, DUP-01..04 (cùng bước như P/handoffs/H07, H08, H09; kết quả cũ ở P/deliverables/parts/D3-02/03/04.json). Chú ý engine mới: bước 2b an toàn chạy trước phân loại; nội dung mô phỏng KHÔNG được chứa tín hiệu nguy hiểm; nếu ca cũ nay bị dừng do safety hoặc đổi trạng thái ⇒ ghi FAIL/BLOCKED nêu rõ, không đổi đầu vào để lách.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/bis/D3-02.json, D3-03.json, D3-04.json; P/evidence/bis/core/*; P/reports/R13_day03bis-core.md.
- CẤM: src/, tests/, seed/, schema, config, .env; plan.md, brain4agent/, docs/; deliverables/day03-*.* và parts/ cũ; reports R06–R12; evidence cũ; stash/commit/push.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
- 11 record theo schema SPEC §2 (task_id D3-02/03/04), mỗi file {"records":[...]}; JSON hợp lệ (exit 0); evidence tồn tại.
- Mỗi record: kèm cột "so với Day03 cũ" trong report (giống/đổi + nguyên nhân).
- Xong khi: 11 record + evidence + report; STOCK-03 có số lượng before/after; DUP dùng thời điểm mô phỏng cố định.

## 4. Luật
- Day03-bis = đo LẠI cùng case_id của Day03 trên SHA mới (HEAD, đã merge origin/develop; ghi full SHA bằng `git rev-parse HEAD` + branch trước lượt đo). Không đổi expected/oracle để đạt; chức năng chưa có ⇒ BLOCKED + block_reason + owner; FAIL ⇒ owner (engine→Như Ý, API/storage→Châm Anh, UI→Trí, dữ liệu/oracle→Trường). Mọi PASS/FAIL cần actual + evidence_refs tồn tại.
- Env ép trong lệnh: MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 PYTHONUTF8=1 PYTHONPATH=repo root. `.env` máy owner có thể trỏ postgres ⇒ không tin .env. TestClient in-process, mỗi ca process mới; không DB/hosting chung, không reset/deploy.
- evidence_refs: đường dẫn tương đối so với P (vd `evidence/bis/x.txt`) và phải tồn tại. Thời gian lấy từ `date --iso-8601=seconds`. Lưu output máy (request che auth, status/body), không ghi tay, không token/password.
- Có thể tái dùng harness/runner cũ trong P/evidence/d3-0x/ bằng CÁCH SAO CHÉP sang thư mục bis rồi chỉnh (CẤM sửa/ghi đè evidence cũ). Expected cũ của harness có thể lỗi thời vì engine đã đổi: ghi expected theo SPEC/OPERATIONS, không theo code mới.
- Chỉ trỏ SPEC. H<NN> ↔ R<NN> một cặp.

## 5. Tầng
🟠 (có spec + test tự biết đúng/sai). Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở".

## 6. Mẫu report
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/<file>` · `Base: <40hex HEAD>` · `Head: <40hex HEAD> (working tree, không commit)` (KHÔNG tiêu đề # phía trước).
Sau đó: lệnh + exit (trỏ evidence), PASS/FAIL/BLOCKED từng record, SO SÁNH với kết quả cũ (case nào đổi và vì sao), `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người. Dòng cuối: duy nhất ✅/🔁/⛔ (đề xuất).
