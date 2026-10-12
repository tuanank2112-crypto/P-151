1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THẨM ĐỊNH (chỉ đọc mã; nhiệm vụ là LÀM ĐỎ).
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — root exit 0; worktree exit 1 với ĐÚNG MỘT dòng `BRN-002 … khối luật: boot` ⇒ ghi exit, ĐI TIẾP; lệch khác ⇒ DỪNG.
3. Đọc theo thứ tự: `planning/08_2026-10-07_inflight-emergency/specs/00-ARCHITECTURE.md` → `01-CONTRACTS.md` → `SPEC-P01-report-restore.md` → `TESTING-ACCEPTANCE.md` → mã: `src/maintenance/coordination/emergency.py`, phần `engine.py` liên quan `TRANSITIONS`/`_apply_transition`/`transition()`. KHÔNG đọc report/handoff của worker (R01, R02, H01, H02).

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151`, nhánh `feature/nhuy-reasoning-agent`. Dải thẩm định: `Base` = commit trước WP1 (`git log --oneline -- planning/08_2026-10-07_inflight-emergency` để tìm commit SPEC), `Head` = `git rev-parse HEAD`. Bạn là agent KHÁC người thi công, không thừa kế ngữ cảnh.
- Tính năng: người báo khẩn cấp cho ticket đã qua tầng an toàn; BQL trả về chỗ cũ. Rủi ro chính: lộ đường thứ hai tới/khỏi `EMERGENCY_PENDING_BQL`, mất dữ liệu thực hiện, vai sai làm được việc.
- Python `.venv/Scripts/python`; env OPERATIONS §2. Probe tự viết đặt trong `evidence/WP3/probes/`, chạy bằng `PYTHONPATH=.`.

## 2. PHẠM VI
- ĐƯỢC GHI: CHỈ `planning/08_2026-10-07_inflight-emergency/evidence/WP3/**` và `…/reports/R03_tham-dinh_WP3.md`.
- CẤM: mọi file khác (kể cả sửa lỗi tìm thấy), commit ngoài một commit `docs(plan-08): audit report R03`, push.

## 3. VIỆC PHẢI LÀM
a. Tự thiết kế ≥ 6 cách phá, tối thiểu phủ: (1) đi vòng `transition()`/`resume()`/`run_jobs`/`bql_merge`/hủy/`emergency_downgrade` để gỡ hoặc tạo `EMERGENCY_PENDING_BQL` sai; (2) vai × trạng thái × phạm vi phòng ban — ma trận đầy đủ 8 vai × 10 trạng thái cho 2 method, đếm `accepted_forbidden` và `refused_allowed`; (3) restore làm lệch dữ liệu thực hiện/tồn kho/agent_decision (so deep-equal trước báo và sau restore); (4) doc có `emergency_return` qua store memory + `--pg` + validator; (5) đồng thời: hai luồng báo + restore cùng lúc (luồng thật, khoá); (6) ticket `WAITING_EMERGENCY` cạnh ticket báo khẩn sau close/restore/hủy.
b. Mỗi probe: lệnh + output ⇒ `evidence/WP3/<ten>.txt` kết `EXIT=`. Xong khi: bảng kết quả trong report có ≥ 6 dòng, mỗi dòng trỏ một evidence tồn tại.
c. Chạy lại cổng chung OPERATIONS §3 độc lập ⇒ `evidence/WP3/{pytest,pg,ruff}.txt`.

## 4. LUẬT
- Mỗi phát hiện ghi: mức (CHẶN/GHI), lệnh tái hiện, kỳ vọng theo SPEC (mục số), thực tế, vị trí mã. Không đề xuất sửa trong code.
- Không tìm được lỗi ở một hướng ⇒ ghi phép thử đã chạy + số ca, không viết "ổn".

## 5. TẦNG: 🔴 (cổng an toàn + quyền; tự làm, không giao con; khác họ model người thi công khi có thể).

## 6. MẪU REPORT `reports/R03_tham-dinh_WP3.md`
Dòng 1 `Vai · thẩm định · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H03_tham-dinh_WP3.md` / `Base: <sha>` / `Head: <sha>`; bảng cách phá (lệnh · exit · số ca · kết quả · mức); danh sách phát hiện; câu hỏi cần người; dòng cuối `⏳ Chờ người duyệt.`

Report: `planning/08_2026-10-07_inflight-emergency/reports/R03_tham-dinh_WP3.md` · Evidence: `planning/08_2026-10-07_inflight-emergency/evidence/WP3/<ten-do>.txt`
