Bạn là worker của repo này. THI CÔNG Day03-ter DEMO-04 (D3-06) 🟠, một gói; không phóng thêm agent.
Bước 0: node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check; ghi exit + nguyên nhân; hub thiếu thì KHÔNG sửa managed rules, vẫn tiếp tục.
Thứ tự đọc: AGENTS.md → brain4agent/memory-distill.txt → deliverables/day03bis-summary.md → specs/OPERATIONS.md §5 → docs/CR-BPTN-03.md §6.4–6.5 → planning/03_2026-10-03_safety-routes/reports/R01_safety-routes.md (của Như Ý, chỉ tham khảo, KHÔNG tin; phải đo lại).

## 1. Bối cảnh
Như Ý thêm 3 route: POST /api/v1/mo/tickets/{id}/safety {decision: CONFIRM_SAFE|REQUEST_INFO|ESCALATE, note} (BPTN; BQL chỉ sau khi đã leo thang), POST /api/v1/bql/tickets/{id}/emergency/close và /emergency/downgrade {note} (BQL). Chạy lại DEMO-04-SAFETY-TIER2 và DEMO-04-SAFETY-TIER1 (cùng case_id như P/deliverables/bis/D3-06.json), tách thêm record cho từng lựa chọn Bậc 2 (CONFIRM_SAFE / ESCALATE / REQUEST_INFO), D01 hazard trong bổ sung (OPERATIONS §5.4 A/B/C) và nhóm negative 403 (§5.3 cuối). Kèm hồi quy nhanh DEMO-01A + DEMO-01-RATING trên bản này.
## 2. Phạm vi (P = planning/02_2026-10-03_truong-mvp-prep/)
- Ghi: P/deliverables/ter/D3-06.json, D3-06-notes.md; P/evidence/ter/demos/*; P/reports/R16_day03ter-demos.md.
## 3. Việc phải làm — xong khi là lệnh + kết quả máy đọc được
- Mỗi lựa chọn Bậc 2 và Bậc 1 một process mới; OPERATIONS §5.2 (ba lựa chọn đúng quyền, thiếu note → lỗi không clear, Agent/job không clear), §5.3 (BQL đóng khẩn cấp, hạ báo nhầm; BPTN/department bị 403 không đổi case), §5.4 (D01). Thiếu timeout jobs/run 4 giờ/12 giờ ⇒ đo nếu route có, nếu không BLOCKED.
- Tách record: Bậc 2 ×3, Bậc 1 ×2, D01 A/B/C, negative 403, hồi quy 01A/01-RATING; JSON {"records":[...]} đúng schema SPEC §2 (task_id D3-06), hợp lệ, evidence tồn tại.
- Xong khi: mỗi record có kết luận PASS/FAIL/BLOCKED dựa trên đo; nhận xét rõ phần D01 delta/snapshot (chưa code ⇒ BLOCKED owner Như Ý).

## 4. Luật
- Day03-ter = đo lại case_id còn BLOCKED của Day03-bis trên bản ĐÃ CÓ route: worktree cô lập `C:/Users/caotr/AppData/Local/Temp/claude/c--P-151-truong/8cfb418c-be27-4e85-ad86-f18b4937791f/scratchpad/ter` (detached tại 92649a6152737154cca606f3ce94d3f0ec0e0273, nhánh feature/nhuy-safety-routes, PR #10). Ghi `git -C <worktree> rev-parse HEAD` + branch trước lượt đo. CẤM sửa bất kỳ file trong worktree và trong src/, tests/, seed/ của repo chính (C:/P-151-truong); chỉ ghi vào đường dẫn ở §2.
- Chạy với cwd = worktree, PYTHONPATH = worktree, env ép: MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local APP_ENV=development MO_ALLOW_RESET=false MO_JOBS_ENABLED=false DISABLE_SQLALCHEMY_CEXT_RUNTIME=1 PYTHONUTF8=1; TestClient in-process, mỗi ca process mới; không DB/hosting chung, không push.
- Không đổi expected để đạt; chức năng thiếu ⇒ BLOCKED + block_reason + owner (engine/route safety → Như Ý, UI → Trí, API/storage → Châm Anh, oracle/fixture → Trường); FAIL ⇒ owner. PASS/FAIL cần actual + steps + evidence_refs tồn tại (đường dẫn tương đối so với P). Thời gian lấy từ `date --iso-8601=seconds`. Output máy lưu evidence, không ghi tay, không token/password.
- Có thể sao chép harness cũ (P/evidence/bis/demos/harness.py) sang thư mục mới rồi chỉnh; CẤM ghi đè evidence cũ. Expected harness cũ lỗi thời: ghi expected theo OPERATIONS §5/CR-03, không theo hành vi code.

## 5. Tầng
Theo tiêu đề. Cần đổi contract đã duyệt ⇒ KHÔNG tự đổi; ghi "Câu hỏi mở".

## 6. Mẫu report
Dòng1: Vai · thi công · họ/model · Bước 0 exit · hiểu việc. Dòng2–4: `Handoff: ../handoffs/<file>` · `Base: <SHA worktree 40hex>` · `Head: <SHA worktree> (không commit)` (KHÔNG tiêu đề # phía trước). Lệnh + exit, PASS/FAIL/BLOCKED từng record, so với Day03-bis, bảng phân công, việc không làm, câu hỏi. Dòng cuối duy nhất ✅/🔁/⛔.
