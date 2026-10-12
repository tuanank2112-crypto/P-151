Bạn là worker của repo này. THI CÔNG route API safety/khẩn cấp 🟠 (route + body mỏng bọc method engine có sẵn); owner: Như Ý.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit; hub thiếu thì không sửa managed rules.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/CR-BPTN-03.md §6.4, §6.5 → planning/02_2026-10-03_truong-mvp-prep/specs/OPERATIONS.md §5 → deliverables/day03bis-summary.md.

## 1. Bối cảnh
Day03-bis (SHA cd83f11, local): DEMO-04 Bậc 2/Bậc 1 và WORD-02/04 BLOCKED vì engine có 5 method nhưng OpenAPI (45 path) không có route safety/emergency. Ingest đã ra đúng VERIFYING/SAFETY_REVIEW_REQUIRED (Bậc 2) và EMERGENCY_PENDING_BQL (Bậc 1). Owner: Như Ý (người dùng chốt 2026-10-03). Đây là văn bản bàn giao do Trường soạn; Trường KHÔNG sửa src/.

## 2. Phạm vi
- Được sửa: src/api/routers/maintenance.py (route mới), body model của route, test API tương ứng, docs/maintenance.md.
- Cấm: đổi hành vi engine/state machine đã duyệt, reset/xoá dữ liệu, deploy; không hạ risk tự động; CREATE_FOLLOW_UP/gộp/hủy emergency là SAU MVP, không bắt buộc.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
Route (prefix /api/v1; tên route do owner chốt, ghi vào docs/maintenance.md + CONTRACTS):
1. BPTN: safety_confirm_safe (note bắt buộc), safety_escalate (note), safety_request_info (note) — gọi engine.safety_* cùng tên. Xong khi: BPTN → 200 và trạng thái theo OPERATIONS §5.2; thiếu note → 409/422, không clear; role khác → 403 + audit, state không đổi.
2. BQL: emergency_close (note kết quả), emergency_downgrade (note) — OPERATIONS §5.3. Xong khi: BQL → CLOSED/EMERGENCY_HANDLED hoặc clearance ghi người+thời điểm; BPTN/department/Agent/job → 403.
3. Resident additions khi NEED_INFO an toàn: hazard trong bổ sung (thiếu tầng/vị trí) → vẫn VERIFYING/EMERGENCY_PENDING_BQL (OPERATIONS §5.2.3, §5.4 B).
4. Negative: resume và jobs/run trên emergency chưa xử lý giữ nguyên VERIFYING/EMERGENCY_PENDING_BQL, department/draft null (OPERATIONS §5.3 cuối).
- Lệnh nghiệm thu: `DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 LLM_MODE=mock python -m pytest -q -p no:cacheprovider` (số test không giảm, 0 skip mới) + `python -m ruff check src tests` + `python -m ruff format --check src tests` exit 0.
- Để Trường chạy lại DEMO-04: OpenAPI có route mới (không còn "0 path safety"); harness Day03-bis: planning/02_2026-10-03_truong-mvp-prep/evidence/bis/demos/harness.py (g4a/g4b; expected cũ của g4a đã lỗi thời).

## 4. Luật
- Handoff chỉ trỏ SPEC, không chép; route chỉ bọc method engine, không thêm logic safety ở router. Mọi ghi qua engine (`_mutate`, audit). Cấm skip/xfail để xanh.

## 5. Tầng
🟠 (có spec + test tự biết đúng/sai). Cần đổi hợp đồng CR-03 đã duyệt ⇒ dừng, ghi câu hỏi mở (🔴).

## 6. Mẫu report
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc. Dòng2–4: Handoff/Base/Head. Lệnh + exit, tổng/pass/fail/skip, git diff --stat + SHA, bảng phân công, việc không làm, câu hỏi. Dòng cuối ✅/🔁/⛔.
