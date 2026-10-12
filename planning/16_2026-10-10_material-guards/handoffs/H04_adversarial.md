Bạn là worker của repo này. Vai ORCHESTRATOR · THẨM ĐỊNH độc lập.
Bước 0: tại root chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; ghi exit thật.
Thứ tự đọc: AGENTS → kernel/index → baseline → ARCHITECTURE → CONTRACTS → TESTING §T1–T5; toàn bộ SPEC → OPERATIONS.

## 1. Bối cảnh
Plan16 chờ duyệt; chỉ thi công sau root xác nhận SPEC frozen. Nền dirty v1.9.9 theo OPERATIONS §O1; không checkout HEAD sạch.
Yêu cầu và oracle nằm trong SPEC, không suy từ report trước.

## 2. Phạm vi
Được: Script/output evidence/wp4; reports/R04_adversarial.md; runtime chỉ đọc.
Cấm: runtime/tests/SPEC/worker evidence; server chung. File ngoài scope phải gửi root, không tự mở rộng.

## 3. Việc và xong khi
Phiên cô lập, không thừa kế worker, KHÔNG đọc handoff/report thi công. Tự thiết kế ≥3 cách phá: bypass guard, failure stock/audit, browser/concurrency. Mutants chỉ snapshot riêng, kiểm hash phục hồi.
Lệnh từ root: `python -m pytest tests -q -p no:cacheprovider`.
Exit0, fail0/skip0 khi GREEN; count thật. Thực hiện các lệnh/checks bổ sung tại SPEC được trỏ và TESTING §T3–T4.
UI phải có browser thật, transaction có memory + PostgreSQL local; không dùng syntax/mock để giả nghiệm thu.
Mỗi phép đo lưu stdout/exit bằng máy; RED/mutant ghi test đỏ đúng nguyên nhân; không sửa oracle cho xanh.

## 4. Luật
CONTRACTS §C6 vùng cấm; OPERATIONS §O1–O5. Không dùng Supabase chung, .env hoặc LLM thật.
Không tự commit/push/deploy; không sửa raw evidence; không chạy mutant trên working tree chung.
Hai fail hoặc phép đo mâu thuẫn chuyển root 🔴; thiếu browser/pg/boot giữ gate chưa đạt.

## 5. Tầng
🔴 thẩm định luật/transaction; 🟠 đo oracle; 🟢 report.
Không tự làm dưới tầng; thiếu tầng dùng tầng cao hơn, thiếu 🔴 dừng. Reviewer khác người thi công, khác họ model khi có thể.

## 6. Report
Dòng1: Vai · loại · họ/model · Bước0 exit · hiểu phạm vi/xong khi/cấm.
Dòng2–4: `Handoff: H04_adversarial.md`, `Base: <SHA+snapshot>`, `Head: <SHA+hash dirty>`.
Ghi lệnh/exit/count, git diff --stat/SHA, gói→tầng yêu cầu→model thực tế, evidence, chưa làm/lý do/câu hỏi.
Dòng cuối: ✅ DUYỆT / 🔁 SỬA: <mục SPEC> / ⛔ DỪNG: <lý do>. Không kể chuyện hoặc giả số đo.

