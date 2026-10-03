Bạn là worker của repo này. THI CÔNG Day03-ter wording (D3-05) 🟢, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → deliverables/day03bis-summary.md → specs/OPERATIONS.md §5 → docs/CR-BPTN-03.md §6.4–6.5 → planning/03_2026-10-03_safety-routes/reports/R01_safety-routes.md (của Như Ý, chỉ tham khảo, KHÔNG tin; phải đo lại).

## 1. Bối cảnh
Route safety/khẩn cấp của Như Ý nay có trong worktree; UI src/web/app.js của Trí gọi đúng các đường dẫn đó. Rà lại WORD-02 (BPTN: ba lựa chọn Bậc 2, wording thiếu thông tin/asset) và WORD-04 (BQL: duyệt/trả/đóng, đóng khẩn cấp, hạ báo nhầm) như P/handoffs/H10; kết quả cũ P/deliverables/bis/D3-05.json. Chỉ đọc mã (chuỗi vi.yaml, views.py, src/web/app.js, router) trong worktree; không chạy server.
## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- Ghi: P/deliverables/ter/D3-05.json, D3-05-wording.md; P/evidence/ter/wording/*; P/reports/R17_day03ter-wording.md.
## 3. Việc phải làm — xong khi là lệnh + kết quả máy đọc được
- 2 record WORD-02, WORD-04 (task_id D3-05): trích NGUYÊN VĂN chuỗi + file:dòng kiểm bằng grep -n; kiểm nhãn nút/câu trong app.js khớp ba lựa chọn (xác nhận an toàn / yêu cầu bổ sung / leo thang khẩn cấp) và hai hành động BQL; cư dân không thấy risk nội bộ; không câu nào hứa chức năng chưa có. Câu đề xuất thật hoặc "giữ nguyên" + lý do.
- PASS chỉ khi mọi chuỗi của vai đó đúng và không hứa quá mức; còn thiếu ⇒ BLOCKED/FAIL + owner (nội dung → Trường, UI → Trí). Tách rõ phần UI đã rà vs quyền API chưa đo ở gói này.
- JSON hợp lệ, evidence_refs là đường dẫn thuần tồn tại.

## 4. Luật
- Day03-ter = đo lại case_id còn BLOCKED của Day03-bis trên bản ĐÃ CÓ route: worktree cô lập `C:/Users/caotr/AppData/Local/Temp/claude/c--P-151-truong/8cfb418c-be27-4e85-ad86-f18b4937791f/scratchpad/ter` (detached tại 92649a6152737154cca606f3ce94d3f0ec0e0273, nhánh feature/nhuy-safety-routes, PR #10). Ghi `git -C <worktree> rev-parse HEAD` + branch trước lượt đo. CẤM sửa bất kỳ file trong worktree và trong src/, tests/, seed/ của repo chính (C:/P-151-truong); chỉ ghi vào đường dẫn ở §2.
- Chạy với cwd = worktree, PYTHONPATH = worktree, env ép: MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 PYTHONUTF8=1; TestClient in-process, mỗi ca process mới; không DB/hosting chung, không push.
- Không đổi expected để đạt; chức năng thiếu ⇒ BLOCKED + block_reason + owner (engine/route safety → Như Ý, UI → Trí, API/storage → Châm Anh, oracle/fixture → Trường); FAIL ⇒ owner. PASS/FAIL cần actual + steps + evidence_refs tồn tại (đường dẫn tương đối so với P). Thời gian lấy từ `date --iso-8601=seconds`. Output máy lưu evidence, không ghi tay, không token/password.
- Có thể sao chép harness cũ (P/evidence/bis/demos/harness.py) sang thư mục mới rồi chỉnh; CẤM ghi đè evidence cũ. Expected harness cũ lỗi thời: ghi expected theo OPERATIONS §5/CR-03, không theo hành vi code.

## 5. Tầng
Theo tiêu đề. Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở".

## 6. Mẫu report
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc. Dòng2–4: `Handoff: ../handoffs/<file>` · `Base: <SHA worktree 40hex>` · `Head: <SHA worktree> (không commit)` (KHÔNG tiêu đề # phía trước). Lệnh + exit, PASS/FAIL/BLOCKED từng record, so với Day03-bis, bảng phân công, việc không làm, câu hỏi. Dòng cuối duy nhất ✅/🔁/⛔.
