1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: từ `D:/P151-portal-fe` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — ghi exit code; KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/11_2026-10-09_portal-backend-api/plan.md` §2 (Q08–Q19) → `specs/SPEC-P03-screens.md` §4 (+ §1, §7) → `reports/R04_thi-cong_WP2b.md` (hợp đồng dữ liệu: DTO, hàm map, action — CHỈ dùng những gì có ở đây) → `docs/portal.md` → `portal/AGENTS.md` (Next 16; tài liệu đúng bản ở `portal/node_modules/next/dist/docs/`).

## 1. Bối cảnh
- Worktree `D:/P151-portal-fe`, nhánh `feature/nhuy-portal-fe`, Base `ef4a4d9`. Ghi `git rev-parse HEAD` + `git status --porcelain` trước khi sửa. Hai worker giao diện khác + worker backend WP1b chạy song song — CHỈ chạm file trong phạm vi dưới.
- Portal Next.js (UI mới của Trí) đã đổi sang gọi backend (WP2/WP2b). Gói này làm GIAO DIỆN Phòng vệ sinh + Phòng kỹ thuật đúng SPEC-P03 §4, GIỮ ngôn ngữ thiết kế hiện có (Tailwind tokens, `components/*`, bố cục thẻ/tab của Trí). Doc anh Cố chỉ là tham khảo, không chép form.
- Đang chạy: backend memory cổng 8000 (proxy sang portal `next dev` cổng 3000). Mở http://127.0.0.1:8000, đăng nhập `vesinh`, `kythuat` mật khẩu `123456`. KHÔNG tắt hai server. Route backend đợt 2 (phân công, duyệt vật tư, thẻ đánh giá, trường Agent) có khi WP1b xong — portal đã map trường thiếu thành rỗng; làm UI đủ cho cả hai trường hợp.

## 2. Phạm vi
- ĐƯỢC GHI: `portal/src/app/cleaning/**`, `portal/src/app/technical/**`; `planning/11_.../evidence/WP4/*`; `planning/11_.../reports/R06_thi-cong_WP4.md`.
- CẤM: `portal/src/lib/**`, `portal/src/server/**`, `portal/src/app/actions/**` (hợp đồng WP2b — thiếu gì thì GHI vào "câu hỏi mở", không tự thêm), `portal/src/components/**` (cần đổi component dùng chung ⇒ ghi câu hỏi mở, WP5 sở hữu), ngoài `portal/`; commit, push, `git add -A`, `git stash`; ghi Supabase.

## 3. Việc phải làm
a. Làm đủ từng dòng SPEC-P03 §4. Không chữ/số/% viết cứng giả dữ liệu. Không khối Agent viết cứng — chỉ hiện `agent` thật từ DTO.
b. Mọi phần tử bấm được: `button` hoặc `role="button"` + Enter/Space + focus ring; con trỏ tay.
c. Kiểm bằng trình duyệt thật (Playwright có sẵn trong `portal/node_modules`; viết script tạm trong scratchpad của bạn hoặc `portal/scripts/ui-check-WP4.mts`): đăng nhập từng vai của gói, chạy hết luồng nút của SPEC trên dữ liệu backend memory, chụp ảnh 1440 và 390 mỗi màn ⇒ `evidence/WP4/*.png`; trang không tràn ngang (`scrollWidth <= viewport`).
d. Xong khi (mỗi file evidence kết `EXIT=`, Git Bash redirect, CẤM PowerShell `>`): `npm run typecheck` EXIT=0, `npm run lint` EXIT=0, `npm run test` EXIT=0 ⇒ `evidence/WP4/checks.txt`; bảng tự đối chiếu từng dòng SPEC-P03 §4 ⇒ đạt/chưa + ảnh chứng minh ⇒ `evidence/WP4/spec-check.md`.

## 4. Luật
- Quyền ở backend: lỗi action hiện message (`useAction`). Không log dữ liệu cư dân.
- Thiếu dữ liệu trong hợp đồng ⇒ không bịa; ghi câu hỏi mở.

## 5. Tầng: 🟠. Không giao con.

## 6. Mẫu report `reports/R06_thi-cong_WP4.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H06_thi-cong_WP4.md` / `Base: <sha>` / `Head: <sha>; working tree chưa commit`; bảng lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng SPEC → đạt/chưa; ảnh; quyết định của worker; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
