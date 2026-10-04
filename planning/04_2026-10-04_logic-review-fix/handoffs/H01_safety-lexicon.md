Vai: Bạn là worker của repo này — loại THI CÔNG, tầng 🔴 (quyết đánh đổi bỏ sót/báo nhầm trong từ vựng).
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` (worktree: dùng đường tuyệt đối `D:\brain4agent.release\...`; exit 0 là đủ).
Đọc theo thứ tự: `docs/maintenance.md` §3, `brain4agent/-known-gotchas.md`, `planning/04_2026-10-04_logic-review-fix/plan.md` §1 (S1, S2, P1), `seed/maintenance_v1/lexicon.yaml` (đầu file ghi luật định dạng), `src/maintenance/safety.py`.

## 1. Bối cảnh
Tầng an toàn bước 2b = luật cố định `safety.py` (R1–R10) + từ vựng DỮ LIỆU `lexicon.yaml`. Rà soát 2026-10-04 đo được câu Bậc 1 phổ biến rơi về `NONE` và câu lành tính bị nâng Bậc 1. Bỏ sót Bậc 1 nặng hơn báo nhầm.

## 2. Phạm vi
- ĐƯỢC sửa: `seed/maintenance_v1/lexicon.yaml` (khối `safety` và `priority`); `tests/test_maintenance/data/safety_cases_p0.yaml` (THÊM ca, không sửa/xoá ca cũ); thêm file test mới `tests/test_maintenance/test_safety_review_fixes.py`.
- CẤM chạm: `src/` (kể cả `safety.py`, `catalog.py`), mọi test/data khác, `seed/maintenance_cr03/`, `docs/`, `brain4agent/`. Cần đổi code mới sửa được ⇒ KHÔNG sửa, ghi vào report mục "cần code".
- Python: `D:\P151` không có `.venv`; tạo venv Python 3.11 NGOÀI repo (vd `py -3.11 -m venv %TEMP%\venv-h01` rồi `pip install -r requirements.txt`). Env: `LLM_MODE=mock PYTHONUTF8=1`.

## 3. Việc phải làm
Gọi `assess(text, load_lexicon().safety)` (`src/maintenance/catalog.py`, `src/maintenance/safety.py`).
(a) PHẢI ra `EMERGENCY`:
- "Thang máy kẹt, có người bên trong" · "thang may bi ket, co 2 nguoi o trong" · "Thang máy bị kẹt giữa tầng 7 và 8, bên trong có 3 người" · "Có người kêu cứu trong thang máy"
- "Có người té xỉu ở sảnh chính" · "co nguoi te xiu o sanh chinh" · "Có cụ bà ngã ở cầu thang bộ, đang nằm dưới sàn không nhúc nhích"
- "Dây điện rơi xuống lối đi hành lang tầng 7" · "Dây điện bị tróc vỏ ở hành lang tầng 3" · "dây điện bị bong vỏ ở hành lang" · "Dây điện bị lủng lẳng ở hành lang tầng 4"
- "Hộp điện đang bốc hỏa ở tầng 3" · "Khói nhiều lắm ở hành lang tầng 5, không thở được" · "Lửa lớn lắm ở tầng 4, cứu với"
(b) Ít nhất `UNCLEAR`: "Ông cụ bị té cầu thang bộ" · "Bé bị đứt tay do kính vỡ ở sảnh" · "tang 5 khoi nhieu lam" · "Đèn hành lang cháy đen cả trần nhà"
(c) PHẢI ra `NONE`:
- "Điện hành lang tầng 3 bị ngắt từ sáng nên đèn không sáng" · "Cầu dao tổng bị ngắt" · "Đèn hành lang bị ngắt" · "Wifi bị ngắt"
- "Sảnh có khối rác chưa dọn" · "Có ai để quên cái bật lửa ở sảnh chính" · "Đèn hành lang cháy sáng suốt đêm không tắt"
- "Bóng đèn hành lang gần căn 1205 bị cháy" · "Bóng đèn chỗ thang máy tầng 5 bị cháy" · "Xin báo bóng đèn hành lang tầng 12 bị cháy"
- "Tôi bị giật mình khi thấy rác nhiều ở sảnh" (chấp nhận UNCLEAR nếu buộc phải đánh đổi; ghi lý do)
(d) Priority (`propose_priority` trong `src/maintenance/priority.py`): "vết bẩn hình tròn trên tường hành lang tầng 3" KHÔNG được PRI-H2; "Cho em hỏi hành lang tầng 3 có ít bụi" KHÔNG được PRI-M2.
Luật từ vựng: theo đúng định dạng đầu `lexicon.yaml` (cụm không dấu, một khoảng trắng; dạng có dấu cho homograph); chữ không dấu đứng riêng mơ hồ (khoi/lua/ngat/chay) chỉ giữ khi có confirmer — đừng thêm cụm làm nổ báo nhầm. Ưu tiên cụm cụ thể ("thang may bi ket", "co nguoi ... trong thang may", "te xiu", "bong vo", "boc hoa") hơn mở rộng regex.
Ghi MỖI câu ở (a)(b)(c) thành ca trong `safety_cases_p0.yaml` theo đúng schema ca hiện có, và test (d) trong `test_safety_review_fixes.py`. Tăng `lexicon_version`.

Xong khi (dán lệnh + exit code nguyên văn vào report):
1. `python -m pytest -q -p no:cacheprovider` exit 0, số test ≥ 1641 + số ca bạn thêm, 0 fail (bộ dừng `safety_stop_sets_p0.yaml` 1065 ca vẫn xanh).
2. `python -m pytest -q -p no:cacheprovider tests/test_maintenance/test_safety.py tests/test_maintenance/test_safety_p0.py tests/test_maintenance/test_cr03_targets.py` exit 0.
3. `python -m ruff check src tests` và `python -m ruff format --check src tests` exit 0.
4. Bảng trước/sau cho từng câu ở §3 (mức trước → mức sau), và số báo nhầm của `test_false_alarm_count_on_benign_strings` trước/sau.
5. Bằng chứng ĐỎ: chạy test mới trên lexicon CŨ (git stash phần lexicon) ⇒ fail; dán số fail.

## 4. Luật
Không sửa nhãn cũ để test xanh. Không hạ ngưỡng test. Công cụ ghi file có thể giải mã `\uXXXX` — kiểm lại YAML sau khi ghi (`grep -cP '[\x08\x0b\x0c]'` = 0). Commit trong worktree (Conventional Commits tiếng Anh, vd `fix(safety): ...`), KHÔNG push.

## 5. Tầng
Gói duy nhất 🔴 — tự làm, không phóng agent con.

## 6. Mẫu report (ghi `planning/04_2026-10-04_logic-review-fix/reports/R01_safety-lexicon.md`)
Dòng 1: `Vai · thi công · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm)`. Dòng 2–4: `Handoff: H01_safety-lexicon.md` / `Base: <sha>` / `Head: <sha>`. Rồi: lệnh + exit code · test tổng/pass/fail/skip · `git diff --stat` · bảng trước/sau · việc KHÔNG làm + lý do · "cần code" · dòng cuối phán quyết tự đánh giá.
