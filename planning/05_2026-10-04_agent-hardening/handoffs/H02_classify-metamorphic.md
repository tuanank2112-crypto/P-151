Vai: Bạn là worker của repo này — loại THI CÔNG, tầng 🟠 (có test tự biết đúng/sai; phân xử phạm vi theo playbook).
Bước 0: từ root repo chạy `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (exit 0 là đủ; exit 1 vì cảnh báo não thì ghi lại, KHÔNG chạy chế độ ghi).
Đọc theo thứ tự: `planning/05_2026-10-04_agent-hardening/plan.md` (§1, Q01–Q04); `docs/maintenance.md` §2 và §12; `docs/playbook-v1.md` §6.1, §7.1 (phạm vi CLN: vệ sinh khu vực chung; TEC: đèn chiếu sáng khu vực chung không hoạt động); `src/maintenance/rules.py`; `src/maintenance/proposer.py`; `tests/test_maintenance/test_rules_review_fixes.py`.

## 1. Bối cảnh
`rules.classify` (VE_SINH | KY_THUAT | CATEGORY_UNCLEAR khi khớp cả hai | OUT_OF_SCOPE) và `rules.extract_location` ("Tòa X / Tầng N / Khu vực", thiếu phần nào thì bước 2 hỏi cư dân). Plan 04 đã mở rộng nhiều, nhưng chưa có bộ kiểm hệ thống theo cách cư dân thật viết vị trí.

## 2. Phạm vi
- ĐƯỢC sửa: `src/maintenance/rules.py`, `src/maintenance/proposer.py`, `src/maintenance/i18n/vi.yaml` (chỉ câu nhắc vị trí nếu thêm khu vực); tạo `tests/test_maintenance/test_classify_metamorphic.py`; THÊM test vào `test_rules_review_fixes.py`.
- CẤM chạm: `safety.py`, `lexicon.yaml` (kể cả khối `priority` — nếu cần thêm khu vực vào `priority.high_areas`, ghi vào report để SO làm), `engine.py`, `src/api/`, `src/web/`, `seed/maintenance_v1/tickets.yaml` và mọi fixture/nhãn, `docs/`, `brain4agent/`. Không sửa kỳ vọng test cũ (nếu buộc phải, ghi rõ lý do trong report — SO duyệt).
- Python: `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; env `LLM_MODE=mock PYTHONUTF8=1`. Ghi file bằng công cụ ghi file, KHÔNG heredoc bash; `grep -cP '[\x08\x0b\x0c]'` = 0.

## 3. Việc phải làm
(a) Kho câu thật ≥ 120 câu trong `test_classify_metamorphic.py` (hoặc file dữ liệu cạnh nó), viết như cư dân: ≥ 40 đèn (chập chờn, nhấp nháy, tắt, không bật được, sáng yếu, tối om, bóng tuýp chết, bóng đèn cháy/nổ, đèn rơi/rớt, mất đèn, đèn hỏng cả dãy…), ≥ 40 vệ sinh (rác, thùng rác đầy, bẩn, dơ, nước đọng, sàn trơn, mùi hôi, bãi nôn, phân, nước tiểu, lá cây, kính bẩn, mạng nhện, dầu mỡ, sơn đổ…), ≥ 25 ngoài phạm vi (thang máy hỏng, điện/nước trong căn hộ, phí, gửi xe, ồn, an ninh, côn trùng/gián nếu playbook không gồm — phân xử theo playbook và ghi lý do), ≥ 15 trộn cả hai (⇒ CATEGORY_UNCLEAR) và câu dễ nhầm ("đến", "đèn đường ngoài cổng" nếu ngoài khu vực chung theo playbook, tên riêng). Mỗi câu ghi kỳ vọng loại việc.
(b) Biến thể vị trí: mỗi câu ở (a) bọc ≥ 8 mẫu vị trí (giống H01: "Tòa SIM-A / Tầng 3 / Hành lang: {câu}", "{câu} ở hành lang tầng 4 tòa SIM-B", "Tòa SIM-C tầng 2 sảnh thang máy, {câu}", "Block SIM-B lầu 6 phòng rác: {câu}", "Tầng hầm B1 tòa SIM-A, bãi đỗ xe: {câu}", "{câu}. Tòa nhà SIM-C, tầng 7, cầu thang bộ", "Em ở tòa SIM-B tầng 9 hành lang, báo: {câu}", bản không dấu). Kỳ vọng: (1) loại việc không đổi so với câu gốc; (2) `extract_location` ra đúng "Tòa X / Tầng N / Khu" của mẫu (khu theo nhãn chuẩn trong `AREA_PATTERNS`); (3) chữ trong phần vị trí không được tự kích loại việc (vd "phòng rác" không biến câu đèn thành vệ sinh — nếu đây là đánh đổi bắt buộc thì ghi lý do).
(c) Sửa `rules.py` (và `proposer.py` nếu thấy lỗi) tới khi (a) và (b) đạt; câu không đạt còn lại phải có lý do (vd cần LLM, cần spec).
(d) Proposer: kiểm các nhánh luật × LLM (dùng client giả) với kho câu (a): luật khớp + LLM đồng ý; luật khớp + LLM UNKNOWN; luật không khớp + LLM đề xuất (⇒ needs_review); LLM lỗi/timeout ⇒ fallback. Báo nếu có nhánh cho kết quả vô lý.

Xong khi (dán lệnh + exit nguyên văn vào report):
1. `python -m pytest -q -p no:cacheprovider` exit 0, 0 fail, ≥ 1843 + số test bạn thêm; `test_fixtures.py`, `test_acceptance.py`, `test_cr03_targets.py` không đổi kết quả.
2. Số câu (a), số biến thể (b), số vi phạm TRƯỚC sửa (trên code hiện tại) / SAU sửa; bảng câu còn sai + lý do.
3. `ruff check src tests` + `ruff format --check src tests` exit 0. Bằng chứng ĐỎ: test mới trên `rules.py` gốc ⇒ có vi phạm (dán số).

## 4. Luật
Code module hoá, theo phong cách file. Không commit (SO gộp). Không phóng agent con.

## 5. Tầng
Gói duy nhất 🟠 (phân xử phạm vi khó ⇒ ghi lý do, không tự đổi spec).

## 6. Mẫu report (ghi `planning/05_2026-10-04_agent-hardening/reports/R02_classify-metamorphic.md` trong worktree; trả về nội dung + đường dẫn worktree + danh sách file sửa)
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: H02_classify-metamorphic.md` / `Base: <sha>` / `Head: uncommitted (worktree …)`; lệnh + exit; vi phạm trước/sau; câu còn sai + lý do; đề xuất cho SO (high_areas…); dòng cuối phán quyết.
