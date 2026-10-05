1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THẨM ĐỊNH (chỉ đọc code; nhiệm vụ là LÀM ĐỎ).
2. Bước 0: `node D:/brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — trong worktree exit 1 với ĐÚNG MỘT dòng `BRN-002 … khối luật: boot` là do CRLF (Q21) ⇒ ghi exit và ĐI TIẾP; lệch khác ⇒ DỪNG, báo. KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/06_2026-10-05_reasoning-agent/specs/00-ARCHITECTURE.md` (bất biến I-16…I-30) → `specs/01-CONTRACTS.md` → `specs/SPEC-P01…P07` → `specs/TESTING-ACCEPTANCE.md` §8 (6 cách phá BẮT BUỘC) → `plan.md` §2 (chỉ bảng quyết định; Q25, Q27(4) là điểm SO nhờ soi). CẤM đọc `reports/R*` và `evidence/WP0…WP11` (không thừa kế kết luận của người làm).

## 1. BỐI CẢNH TỰ CHỨA
- Repo `D:/P151`, nhánh `feature/nhuy-reasoning-agent`. Đầu tiên `git rev-parse HEAD`; khác base giao (SHA trong prompt phóng) và cây sạch ⇒ `git reset --hard <base>`; cây bẩn ⇒ DỪNG, báo.
- Hệ: engine bảo trì (`src/maintenance/`) + Agent suy luận (`src/maintenance/agent/`) gọi mô hình NGOÀI khoá engine, engine kiểm (trích dẫn có thật, enum, TRANSITIONS, quyền) rồi áp; lỗi ⇒ quay về luật. Luật người dùng: **AI không được tự hạ mức an toàn; chỉ BQL hạ**. Lớp an toàn luật = `safety.assess` + `seed/maintenance_v1/lexicon.yaml` (p1d).
- Python: gọi NGUYÊN VĂN `C:/Users/lenku/AppData/Local/Temp/claude/d--P151/640e8089-3b43-4a75-9055-cbb167391b76/scratchpad/venv311/Scripts/python.exe` (KHÔNG dùng biến làm tên lệnh), env `LLM_MODE=mock PYTHONUTF8=1 PYTHONPATH=.`. Không gọi mạng, không đọc/in `.env`; mọi "mô hình" là client giả bạn tự viết.
- Postgres (cách phá 5): chỉ `MO_TEST_DATABASE_URL=postgresql+psycopg2://p151:p151@127.0.0.1:55433/p151_wp12_test` trong container docker `p151-pgtest` (tạo DB nếu chưa có). KHÔNG đụng container khác.

## 2. PHẠM VI
- ĐƯỢC GHI: CHỈ `planning/06_2026-10-05_reasoning-agent/evidence/WP12/*` và `…/reports/R12_tham-dinh_WP12.md`. Script/test phá thử đặt trong `evidence/WP12/probes/` (không phải `tests/`), chạy bằng python nguyên văn.
- CẤM: sửa `src/**`, `tests/**`, `seed/**`, SPEC, `plan.md`; `git stash`; commit; push; `git add -A`. Tìm được lỗi ⇒ KHÔNG sửa, ghi vào report với lệnh tái hiện.
- Cách phá 5 cần checkout `82f01f0`: dùng `git worktree add <scratchpad>/old82 82f01f0` (thư mục tạm NGOÀI repo), xoá worktree tạm khi xong (`git worktree remove`).

## 3. VIỆC PHẢI LÀM
a. Thực hiện ĐỦ 6 cách phá TESTING §8, mỗi cách: lệnh + exit + output máy ⇒ `evidence/WP12/break-<n>.txt`.
b. Tự thiết kế THÊM ≥ 3 cách phá ngoài §8 (gợi ý vùng: tiền tố B-01 mới `nho/xin/giup/thay …` làm hạ câu nguy hiểm; "xin cứu, nhà cháy" chỉ UNCLEAR; đếm trùng hai lần khi pipeline chạy lại; gộp/tách/sai phòng ban vượt quyền; ticket con của tách mất mức an toàn của gốc; follow-up né khoá) ⇒ `evidence/WP12/extra-<n>.txt`.
c. Cổng chung để chắc không phá hệ: `pytest -q -p no:cacheprovider` toàn bộ ⇒ `evidence/WP12/pytest.txt` + `EXIT=$?`.
Xong khi: mọi file `break-1…6.txt`, `extra-*.txt` (≥3), `pytest.txt` tồn tại, mỗi file có dòng `EXIT=` cuối; report có phán quyết.

## 4. LUẬT
- AGENTS K.5: lỗi cơ chế an toàn / khoá / quyền / hạ mức ⇒ 🔁 (chặn); lỗi nhãn / câu chữ ⇒ ghi, không chặn. Mỗi phát hiện: mức (CHẶN/GHI), lệnh tái hiện, kết quả thấy vs đúng, file:dòng nghi.
- Không kể chuyện; chỉ số đo.

## 5. TẦNG: 🔴 (thẩm định đối kháng; tự làm, không giao con).

## 6. MẪU REPORT `reports/R12_tham-dinh_WP12.md`
Dòng 1 `Vai · thẩm định · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H12_tham-dinh_WP12.md` / `Base: <sha>` / `Head: không commit`; bảng 6 cách §8 + bảng cách tự thiết kế (cách · lệnh · exit · kết quả · CHẶN/GHI/đạt); danh sách phát hiện; câu hỏi cần người; dòng cuối đúng một trong `✅ DUYỆT` · `🔁 SỬA: <mục>` · `⛔ DỪNG: <vì sao>`.
