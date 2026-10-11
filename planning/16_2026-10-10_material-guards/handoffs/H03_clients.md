Bạn là worker của repo này. Vai ORCHESTRATOR · THI CÔNG web/app.
Bước 0: tại root chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`; ghi exit thật.
Thứ tự đọc: AGENTS → kernel/index → baseline → ARCHITECTURE → CONTRACTS → SPEC-P02 §U1–U5 → OPERATIONS.

## 1. Bối cảnh
Plan16 chờ duyệt; chỉ thi công sau root xác nhận SPEC frozen. Nền dirty v1.9.9 theo OPERATIONS §O1; không checkout HEAD sạch.
Yêu cầu và oracle nằm trong SPEC, không suy từ report trước.

## 2. Phạm vi
Được: src/web/, src/mobile/, evidence/harness/material_usage.mjs, evidence/wp3, reports/R03_clients.md.
Cấm: backend, portal runtime, tests WP1, SPEC, .env. File ngoài scope phải gửi root, không tự mở rộng.

## 3. Việc và xong khi
Form và mapping theo §U1–U4; chạy browser thật §U5. Song song backend trên contract frozen, tích hợp khi endpoint đạt. Thiếu API không fallback chuỗi request cũ.
Lệnh từ root: `node planning/16_2026-10-10_material-guards/evidence/harness/material_usage.mjs <base-memory> <portal-dir> <output-dir>`.
Exit0, fail0/skip0 khi GREEN; count thật. Thực hiện các lệnh/checks bổ sung tại SPEC được trỏ và TESTING §T3–T4.
UI phải có browser thật, transaction có memory + PostgreSQL local; không dùng syntax/mock để giả nghiệm thu.
Mỗi phép đo lưu stdout/exit bằng máy; RED/mutant ghi test đỏ đúng nguyên nhân; không sửa oracle cho xanh.

## 4. Luật
CONTRACTS §C6 vùng cấm; OPERATIONS §O1–O5. Không dùng Supabase chung, .env hoặc LLM thật.
Không tự commit/push/deploy; không sửa raw evidence; không chạy mutant trên working tree chung.
Hai fail hoặc phép đo mâu thuẫn chuyển root 🔴; thiếu browser/pg/boot giữ gate chưa đạt.

## 5. Tầng
🟠 client/harness; 🔴 đổi contract gửi root; 🟢 report.
Không tự làm dưới tầng; thiếu tầng dùng tầng cao hơn, thiếu 🔴 dừng. Reviewer khác người thi công, khác họ model khi có thể.

## 6. Report
Dòng1: Vai · loại · họ/model · Bước0 exit · hiểu phạm vi/xong khi/cấm.
Dòng2–4: `Handoff: H03_clients.md`, `Base: <SHA+snapshot>`, `Head: <SHA+hash dirty>`.
Ghi lệnh/exit/count, git diff --stat/SHA, gói→tầng yêu cầu→model thực tế, evidence, chưa làm/lý do/câu hỏi.
Dòng cuối: ✅ DUYỆT / 🔁 SỬA: <mục SPEC> / ⛔ DỪNG: <lý do>. Không kể chuyện hoặc giả số đo.

