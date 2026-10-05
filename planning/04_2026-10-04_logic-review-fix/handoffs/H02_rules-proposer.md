Vai: Bạn là worker của repo này — loại THI CÔNG, tầng 🟠 (có spec + test tự biết đúng/sai).
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (worktree: dùng đường tuyệt đối `D:\brain4agent.release\...`; exit 0 là đủ).
Đọc theo thứ tự: `docs/maintenance.md` §1–2, `planning/04_2026-10-04_logic-review-fix/plan.md` §1 (C1, C2) và §2 Q08, `src/maintenance/rules.py`, `src/maintenance/proposer.py`, `tests/test_maintenance/test_proposer.py`.

## 1. Bối cảnh
Phân loại luật (`rules.classify`) chỉ có 2 playbook: VE_SINH (vệ sinh khu vực chung) và KY_THUAT (đèn chiếu sáng khu vực chung không hoạt động). Khớp cả hai ⇒ CATEGORY_UNCLEAR; không khớp ⇒ OUT_OF_SCOPE. `normalize()` bỏ dấu nên "đèn" và "đến" cùng thành `den` ⇒ "Khi đến tầng 5 … cửa thoát hiểm bị hỏng" bị xếp KY_THUAT có playbook (sai và nguy hiểm vì không qua BPTN).

## 2. Phạm vi
- ĐƯỢC sửa: `src/maintenance/rules.py` (chỉ phần phân loại; KHÔNG đổi `extract_location`/`missing_location_parts`/`_location_parts`), `src/maintenance/proposer.py`; thêm `tests/test_maintenance/test_rules_review_fixes.py`; thêm test vào `tests/test_maintenance/test_proposer.py`.
- CẤM chạm: `engine.py`, `safety.py`, `seed/` (mọi fixture/nhãn), test khác, `docs/`, `brain4agent/`. KHÔNG xử lý "bóng đèn bị cháy" (Q22 — Trường quyết, giữ hành vi hiện tại).
- Python: không có `.venv`; tạo venv Python 3.11 NGOÀI repo (vd `py -3.11 -m venv %TEMP%\venv-h02` + `pip install -r requirements.txt`). Env `LLM_MODE=mock PYTHONUTF8=1`.

## 3. Việc phải làm
(a) `classify()` PHẢI ra KY_THUAT / PB-TEC-01:
"Đèn cầu thang bộ tầng 3 tòa SIM-A nhấp nháy" · "Đèn hành lang tầng 3 tòa SIM-A bị hư" · "Đèn ở hành lang tầng 5 tòa SIM-A không sáng" · "Đèn trong hầm xe B1 tòa SIM-A không sáng" · "Đèn led sảnh chính tòa SIM-A bị vỡ" · "Hành lang tầng 3 tòa SIM-A mất đèn" · "Đèn hành lang tầng 3 không lên"
(b) PHẢI ra VE_SINH / PB-CLN-01:
"Sảnh chính tòa SIM-B bẩn quá" · "Hành lang tầng 3 dơ quá" · "Có phân chó ở sảnh chính tòa SIM-A" · "Có người nôn ra sàn hành lang tầng 4" · "Nước tiểu ở góc cầu thang bộ tầng 2"
(c) PHẢI KHÔNG có playbook (OUT_OF_SCOPE): "Khi đến tầng 5 tòa SIM-A tôi thấy cửa thoát hiểm bị hỏng" · "Tôi đến sảnh chính thì thấy thang máy hỏng" · "Đi đến hầm xe thì barrier tắt nguồn"
(d) PHẢI ra KY_THUAT (không CATEGORY_UNCLEAR): "Tôi là Bùi Văn An, đèn hành lang tầng 3 không sáng" · "Tôi bị bận nên báo muộn: đèn hành lang tầng 3 không sáng"
Gợi ý (không bắt buộc): phân biệt "đèn"/"đến" trên chữ CÓ dấu trước khi `normalize` (vd đổi "đến" thành từ khác); chữ không dấu `den` giữ hành vi cũ có ngữ cảnh khu vực. `\bbui\b`/`\bbi ban\b` cần ngữ cảnh để không khớp tên riêng / "bị bận".
(e) `proposer.propose`: (1) đổi `ServiceCategory(...)`/`TicketType(...)` của kết quả LLM phải nằm trong nhánh fallback (lỗi ⇒ dùng luật, ghi note như lỗi LLM khác); (2) cắt `assessment.reason` tối đa 500 ký tự trước khi dùng; (3) test cho cả hai, dùng client giả trả `LLMAssessment.model_construct(service_category="HACK", ...)` và reason 20000 ký tự.

Xong khi (dán lệnh + exit code nguyên văn vào report):
1. `python -m pytest -q -p no:cacheprovider` exit 0, số test ≥ 1641 + số test bạn thêm, 0 fail. Đặc biệt `tests/test_maintenance/test_fixtures.py`, `test_acceptance.py`, `test_cr03_targets.py` không đổi kết quả (nhãn fixture KHÔNG sửa).
2. `python -m ruff check src tests` và `python -m ruff format --check src tests` exit 0.
3. Bằng chứng ĐỎ: chạy test mới trên `rules.py`/`proposer.py` cũ (git stash) ⇒ fail; dán số fail.
4. Bảng trước/sau cho từng câu ở §3.

## 4. Luật
Code module hoá, đúng phong cách file (comment ngắn, tiếng Anh trong code). Không sửa nhãn/kỳ vọng cũ để test xanh. Commit trong worktree (Conventional Commits tiếng Anh, vd `fix(rules): ...`), KHÔNG push.

## 5. Tầng
Gói duy nhất 🟠 — tự làm, không phóng agent con.

## 6. Mẫu report (ghi `planning/04_2026-10-04_logic-review-fix/reports/R02_rules-proposer.md`)
Dòng 1: `Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm)`. Dòng 2–4: `Handoff: H02_rules-proposer.md` / `Base: <sha>` / `Head: <sha>`. Rồi: lệnh + exit code · test tổng/pass/fail/skip · `git diff --stat` · bảng trước/sau · việc KHÔNG làm + lý do · câu hỏi cần người · dòng cuối phán quyết tự đánh giá.
