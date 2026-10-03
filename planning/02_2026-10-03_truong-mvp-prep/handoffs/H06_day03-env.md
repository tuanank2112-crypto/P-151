Bạn là worker của repo này. THI CÔNG D3-01 🟢, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → specs/SPEC-P06-DAY03.md §1–§5 (chính §3 D3-01) → specs/OPERATIONS.md §1.

## 1. Bối cảnh
Day03 của Trường = kiểm thử/wording/demo, không coding. D3-01 chốt manifest (nhánh, SHA, môi trường) mà D3-02..06 dùng chung. D-08 đã APPROVED (plan.md nhật ký 2026-10-03T10:25:01); runtime/online chưa nghiệm thu.

## 2. Phạm vi (đường dẫn tính từ planning/02_2026-10-03_truong-mvp-prep/ = P)
- ĐƯỢC ghi: P/deliverables/parts/D3-01.md, P/evidence/d3-01/*.txt, P/reports/R06_day03-env.md.
- ĐƯỢC đọc mọi thứ; chỉ chạy lệnh đọc (git, python import, grep, đọc OpenAPI qua import app).
- CẤM: sửa src/, tests/, seed/, schema, config, .env, secrets; khởi chạy mutation; stash/reset/checkout/stage/commit/push; mở kết nối Postgres/Supabase.
- CẤM chạm plan.md, brain4agent/, docs/ (chỉ root sửa).

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
1. `git status --short`, `git branch --show-current`, `git rev-parse HEAD` (đủ 40 hex), `git rev-parse origin/develop`, `git log -3 --oneline` → mỗi lệnh lưu P/evidence/d3-01/<tên>.txt + <tên>-exit.txt. Cây không sạch ⇒ ghi nguyên danh sách, không xử lý.
2. Môi trường cô lập theo OPERATIONS §1.1: xác nhận có file `.env`/biến môi trường nào có thể kéo MO_STORE sang postgres hay MO_PHOTO_STORE sang supabase (chỉ in TÊN biến, KHÔNG in giá trị/secret). Ghi cách ép MO_STORE=memory, LLM_MODE=mock, MO_PHOTO_STORE=local, APP_ENV=development, MO_ALLOW_RESET=false.
3. Dùng FastAPI TestClient hoặc import app trong process (không bind cổng, không mutation) để liệt kê route /api/v1 hiện có (method + path) → evidence/d3-01/routes.txt. Xác nhận tồn tại: ingest, additions, bptn-resolve, accept, checklist, materials, evidence, complete, bql close/cancel, warehouse stock, resume, jobs/run, rating.
4. Liệt kê tài khoản vai trò (CHỈ username + role, KHÔNG password) từ seed/maintenance_v1/accounts.yaml; dataset nguồn (id + số ticket) từ tickets.yaml; LLM mode mặc định.
5. Danh sách chức năng THIẾU so với target (grep src/maintenance: safety đã nối engine chưa, delta/snapshot D-01, rating-once, cấm reopen, endpoint quyết định safety). Mỗi mục: có/không + file:dòng chứng cứ.
6. Viết P/deliverables/parts/D3-01.md gồm đúng: observed_at (ISO8601 +07:00), branch, commit 40-hex, environment=local, base_url=null (chưa bind), dataset nguồn, LLM mode, bảng role/username, bảng route sẵn có, bảng chức năng thiếu (owner đề xuất: engine/safety→Như Ý, API/storage→Châm Anh, UI→Trí), cảnh báo cây local, kết luận "sẵn sàng/không sẵn sàng" cho D3-02..06 kèm lý do.
- Xong khi: D3-01.md có đủ mục trên, commit đủ 40 hex, mọi evidence tồn tại và >0 byte.

## 4. Luật
- Không giả định PASS; thiếu gì ghi "thiếu". Không in/lưu password/token. Không sửa evidence bằng tay.
- H06 ↔ R06 đúng một cặp; report chỉ số đo, cấm kể chuyện.

## 5. Tầng
D3-01: 🟢 (có mẫu chép theo, máy tự biết đúng/sai). Thiếu model tầng 🟢 ⇒ dùng tầng trên, ghi bảng phân công.

## 6. Mẫu report (P/reports/R06_day03-env.md)
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/H06_day03-env.md` · `Base: <40hex>` · `Head: <40hex> (working tree, không commit)`.
Sau đó: lệnh + exit (trỏ evidence), tổng/pass/fail/skip nếu có, `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người.
Dòng cuối: ✅ / 🔁 / ⛔ (worker ghi đề xuất; root phán quyết cuối).
