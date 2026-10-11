Bạn là worker của repo này — loại THẨM ĐỊNH (chỉ đọc, nhiệm vụ là làm ĐỎ), không nhận report/handoff của worker thi công.
Bước 0: từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code.
Thứ tự đọc: `AGENTS.md` → `brain4agent/memory-distill.txt` → hai bộ SPEC dưới đây → diff code. KHÔNG đọc `plan.md` §5–§6 hay evidence trước khi tự đo (đó là lời worker).

## 1. Bối cảnh
Repo `E:\vinuni\build_phase\P-151`, nhánh `feature/chamanh`, HEAD `e546262`. Hai kế hoạch đã commit + push, chưa ai ngoài người làm thẩm định:
- Plan 11 (v1.7.0) app điện thoại PWA `src/mobile/`: commit `118eeba` + `e9960f0` (base `6d788df`). SPEC: `planning/11_2026-10-09_mobile-pwa-app/specs/` (00, 01, SPEC-P01..P05, OPERATIONS, TESTING-ACCEPTANCE). Docs `docs/mobile.md`.
- Plan 12 (v1.8.0) độ trễ backend: commit `e546262` (base `e9960f0`). SPEC: `planning/12_2026-10-09_backend-latency/specs/` (00, 01, SPEC-P01..P03, OPERATIONS, TESTING-ACCEPTANCE). Docs `docs/maintenance.md` §15.

## 2. Phạm vi
- ĐƯỢC: đọc mọi file; chạy test, ruff, script chỉ đọc; dựng backend memory LOCAL `:8001` (`MO_STORE=memory LLM_MODE=mock MO_PHOTO_STORE=local MO_JOBS_ENABLED=false`); Postgres local `MO_TEST_DATABASE_URL=postgresql://p151:p151@localhost:5432/p151_test`; viết probe tạm CHỈ trong thư mục tạm của hệ điều hành (ngoài repo).
- CẤM: sửa/tạo/xoá file trong repo (kể cả `git stash`, `checkout`, `add`); ghi vào `:8000` (Supabase CHUNG — chỉ được GET); chạy `rotate_memory.js`; push.
- NGOÀI phạm vi (thay đổi chưa commit của người khác, bỏ qua): `src/web/app.js`, `src/web/index.html`, `planning/13_*`, `planning/08_*`, file này.

## 3. Việc phải làm — xong khi
1. Đo nền: `python -m pytest -q -p no:cacheprovider` (venv `.venv`, `LLM_MODE=mock`, `PYTHONUTF8=1`) và `--pg` như trên; `python -m ruff check src tests`. Xong khi: có 3 dòng lệnh + exit code + tổng/pass/fail/skip.
2. Tự thiết kế ≥3 cách phá cho MỖI plan, đối chiếu từng bất biến/hợp đồng trong SPEC với code thật. Gợi ý hướng (không giới hạn):
   - Plan 12: `_read` thử lại có thể chạy lại câu không idempotent? engine đọc AUTOCOMMIT có bị dùng trong transaction ghi (đọc lệch ngoài tx)? cache ảnh lộ ảnh cho người không có quyền / không bị xoá khi `discard`? lô ảnh "tất cả hoặc không" có để lại file mồ côi hay evidence một phần? gzip nén ảnh hoặc phá header `Content-Encoding`? tổng kết nối pool > 5? route async còn I/O chặn?
   - Plan 11: SW có cache `/api/` hay dữ liệu cá nhân? token lưu ở đâu, đăng xuất có xoá? vai nào thấy nút/route không thuộc quyền (server có chặn không)? lý do bắt buộc BPTN; `?v=` và `SHELL_CACHE` khớp nhau; XSS khi render text cư dân (innerHTML)?
   Xong khi: mỗi cách phá có lệnh/probe + output máy, kết luận ĐỎ (lỗi thật, tái hiện được) hoặc XANH (đã thử, không phá được).
3. Không sửa lỗi tìm được — chỉ báo.

## 4. Luật
Số đo thay kể chuyện. Lỗi chỉ được kết luận khi tái hiện được bằng lệnh; nghi ngờ chưa tái hiện ghi riêng mục "Nghi ngờ". Xếp mức: 🔴 bảo mật/mất dữ liệu · 🟠 sai hợp đồng SPEC · 🟢 nhỏ. `git status --short` cuối phiên phải giống đầu phiên (dán cả hai).

## 5. Tầng
Thẩm định đối kháng: 🔴 cho phân tích bảo mật (quyền xem ảnh, SW cache, token); 🟠 cho phần còn lại. Không ghi tên model ở đây; report ghi họ/model thực tế.

## 6. Mẫu report (trả về dạng văn bản, ≤120 dòng)
Dòng 1: `Vai · thẩm định · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm)`
- Lệnh + exit code nguyên văn; test tổng/pass/fail/skip; `git status --short` đầu/cuối.
- Bảng: # · plan · cách phá · lệnh/probe · kết quả máy · ĐỎ/XANH · mức.
- Nghi ngờ chưa tái hiện. Việc KHÔNG làm + lý do. Câu hỏi cần người.
- Dòng cuối đề xuất phán quyết cho từng plan: `✅ DUYỆT` · `🔁 SỬA: <mục>` · `⛔ DỪNG: <vì sao>`.
