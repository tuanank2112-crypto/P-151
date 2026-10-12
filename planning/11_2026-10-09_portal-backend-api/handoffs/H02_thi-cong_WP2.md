1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: từ `D:/P151-portal-fe` chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` — ghi exit code; KHÔNG chạy chế độ ghi.
3. Đọc theo thứ tự: `planning/11_2026-10-09_portal-backend-api/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` (toàn bộ) → `specs/SPEC-P02-portal-client.md` (toàn bộ) → `specs/SPEC-P01-backend-ext.md` §1–§4 (chỉ để biết route mới) → `docs/portal.md` → `portal/AGENTS.md` (Next 16 khác kiến thức cũ; tài liệu đúng bản ở `portal/node_modules/next/dist/docs/`).

## 1. Bối cảnh
- Worktree `D:/P151-portal-fe`, nhánh `feature/nhuy-portal-fe`, Base `da20de9`. Ghi `git rev-parse HEAD` + `git status --porcelain` trước khi sửa. Worker WP1 đang sửa backend Python song song — KHÔNG chạm ngoài `portal/`.
- Portal Next.js 16 (`portal/`) đang đọc/ghi Postgres riêng (Drizzle). Gói này thay TOÀN BỘ lớp dữ liệu + phiên + ảnh + đăng nhập bằng lời gọi backend `/api/v1`, theo 01-CONTRACTS và SPEC-P02. UI (`*-app.tsx`) do WP3–5 làm sau, nhưng page phải vẫn biên dịch được.
- Backend chạy thử: `D:/P151` đã có server memory ở `http://127.0.0.1:8001` (tài khoản cũ `cudan01`…/`Demo@2026`; tài khoản `cudan`/`123456` có sau WP1). Dùng để thử tay; không bắt buộc.

## 2. Phạm vi
- ĐƯỢC GHI: đúng danh sách file WP2 ở plan.md §3; `planning/11_.../evidence/WP2/*`; `planning/11_.../reports/R02_thi-cong_WP2.md`.
- ĐƯỢC SỬA TỐI THIỂU để biên dịch (không đổi giao diện): `portal/src/app/*/*-app.tsx`, `portal/src/components/**` — chỉ đổi kiểu (`id: string`, tên trường theo DTO mới) và chữ ký action; KHÔNG thêm/bớt tính năng UI (đó là WP3–5). Liệt kê từng file trong report.
- CẤM: ngoài `portal/`; `portal/src/db/**`, `portal/drizzle/**` (giữ nguyên, chỉ ngừng import); commit, push, `git add -A`, `git stash`; ghi Supabase.

## 3. Việc phải làm
a. Test TRƯỚC `portal/tests/unit/backend-map.test.ts` + `portal/tests/unit/session.test.ts` theo TESTING §2 dòng WP2 ⇒ đỏ ⇒ `evidence/WP2/red-before.txt`.
b. Viết: `server/backend.ts`, `server/session.ts`, `server/act.ts`, `lib/dto.ts` (01 §5), `lib/backend-map.ts` (01 §3, §6, SPEC-P03 §4.4 bảng `failing_items`), `server/data/{resident,reception,departments,management,warehouse}.ts` (01 §4), MỌI action ở 01 §7 trong `app/actions/*.ts` + `ticketDetailAction`, route ảnh (SPEC-P02 §5), login (SPEC-P02 §4), `app/*/page.tsx` gọi loader mới.
c. Dọn theo SPEC-P02 §6; loại `tests/unit/agent.test.ts`, `duplicates.test.ts` nếu file nguồn bị xoá.
d. Xong khi (mỗi file evidence kết `EXIT=`):
   - `npm run test` EXIT=0 ⇒ `evidence/WP2/unit.txt`
   - `npm run typecheck` EXIT=0 ⇒ `evidence/WP2/typecheck.txt`
   - `npm run lint` EXIT=0 (0 error) ⇒ `evidence/WP2/lint.txt`
   - `rg "@/db|server/workflow|server/queries|lib/agent|lib/duplicates" portal/src` ⇒ 0 dòng ⇒ `evidence/WP2/grep.txt`
   - Thử thật với backend 8001: đăng nhập `bptn01`/`Demo@2026` qua `login` (script `tsx` nhỏ hoặc `next dev` + curl) và gọi loader reception ⇒ in số ticket ⇒ `evidence/WP2/smoke.txt` (không được ⇒ ghi lý do).
   - Ghi evidence bằng Git Bash redirect (UTF-8). CẤM PowerShell `>`.

## 4. Luật
- Quyền ở backend (I-02); portal không tự chặn ghi theo stage.
- Không log token/thân request cư dân. `server-only` cho mọi file gọi backend.
- Thiếu chi tiết ⇒ chọn phương án an toàn, ghi "Quyết định của worker" trong report.

## 5. Tầng: 🟠. Không giao con.

## 6. Mẫu report `planning/11_2026-10-09_portal-backend-api/reports/R02_thi-cong_WP2.md`
Dòng 1 `Vai · thi công · họ/model · Bước 0 exit · hiểu việc`; dòng 2–4 `Handoff: handoffs/H02_thi-cong_WP2.md` / `Base: <sha>` / `Head: <sha>; working tree chưa commit`; bảng lệnh + exit; test tổng/pass/fail/skip; `git diff --stat` + untracked; danh sách export mới (chữ ký); file UI sửa tối thiểu; quyết định của worker; bảng phân công; việc không làm; câu hỏi mở; dòng cuối `⏳ Chờ người duyệt.`
