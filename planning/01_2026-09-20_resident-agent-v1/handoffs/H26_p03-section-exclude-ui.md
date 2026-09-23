1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `specs/SPEC-P03-BQL-Console.md` §2.2 (`setSectionExcluded`, dòng ~64), bảng hiệu ứng dòng ~116 (E-4 `section_excluded`), bảng lỗi dòng ~233 (`MissingExclusionNote` 422), vùng cấm P03-C* → `lib/adapters/bql-store.ts` (`listDocumentsForConsole`, `setSectionExcluded`, `checkBqlAuthz`, kiểu `DocumentError`) → `db/migrations/` (bảng `sections`: cột `is_excluded`, `exclusion_note_vi`, `heading_vi`, `document_id`) → `app/(bql)/documents/{page.tsx,actions.ts,DocumentsTable.tsx}` → `lib/pipeline/eligibility.ts` (cổng E-4) → `tests/bql-*.test.ts` (mẫu test).

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base = `git rev-parse --short HEAD`. P03 đã duyệt nhưng còn một lỗ: hàm ghi `setSectionExcluded` có ở `bql-store.ts`, **không có màn hình nào gọi tới** (`app/(bql)/documents/page.tsx` dòng 6 ghi "CHƯA LÀM"). BQL không loại được một mục sai khỏi truy hồi trong lúc demo. Số nền: `tsc` 0 · test 251/251 · BB-05/07/10 = 0.

## 2. PHẠM VI
**Được ghi:** `lib/adapters/bql-store.ts` (CHỈ thêm `listSectionsForConsole(document_id)`) · `app/(bql)/documents/actions.ts` (thêm action `setSectionExcluded`) · `app/(bql)/documents/SectionsPanel.tsx` (mới, client component) · `app/(bql)/documents/page.tsx` (gắn panel, xoá ghi chú "CHƯA LÀM") · `app/globals.css` (chỉ khi cần) · `tests/bql-section-exclude.test.ts` (mới) · `planning/01_2026-09-20_resident-agent-v1/evidence/h26-section-exclude/**` · `reports/R30_thi-cong_p03-section-exclude-ui.md`.
**CẤM chạm:** mọi file khác; `db/**` (CẤM migration), `lib/pipeline/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json`.
**CẤM** `git add/commit/push`. **CẤM `git stash` / `git checkout --` / `git reset` / `git clean`** (AGENTS.md §5.D.5). **CẤM** SQL trong `app/` (BB-07 — mọi truy vấn qua `bql-store.ts`). **CẤM** gọi model.

## 3. VIỆC PHẢI LÀM
**W1 — `listSectionsForConsole(document_id)`**: trả `{ section_id, heading_vi, is_excluded, exclusion_note_vi }[]` theo thứ tự section, đúng MỘT câu SELECT. **Xong khi:** `tsc` 0.
**W2 — Server Action `setSectionExcluded`**: tự kiểm `checkBqlAuthz(session)` như các action cùng file (resident ⇒ `AuthzError`), gọi store, `revalidatePath("/documents")`. **Xong khi:** `grep -c "checkBqlAuthz(session)" app/(bql)/documents/actions.ts` = số `export async function` của file.
**W3 — `SectionsPanel`**: trong trang `/documents`, chọn một tài liệu (select theo `document_id`) ⇒ liệt kê mục; mỗi mục có nút "Loại khỏi trả lời" (bắt buộc ô lý do không rỗng, lỗi `MissingExclusionNote` hiện tiếng Việt) và "Đưa lại" cho mục đang loại; hiện lý do đã ghi. Chữ tiếng Việt cho BQL, không thuật ngữ nội bộ. Danh sách mục có thể nạp bằng một Server Action đọc (`listSections`) có kiểm vai.
**W4 — Test + chứng minh đỏ**: `tests/bql-section-exclude.test.ts` — (a) `is_excluded=true` + note rỗng ⇒ `MissingExclusionNote` và KHÔNG chạm DB (store trả lỗi trước SQL); (b) nếu có thể test Postgres an toàn: loại một mục thật rồi đưa lại trong `try/finally`, đọc lại `is_excluded` đúng, **luôn khôi phục trạng thái ban đầu** (đọc giá trị gốc trước). Chứng minh đỏ một lần; lưu `red.txt`, `green.txt`.
**W5 — Kiểm thật + cổng**: kiểm `netstat -ano | findstr :31` không có dev server khác (G40); `rm -rf .next`; `npm run dev -- --port 3106`; cookie BQL theo mẫu `evidence/h23-dashboard-actioned/make_bql_cookie.mjs`; `curl` `/documents` ⇒ 200 và có chữ "Loại khỏi trả lời"; **tắt server**. **CẤM lưu cookie vào evidence** (chỉ lưu kết quả grep). Cổng: `tsc` 0 · `npm run build` 0 · `node scripts/run_tests.mjs` ≥ 251 + mới, 0 fail, 0 skip · `check_adapter_boundary.sh` 0 · `check_no_confidence_ui.sh` 0.

## 4. LUẬT
Sửa tối thiểu, theo mẫu `DocumentsTable.tsx`/`UploadPanel.tsx`. Không để lại dữ liệu đổi trong DB, không để lại tiến trình nền. Thấy việc ngoài phạm vi ⇒ GHI report.

## 5. TẦNG
W1 🟢 · W2 🟢 · W3 🟠 · W4 🟠 · W5 🟢.

## 6. REPORT
`reports/R30_thi-cong_p03-section-exclude-ui.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc KHÔNG làm; câu hỏi cần người; dòng cuối ✅/🔁/⛔).
