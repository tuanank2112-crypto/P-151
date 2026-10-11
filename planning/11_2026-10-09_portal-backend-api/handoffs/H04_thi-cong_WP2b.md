1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: từ `D:/P151-portal-fe` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — ghi exit code; KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/11_2026-10-09_portal-backend-api/plan.md` §2 (Q08–Q19) → `specs/01-CONTRACTS.md` → `specs/SPEC-P04-backend-ext2.md` (route + trường response mới) → `specs/SPEC-P03-screens.md` (toàn bộ — để biết màn cần dữ liệu gì) → `reports/R02_thi-cong_WP2.md` (lớp dữ liệu bạn mở rộng) → `portal/AGENTS.md`.

## 1. Bối cảnh
- Worktree `D:/P151-portal-fe`, nhánh `feature/nhuy-portal-fe`, Base `4be6284`. Ghi `git rev-parse HEAD` + `git status --porcelain` trước khi sửa. Worker WP1b đang thêm route backend song song (SPEC-P04) — KHÔNG chạm ngoài `portal/`. Route WP1b chưa có lúc bạn bắt đầu: viết theo SPEC-P04, test bằng dữ liệu giả; thử thật khi WP1b xong (không bắt buộc).
- WP2 đã làm lớp gọi backend (`server/backend.ts`, `server/data/*`, `app/actions/*`, `lib/dto.ts`, `lib/backend-map.ts`). Gói này MỞ RỘNG lớp đó để 3 gói giao diện sau (WP3–5) CHỈ còn sửa `*-app.tsx`/components, không đụng dữ liệu.
- Backend memory đang chạy cổng 8000 (proxy portal 3000, `next dev` đang chạy) — KHÔNG tắt; sửa file thì `next dev` tự nạp lại.

## 2. Phạm vi
- ĐƯỢC GHI: `portal/src/lib/{dto,backend-map,constants}.ts`, `portal/src/server/**`, `portal/src/app/actions/**`, `portal/src/app/*/page.tsx`, `portal/tests/unit/**`, `portal/.env.example`, `planning/11_.../evidence/WP2b/*`, `planning/11_.../reports/R04_thi-cong_WP2b.md`. Sửa tối thiểu `*-app.tsx`/components CHỈ khi kiểu thay đổi làm vỡ biên dịch (liệt kê).
- CẤM: ngoài `portal/`; thêm tính năng UI (WP3–5); commit, push, `git add -A`, `git stash`; ghi Supabase.

## 3. Việc phải làm
Dữ liệu + action cho mọi điểm SPEC-P03 cần mà WP2 chưa có, gồm tối thiểu:
- Cư dân: tách `title`/`content`/`location` từ mô tả (SPEC-P03 §2); `submitTicketAction` nhận `title`; `rateTicketAction(id, {stars, tags, comment})`; DTO có `ratingTags`, `ratingComment`.
- Tiếp nhận: khối Agent thật trên thẻ (phòng đề xuất, lý do ngắn, nguồn) từ `agent_decision`; dữ liệu tab Hiệu suất Agent (đúng/sai/% theo SPEC-P04 §5; danh sách lần sửa).
- Phòng ban: `staff` (`GET /mo/staff`), `assignStaffAction(id, staffId)`, nhân viên trên thẻ, trạng thái vật tư (chờ duyệt / chờ nhập / đã cấp), sao/thẻ/bình luận ở lịch sử (không danh tính cư dân).
- Quản lý: `agentDepartment`, nguồn chuyển Việc của BQL ("Agent chuyển"/"Tiếp nhận chuyển" — từ notification `escalation` payload `by` hoặc audit), `title`/`content`, `doneHours` (`closed_at − accepted_at`), sao trung bình; bộ lọc ô tổng quan đúng bảng SPEC-P03 §5.2 làm thành hàm thuần `overviewFilter(kind)` có test (số trên ô = số dòng lọc).
- Kho: `approveMaterialsAction(id, note?)` (`POST /mo/tickets/{id}/materials/approve`), dòng yêu cầu có `approved`, `short`.
- Modal: `TicketDetail.agent` = `{source, model, proposedDept, riskLevel, signals[{id, quote}], steps[string], disagreements[string]} | null` từ `agent_decision`.
- Test TRƯỚC cho mỗi hàm map/filter mới ⇒ đỏ ⇒ `red-before.txt`.

Xong khi (mỗi file evidence kết `EXIT=`, Git Bash redirect, CẤM PowerShell `>`):
- `npm run test` EXIT=0 ⇒ `unit.txt`; `npm run typecheck` EXIT=0 ⇒ `typecheck.txt`; `npm run lint` EXIT=0 ⇒ `lint.txt`
- grep `@/db|server/workflow|server/queries|lib/agent|lib/duplicates` trong `portal/src` (trừ `src/db/`) = 0 ⇒ `grep.txt`

## 4. Luật
- Quyền ở backend; không log token/nội dung cư dân; `server-only` cho file gọi backend.
- Thiếu chi tiết ⇒ phương án an toàn + ghi "Quyết định của worker".

## 5. Tầng: 🟠. Không giao con.

## 6. Mẫu report `reports/R04_thi-cong_WP2b.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H04_thi-cong_WP2b.md` / `Base: <sha>` / `Head: <sha>; working tree chưa commit`; bảng lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; export mới (chữ ký) theo màn — đây là hợp đồng cho WP3–5; quyết định của worker; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
