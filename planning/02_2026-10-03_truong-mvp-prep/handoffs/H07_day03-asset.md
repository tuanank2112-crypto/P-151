Bạn là worker của repo này. THI CÔNG D3-02 🟠, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → brain4agent/index.md → docs/maintenance.md → deliverables/parts/D3-01.md (manifest) → specs/SPEC-P06-DAY03.md §1–§5 (chính §2, §3 D3-02, §4) → specs/OPERATIONS.md §1, §3.2.

## 1. Bối cảnh
Day03 Trường = kiểm thử nghiệp vụ, không coding. Kiểm 3 ca asset trên bản local cô lập; so actual với expected của SPEC/OPERATIONS. D-08 APPROVED (plan.md 2026-10-03T10:25:01); runtime/online chưa nghiệm thu. Chức năng chưa tích hợp KHÔNG được giả lập thành PASS.

## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- ĐƯỢC ghi: P/deliverables/parts/D3-02.json, P/evidence/d3-02/*, P/reports/R07_day03-asset.md.
- ĐƯỢC đọc mọi thứ. Chạy server riêng: `uvicorn src.main:app --host 127.0.0.1 --port 8162` HOẶC TestClient trong process; ép env MO_STORE=memory, LLM_MODE=mock, MO_PHOTO_STORE=local, APP_ENV=development, MO_ALLOW_RESET=false NGAY TRONG lệnh (không tin .env). Xác nhận cấu hình qua /health trước mutation; không xác nhận được ⇒ dừng, ghi BLOCKED.
- CẤM: sửa src/, tests/, seed/, schema, config, .env, secrets; plan.md, brain4agent/, docs/; DB/hosting chung, Postgres/Supabase, reset, deploy; dùng chung state/cổng với worker khác; stash/commit/push. Kết thúc: dừng đúng process của mình.

## 3. Việc phải làm — "xong khi" là lệnh + kết quả máy đọc được
Ba record, mỗi ca khởi động hoặc dùng ticket MỚI (state không dính ca khác), actor đăng nhập đúng role:
1. ASSET-01 (QA/BPTN đọc): fixture SIM-TKT-TEC-001 → asset đúng `SIM-ASSET-LIGHT-001`, ROUTED, department kỹ thuật (OPERATIONS §2 bước 1).
2. ASSET-02 (BPTN): fixture SIM-TKT-TEC-002 → VERIFYING/ASSET_UNCLEAR, department/draft null, chưa giao, accept bị từ chối (§3.2.1).
3. ASSET-03 (BPTN): bptn-resolve đúng OPERATIONS §3.2.2 → ROUTED/null, flag ASSET_CHECK_ONSITE, resolution ONSITE_BY_BPTN; kèm nhánh âm §3.2.3 (thiếu note ⇒ 409, giữ VERIFYING/ASSET_UNCLEAR) trên bản độc lập. Nếu SPEC ("BPTN bổ sung asset hợp lệ") lệch OPERATIONS §3.2: dùng OPERATIONS làm expected, ghi lệch vào "Câu hỏi cần người"; CẤM đổi oracle.
- Lưu nguyên output máy mỗi bước: request đã che auth, HTTP status/body, timestamp, actor (E(2,4..6)) vào P/evidence/d3-02/*.txt; thêm `*-exit.txt` cho lệnh CLI. Không ghi tay, không lưu token/password.
- D3-02.json = {"records":[...3 record...]} đúng schema SPEC §2 (case_id, task_id="D3-02", actor_role, steps, input_ref, expected, actual, result, evidence_refs là đường dẫn tồn tại, issue_owner, block_reason).
- FAIL ⇒ issue_owner (engine→Như Ý, API/storage→Châm Anh, UI→Trí, dữ liệu/oracle→Trường). BLOCKED ⇒ block_reason + owner. Không chạy được ⇒ BLOCKED chứ không NOT_RUN.
- Xong khi: 3 record có input/expected/actual/evidence hoặc blocker; JSON hợp lệ (`python -c "import json;json.load(open(...))"` exit 0); mọi evidence_refs tồn tại.

## 4. Luật
- Đọc code liên quan trước; ghi branch + full SHA (`git rev-parse HEAD`) + môi trường trước lượt đo, chép vào report.
- Lỗi theo SPEC §4: 401/403 ghi role, không đổi vai; 409/422 sửa đầu vào hợp lệ, không bypass; 5xx dừng mutation.
- Chỉ trỏ SPEC, không chép thiết kế. H07 ↔ R07 một cặp.

## 5. Tầng
D3-02: 🟠 (có spec + test tự biết đúng/sai). Gặp việc cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở" (🔴 do root).

## 6. Mẫu report (P/reports/R07_day03-asset.md)
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm bằng lời mình).
Dòng2–4: `Handoff: ../handoffs/H07_day03-asset.md` · `Base: <40hex>` · `Head: <40hex> (working tree, không commit)`.
Sau đó: lệnh + exit (trỏ evidence), tổng/PASS/FAIL/BLOCKED của 3 record, `git diff --stat` + SHA, bảng phân công (gói → tầng → họ/model), việc KHÔNG làm + lý do, câu hỏi cần người.
Dòng cuối: ✅ / 🔁 / ⛔ (đề xuất; root phán quyết cuối).
