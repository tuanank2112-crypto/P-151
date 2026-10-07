Vai: Bạn là worker của repo này — loại THI CÔNG, tầng 🔴 (đánh đổi bỏ sót/báo nhầm).
Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (exit 0/1 đều ghi lại; KHÔNG chạy chế độ ghi).
Đọc theo thứ tự: `planning/05_2026-10-04_agent-hardening/plan.md` (Q01–Q07); `reports/R01_safety-metamorphic.md`; đầu file `seed/maintenance_v1/lexicon.yaml`; `src/maintenance/safety.py`; `tests/test_maintenance/test_safety_metamorphic.py`.

## 1. Bối cảnh
Thẩm định độc lập (2026-10-04) sau vòng 1: bộ biến thể chỉ bọc vị trí ở ĐẦU/CUỐI câu nên "0 vi phạm" đo hẹp. Vị trí chèn GIỮA câu làm vượt các regex có giới hạn khoảng cách ⇒ bỏ sót Bậc 1. Script và câu của thẩm định: `C:\Users\lenku\AppData\Local\Temp\claude\d--P151\640e8089-3b43-4a75-9055-cbb167391b76\scratchpad\agent_audit\` (`probe.py`, `p3.txt` 45 câu Bậc 1, `p6.txt` 12 cặp câu tự nhiên, `audit_a.py`).

## 2. Phạm vi
- ĐƯỢC: khối `safety` của `lexicon.yaml` (KHÔNG đổi `lexicon_version`, KHÔNG đụng khối `priority`); `src/maintenance/safety.py` (không hạ mức câu đang đúng, trừ T2-02 đã duyệt Q06); THÊM ca vào `tests/test_maintenance/data/safety_cases_p0.yaml`; sửa/mở rộng `tests/test_maintenance/test_safety_metamorphic.py` (chỉ THÊM mẫu/ca).
- CẤM: `rules.py`, `proposer.py`, `engine.py`, `src/api/`, `src/web/`, test/nhãn cũ khác, `docs/`, `brain4agent/`. Không commit. Python: `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe`, env `LLM_MODE=mock PYTHONUTF8=1`. Ghi file bằng công cụ ghi file, KHÔNG heredoc bash; `grep -cP '[\x08\x0b\x0c]'` = 0.

## 3. Việc phải làm
(a) Mở rộng bộ biến thể: thêm ≥ 6 mẫu CHÈN vị trí vào giữa câu (sau chủ ngữ / sau động từ đầu / trước bổ ngữ), vd "{chủ ngữ} ở hành lang tầng 3 tòa SIM-A {phần còn lại}", "{chủ ngữ} tầng 6 tòa SIM-B {phần còn lại}", "{đầu câu}, ngay sảnh thang máy tầng 2 tòa SIM-C, {cuối câu}". Cách tách chủ ngữ: tách ở từ đầu tiên thuộc tập động từ/tính từ tín hiệu, hoặc sau 1–3 từ đầu; ghi rõ cách làm. Phải làm ĐỎ 8/12 cặp `p6.txt` trên lexicon hiện tại.
(b) Sửa cho hết bỏ sót (kỳ vọng EMERGENCY): "Cụ ông ngã ở hành lang tầng 3 tòa SIM-A, nằm im không cử động được"; "Phòng rác tầng 6 tòa SIM-A bốc hỏa dữ dội"; "Dây điện ở hành lang tầng 3 tòa SIM-A bị tróc vỏ"; mọi câu Bậc 1 P0 trong `p3.txt`.
(c) S-03 ⇒ EMERGENCY: "Dây điện lộ ra ngoài", "day dien lo ra ngoai", "Lòi cả dây điện", "Đèn hành lang tầng 3 tòa SIM-A rơi ra, lòi cả dây điện", "…em thấy dây điện chỗ đèn lòi ra ngoài", "dây điện tuột ra".
(d) Báo nhầm ⇒ NONE: "thung rac hanh lang tang 5 toa SIM-B day tran roi", "phong rac tang 8 toa SIM-A day tran ra ca hanh lang" ("đầy tràn" không dấu, không phải "dây trần" — "dây trần" chỉ khi có ngữ cảnh điện: dây điện trần, dây trần lộ…).
(e) B-01 ⇒ NONE (không dồn BPTN): "Mấy hôm nay đèn hành lang tầng 7 tòa SIM-B cứ chập chờn", "…lúc nào cũng / thỉnh thoảng chập chờn", "den hanh lang tang 7 toa SIM-B chap chon", "bong den hanh lang tang 7 toa SIM-B bi chay roi", "bóng đèn gần căn 705 tầng 7 tòa SIM-B bị cháy", "bóng đèn trước cửa căn 1205 bị cháy".
(f) Nên làm (không bắt buộc): "wifi chập chờn" ⇒ NONE; tên riêng "Anh Chập", "Em là Khói" ⇒ NONE; "Tuần trước có khói do ai đốt vàng mã, giờ hết rồi" ⇒ UNCLEAR.
KHÔNG làm tín hiệu P1 (gas, kim tiêm, nước vào tủ điện, đèn nóng) — để plan P1.

Xong khi (dán lệnh + exit nguyên văn):
1. `python -m pytest -q -p no:cacheprovider` exit 0, 0 fail, ≥ số test hiện tại + số bạn thêm.
2. Bộ biến thể (cả mẫu mới): 0 vi phạm (hoặc từng vi phạm còn lại + lý do). `probe.py p6.txt`: 0/12 cặp bị hạ mức; `probe.py p3.txt`: 45/45 EMERGENCY (trừ câu P1 nếu có — ghi rõ).
3. Bộ dừng 1065 xanh; `test_false_alarm_count_on_benign_strings` 0; ngân sách b_fp/b_fp2/jx_negfp không vượt trần; `redteam_lex.py` không tệ hơn 7 lỗi.
4. ruff check/format exit 0; bằng chứng ĐỎ cho ca mới trên lexicon/safety.py hiện tại.

## 4. Luật
Không sửa nhãn cũ; không hạ ngưỡng; không phóng agent con.

## 5. Tầng
🔴.

## 6. Mẫu report (`planning/05_2026-10-04_agent-hardening/reports/R03_safety-round2.md` trong worktree; trả về nội dung + đường dẫn worktree + file đã sửa)
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: H03_safety-round2.md` / `Base:` / `Head: uncommitted (worktree …)`; lệnh + exit; trước/sau từng mục; việc KHÔNG làm + lý do; dòng cuối phán quyết.
