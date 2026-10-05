Vai: Bạn là worker của repo này — loại THI CÔNG, tầng 🔴 (đánh đổi bỏ sót/báo nhầm trong tầng an toàn).
Bước 0: từ root repo chạy `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (exit 0 là đủ; exit 1 vì cảnh báo não thì ghi lại, KHÔNG chạy chế độ ghi).
Đọc theo thứ tự: `planning/05_2026-10-04_agent-hardening/plan.md` (§1, Q01–Q04); `docs/maintenance.md` §3 và §12; đầu file `seed/maintenance_v1/lexicon.yaml` (luật định dạng); `src/maintenance/safety.py`; `planning/04_2026-10-04_logic-review-fix/reports/R01_safety-lexicon.md` (lịch sử 3 vòng trước).

## 1. Bối cảnh
Tầng an toàn = luật cố định `safety.py` (R1–R10) + từ vựng `lexicon.yaml`. Plan 04 đã sửa 3 vòng, nhưng câu thử không có vị trí kiểu cư dân thật. Demo lộ: "Sảnh thang máy tầng 2 tòa SIM-C có khối rác chưa dọn" ⇒ EMERGENCY (S-04 'có khối'), vì `homograph_confirmers.khoi` có `toa` (ý "tỏa") khớp chữ "tòa". "Sảnh có khối rác chưa dọn" (không tòa) thì NONE.

## 2. Phạm vi
- ĐƯỢC sửa: khối `safety` của `seed/maintenance_v1/lexicon.yaml` (KHÔNG đụng khối `priority`, KHÔNG đổi `lexicon_version` — SO tăng sau); `src/maintenance/safety.py` (chỉ thay đổi không hạ mức an toàn của câu nào đang đúng); THÊM ca vào `tests/test_maintenance/data/safety_cases_p0.yaml`; tạo `tests/test_maintenance/test_safety_metamorphic.py` (+ file dữ liệu nếu cần, đặt trong `tests/test_maintenance/data/`, nhớ `git add -f` không cần vì bạn không commit).
- CẤM chạm: `rules.py`, `proposer.py`, `engine.py`, `src/api/`, `src/web/`, test/nhãn cũ (không sửa, không xoá ca cũ), `docs/`, `brain4agent/`.
- Python: venv có sẵn `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`; env `LLM_MODE=mock PYTHONUTF8=1`. Ghi file bằng công cụ ghi file, KHÔNG heredoc bash (làm hỏng backslash); kiểm `grep -cP '[\x08\x0b\x0c]'` = 0.

## 3. Việc phải làm
(a) Bộ biến thể (metamorphic) trong `test_safety_metamorphic.py`: với MỌI ca nhãn trong `safety_cases_p0.yaml` và `tests/test_maintenance/test_safety_p0.py` (62 câu) và `seed/maintenance_cr03/safety_cases.json`, sinh biến thể bọc vị trí — ít nhất 8 mẫu: "Tòa SIM-A / Tầng 3 / Hành lang: {câu}", "{câu} ở hành lang tầng 4 tòa SIM-B", "Tòa SIM-C tầng 2 sảnh thang máy, {câu}", "toa SIM-A tang 5 hanh lang {câu không dấu}" (chỉ cho câu vốn không dấu), "Block SIM-B lầu 6 phòng rác: {câu}", "Tầng hầm B1 tòa SIM-A, bãi đỗ xe: {câu}", "{câu}. Tòa nhà SIM-C, tầng 7", "Em ở tòa SIM-B, báo: {câu}". Kỳ vọng: mức của biến thể == mức của câu gốc (EMERGENCY vẫn EMERGENCY, NONE vẫn NONE, UNCLEAR vẫn UNCLEAR). Chạy, liệt kê vi phạm.
(b) Rà từ vựng (Q02): với từng mục ở `homograph_confirmers`, `negation_fillers`, `hedge_fillers`, `b01_prefix_words`, `resolved_bridge_tokens`, `final_particles`, các regex có `nguoi|toa|tang|ra|len|bi|co` — đánh giá có trùng chữ thông dụng của phản ánh không; ghi bảng "từ — rủi ro — xử lý". Ví dụ đã biết: `khoi: toa` ⇒ đổi thành cụm chắc nghĩa ("toa ra", "khoi toa") hoặc dạng có dấu.
(c) Sửa lexicon/safety.py cho đến khi (a) = 0 vi phạm. Câu bắt buộc: "Sảnh thang máy tầng 2 tòa SIM-C có khối rác chưa dọn" ⇒ NONE; "Hành lang tầng 3 tòa SIM-A có khói tỏa ra từ hộp điện" ⇒ EMERGENCY; "khói tỏa khắp hành lang tầng 5 tòa SIM-B" ⇒ EMERGENCY.
(d) Bộ dừng và ngân sách: `safety_stop_sets_p0.yaml` 1065 ca xanh; `test_false_alarm_count_on_benign_strings` 0 báo nhầm; b_fp/b_fp2/jx_negfp không vượt trần; R10 câu 24 KB < 1 s.

Xong khi (dán lệnh + exit nguyên văn vào report):
1. `python -m pytest -q -p no:cacheprovider` exit 0, 0 fail, số test ≥ 1843 + số test bạn thêm.
2. Bộ biến thể: số biến thể sinh ra / số vi phạm TRƯỚC sửa (trên lexicon hiện tại) / SAU sửa (= 0, hoặc từng vi phạm còn lại kèm lý do đánh đổi).
3. Script đối kháng cũ `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/redteam_lex.py` (107 câu, chạy trên D:/P151 — sửa bản sao để trỏ worktree của bạn): không câu nào tệ hơn hiện tại (hiện 7 lỗi).
4. `ruff check src tests` + `ruff format --check src tests` exit 0. Bằng chứng ĐỎ: test biến thể chạy trên lexicon/safety.py gốc ⇒ có vi phạm (dán số).

## 4. Luật
Không sửa nhãn cũ để test xanh; không hạ ngưỡng. Không commit (hook não chặn; SO gộp). Không phóng agent con.

## 5. Tầng
Gói duy nhất 🔴.

## 6. Mẫu report (ghi `planning/05_2026-10-04_agent-hardening/reports/R01_safety-metamorphic.md` trong worktree; trả về nội dung + đường dẫn worktree + danh sách file sửa)
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: H01_safety-metamorphic.md` / `Base: <sha>` / `Head: uncommitted (worktree …)`; lệnh + exit; bảng rà từ vựng; vi phạm trước/sau; việc KHÔNG làm + lý do; dòng cuối phán quyết.
