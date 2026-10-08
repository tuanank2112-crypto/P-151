Vai: worker thi công (🟢 Haiku-tier) · Bước 0: chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` từ C:\P-151-truong, ghi exit THẬT (đã biết: 1 MODULE_NOT_FOUND vì thiếu hub; KHÔNG sửa luật managed, vẫn làm tiếp) · Đọc: AGENTS.md → brain4agent/memory-distill.txt → specs trong P=planning/09_2026-10-07_day05-labels/: 01-CONTRACTS §5, SPEC-P01-BACKLOG.
# H01 — WP01 backlog (loại: THI CÔNG)
## 1. Bối cảnh
Day05 cần chốt backlog từ 11 issue Day04. Không có chat history; mọi thứ cần nằm trong file. Dữ liệu synthetic.
## 2. Phạm vi
GHI được: P/deliverables/backlog.json, P/deliverables/backlog-summary.md, P/reports/R01_backlog.md. ĐỌC: planning/07_2026-10-04_online-acceptance/deliverables/issues.json, evaluation.md, brain4agent/roadmap.md, planning/04_*/handoffs/H03,H04,H05, planning/07_*/evidence/normalization-20261007/safety-child-trapped.json.
CẤM chạm: mọi file khác (src/, seed/, tests/, plan.md, brain4agent/), .env, DB, API, git add/commit/push.
## 3. Việc phải làm
1. Mỗi issue D4-01..D4-11 → ≥1 BacklogItem đúng 01-CONTRACTS §5 (root `{schema_version:"day05-1",created_at,records}`, item_id D5-B-001..). Gộp trùng căn nguyên thì giữ MỌI ref trong source_issue_refs. Không tạo item cho 6 ca Day04 đã bỏ.
2. Ưu tiên theo SPEC-P01 §3 (D4-11 = BUG/CRITICAL/P0/NOW owner Như Ý, status OPEN; D4-06 = FIXED_PENDING_RETEST, KHÔNG CLOSED; R01 memory = NO_ACTION; vision/LangGraph/P1 = FEATURE/DEFER).
3. owner_acceptance="PROPOSED" cho MỌI item; reviewed_by=null, reviewed_at=null. Không item nào CLOSED.
4. done_when.command = lệnh chạy được/đo được (vd probe assess trên câu D4-11, pytest ID, GET API), expected_result cụ thể; không dùng "sửa xong".
5. evidence_refs: chỉ đường dẫn tồn tại thật (kiểm bằng ls/test -f); issue không có evidence ⇒ kind=EVIDENCE + dependencies.
6. backlog-summary.md (tiếng Việt): bảng item theo priority/decision/owner_acceptance + danh sách "việc cần người xác nhận".
## 4. Xong khi (LỆNH + KẾT QUẢ)
- Chạy: `.venv/Scripts/python.exe -c "import json,os;d=json.load(open('planning/09_2026-10-07_day05-labels/deliverables/backlog.json',encoding='utf-8'));r=d['records'];print(len(r));assert all(os.path.exists(p) for x in r for p in x['evidence_refs']);assert all(x['owner_acceptance']=='PROPOSED' and x['status']!='CLOSED' for x in r);assert all(x['priority']=='P0' for x in r if x['severity']=='CRITICAL');print('OK')"` (PYTHONUTF8=1) → in số item rồi OK, exit 0.
- Mọi issue_id D4-01..D4-11 xuất hiện trong ≥1 source_issue_refs.
## 5. Luật
BẮT BUỘC: UTF-8, text tiếng Việt có dấu; ghi lịch sử nguồn kèm run_id/build, không khẳng định bug còn ở runtime hiện tại. CẤM: đặt owner_acceptance=CONFIRMED, tự giảm severity D4-11, gọi D4-11 do S5, suy "đã sửa", bịa evidence.
## 6. Tầng model
Cả gói 🟢. Quyết định severity/security chưa rõ ⇒ KHÔNG tự quyết, ghi vào "Câu hỏi mở" của report.
## 7. Mẫu report (P/reports/R01_backlog.md)
Dòng1: `Vai · thi công · họ/model THẬT bạn đang chạy · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm)`; dòng2 `Handoff: handoffs/H01_backlog.md`; dòng3 `Base: 8dd6baa5e733fd9dd917b30522b131d520471e05`; dòng4 `Head: (SHA hiện tại, chưa commit)`. Rồi: lệnh+exit nguyên văn · số item · bảng phân công thực tế · việc KHÔNG làm + lý do · câu hỏi mở. CẤM kể chuyện. KHÔNG tự ghi phán quyết.
