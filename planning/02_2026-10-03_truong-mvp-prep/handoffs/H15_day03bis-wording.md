Bạn là worker của repo này. THI CÔNG Day03-bis D3-05 🟢, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → deliverables/day03-summary.md + day03-results.json (bản cũ, SHA 0ea04ad) → specs/SPEC-P06-DAY03.md §2–§4 → specs/OPERATIONS.md.

## 1. Bối cảnh
HEAD = develop đã merge (có vi.yaml/views/UI mới: src/web/app.js đã sửa endpoint safety, i18n thêm chuỗi). Rà lại 4 vai (WORD-01 RESIDENT, WORD-02 BPTN, WORD-03 DEPARTMENT, WORD-04 BQL) như P/handoffs/H10; kết quả cũ P/deliverables/parts/D3-05.json + D3-05-wording.md. Chỉ đọc mã, không chạy server, không mutation. Nay chuỗi an toàn/khẩn cấp có thể đã có: trích NGUYÊN VĂN + file:dòng THẬT (kiểm bằng grep -n), kiểm không hứa chức năng chưa tích hợp, cư dân không thấy risk nội bộ, và views/UI còn REPORT_NOT_DONE/reopen hay không (CR-03 cấm reopen). Phân biệt rõ: chuỗi/route/UI đã có vs chưa nối router.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/bis/D3-05.json, D3-05-wording.md; P/evidence/bis/wording/*; P/reports/R15_day03bis-wording.md.
- CẤM: src/, tests/, seed/, schema, config, .env; plan.md, brain4agent/, docs/; deliverables/day03-*.* và parts/ cũ; reports R06–R12; evidence cũ; stash/commit/push.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
- 4 record theo schema SPEC §2 (task_id D3-05); bảng wording cột Màn hình · Câu hiện tại (nguyên văn + file:dòng) · Câu đề xuất (thật, hoặc "giữ nguyên" + lý do) · Role · Lý do; tách phần UI (đã rà) và phần quyền API (chưa đo ở gói này).
- PASS chỉ khi cả phần safety/khẩn cấp của vai đó đã có và đúng; thiếu ⇒ BLOCKED + owner. Evidence = output máy grep/sed.

## 4. Luật
- Day03-bis = đo LẠI cùng case_id của Day03 trên SHA mới (HEAD, đã merge origin/develop; ghi full SHA bằng `git rev-parse HEAD` + branch trước lượt đo). Không đổi expected/oracle để đạt; chức năng chưa có ⇒ BLOCKED + block_reason + owner; FAIL ⇒ owner (engine→Như Ý, API/storage→Châm Anh, UI→Trí, dữ liệu/oracle→Trường). Mọi PASS/FAIL cần actual + evidence_refs tồn tại.
- Env ép trong lệnh: MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 PYTHONUTF8=1 PYTHONPATH=repo root. `.env` máy owner có thể trỏ postgres ⇒ không tin .env. TestClient in-process, mỗi ca process mới; không DB/hosting chung, không reset/deploy.
- evidence_refs: đường dẫn tương đối so với P (vd `evidence/bis/x.txt`) và phải tồn tại. Thời gian lấy từ `date --iso-8601=seconds`. Lưu output máy (request che auth, status/body), không ghi tay, không token/password.
- Có thể tái dùng harness/runner cũ trong P/evidence/d3-0x/ bằng CÁCH SAO CHÉP sang thư mục bis rồi chỉnh (CẤM sửa/ghi đè evidence cũ). Expected cũ của harness có thể lỗi thời vì engine đã đổi: ghi expected theo SPEC/OPERATIONS, không theo code mới.
- Chỉ trỏ SPEC. H<NN> ↔ R<NN> một cặp.

## 5. Tầng
🟢 (có mẫu chép theo; thiếu quyết định ⇒ Câu hỏi mở + test tự biết đúng/sai). Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở".

## 6. Mẫu report
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/<file>` · `Base: <40hex HEAD>` · `Head: <40hex HEAD> (working tree, không commit)` (KHÔNG tiêu đề # phía trước).
Sau đó: lệnh + exit (trỏ evidence), PASS/FAIL/BLOCKED từng record, SO SÁNH với kết quả cũ (case nào đổi và vì sao), `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người. Dòng cuối: duy nhất ✅/🔁/⛔ (đề xuất).
