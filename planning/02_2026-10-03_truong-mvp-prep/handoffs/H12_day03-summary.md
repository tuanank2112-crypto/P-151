Bạn là worker của repo này. THI CÔNG D3-07 🟢, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → deliverables/day03-results.json (đã gộp bởi root) → deliverables/parts/*.md → reports/R06..R11 → specs/SPEC-P06-DAY03.md §2, §3 D3-07, §5.

## 1. Bối cảnh
Root đã gộp record D3-01..06 vào deliverables/day03-results.json (nguồn số liệu duy nhất). D3-07 = viết day03-summary.md từ đó, không chạy thêm đo, không gửi tin nhắn thành viên. Runtime/online vẫn là gate ngày 04/10.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/day03-summary.md, P/evidence/d3-07/*, P/reports/R12_day03-summary.md.
- ĐƯỢC đọc P/ và code để đối chiếu. CẤM sửa day03-results.json, parts/, reports R06–R11, src/, tests/, seed/, plan.md, brain4agent/, docs/; không server, không mutation; stash/commit/push.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
1. Đếm PASS/FAIL/BLOCKED/NOT_RUN theo task và tổng bằng lệnh python đọc day03-results.json → P/evidence/d3-07/counts.txt (+ exit). Số trong summary PHẢI khớp counts.txt.
2. Summary day03-summary.md gồm: SHA/nhánh/môi trường/ngày kiểm tra/nguồn dataset (từ results + D3-01.md); bảng 7 task đạt/chưa đạt (phân biệt "đã lập báo cáo" với "chức năng kiểm thử đạt"); danh sách lỗi theo owner (engine→Như Ý, API/storage→Châm Anh, UI→Trí, nội dung/oracle→Trường), mỗi lỗi có case_id + bước tái hiện + evidence; script dùng được; lỗi ngăn demo; phần mô phỏng; nhu cầu bản online; điều kiện cần có trước nghiệm thu online 04/10 (persistence restart vẫn là gate ngày 04); câu hỏi cần người.
3. Kiểm nhất quán: mỗi FAIL có issue_owner, mỗi BLOCKED có block_reason+owner, mỗi PASS/FAIL có evidence tồn tại — in kết quả kiểm vào P/evidence/d3-07/consistency.txt (+ exit). Lệch ⇒ ghi vào report, KHÔNG sửa results.
- Xong khi: summary và results nhất quán (counts.txt khớp), có danh sách điều kiện trước nghiệm thu, không câu nào khẳng định chức năng đạt khi record là FAIL/BLOCKED.

## 4. Luật
- Không suy diễn ngoài số đo; không đổi trạng thái record; không tuyên bố runtime/online đạt. H12 ↔ R12 một cặp.

## 5. Tầng
D3-07: 🟢 (có mẫu chép theo). Mâu thuẫn dữ liệu cần phán ⇒ "Câu hỏi mở".

## 6. Mẫu report (P/reports/R12_day03-summary.md)
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/H12_day03-summary.md` · `Base: <40hex>` · `Head: <40hex> (working tree, không commit)`.
Sau đó: lệnh + exit (trỏ evidence), counts, `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người.
Dòng cuối: ✅ / 🔁 / ⛔ (đề xuất; root phán quyết cuối).
