1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. `CẦN NÂNG CẤP` ⇒ chạy lại KHÔNG cờ đúng một lần → `--check` phải 0. Mã 2 ⇒ dừng, báo.
3. Đọc theo thứ tự: `planning/01_2026-09-20_resident-agent-v1/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` (§3.1 documents/sections, §6 users) → `specs/SPEC-P03-BQL-Console.md` (TOÀN BỘ — đây là SPEC chính của gói). Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH TỰ CHỨA
Repo `D:\build phase`, nhánh `main`, HEAD `10e2997`, cây sạch. Next.js 15 App Router + TS strict, Node 24 chạy thẳng `.ts`.
Số đo nền tại HEAD: `npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` **82 pass / 0 fail / 0 skip** · `check_adapter_boundary.sh` → `violations: 0` · `check_no_confidence_ui.sh` / `check_no_hardcoded_knowledge.sh` → `matches: 0`.
DB Supabase ĐANG SỐNG, đã migrate + seed: 19 documents · 98 sections · 98 chunks · 2 users (`bql@demo.local` vai `bql`). `DATABASE_URL` có sẵn trong `.env.local`.
**Hiện trạng 4 màn BQL: KHUNG RỖNG 13–16 dòng, không màn nào đọc dữ liệu.** Đã có: `app/(bql)/layout.tsx` chặn vai `resident`; `lib/auth/guard.ts::getSessionPayload()`; `lib/adapters/db.ts::getSql()` (hàm truy vấn tham số hoá `sql(text, params) -> rows`) và `getDataStore()`.
Mẫu để chép cách làm: `app/api/chat/route.ts` (route có phân quyền + bảng lỗi) và `app/(resident)/chat/page.tsx` (client component + CSS trong `app/globals.css`).

## 2. PHẠM VI
Được đụng: `app/(bql)/documents/**` · `app/(bql)/review/**` · `app/(bql)/layout.tsx` · `app/api/bql/**` (tạo mới) · `lib/adapters/bql-store.ts` (TẠO MỚI — mọi truy vấn của gói này nằm ở đây) · `app/globals.css` (chỉ THÊM khối CSS mới ở CUỐI file) · `tests/bql-*.test.ts` (tạo mới).
CẤM đụng: `app/(bql)/eval/**` và `app/(bql)/dashboard/**` (worker khác đang làm) · `lib/adapters/db.ts` và `lib/pipeline/**` và `app/api/chat/**` (worker khác đang làm) · `app/(resident)/**` · `lib/{types,confidence,reason-messages}.ts` · `lib/retrieval/**` · `knowledge/**` · `evals/**` · `specs/**` · `plan.md` · `brain4agent/**` · `db/migrations/**` · `scripts/**`.
VÙNG CẤM + LÝ DO: `specs/00-ARCHITECTURE.md` §3 và `SPEC-P03` mục vùng cấm. Thêm: **BB-07** — CẤM mở connection ngoài `lib/adapters/`; `bql-store.ts` nằm TRONG `lib/adapters/` nên hợp lệ, nhưng nó phải dùng `getSql()` của `db.ts` chứ KHÔNG tự `new pg.Pool`. **BB-10** — CẤM viết mã tài liệu (`OCP1-…`) vào mã nguồn; mọi thứ đọc từ DB. **P02-C8** — CẤM cache: BQL đổi tài liệu thì lượt hỏi kế tiếp phải đổi NGAY, nên mọi route/trang của gói này đặt `export const dynamic = "force-dynamic"`.

## 3. VIỆC PHẢI LÀM
W1 — Màn `documents`: liệt kê 19 tài liệu thật từ DB (mã, tiêu đề, `status`, `effective_status`, `effective_to`, `allowed_for_rag`, số section). Hiện rõ tài liệu đã hết hiệu lực và tài liệu bị cấm dùng cho RAG.
  *Xong khi:* `npm run build` exit 0 và `curl` trang `/documents` với cookie vai `bql` trả HTTP 200 có đủ 19 mã tài liệu (đếm bằng `grep -c`).
W2 — BQL đổi `status` / `effective_status` / `allowed_for_rag` của một tài liệu bằng Server Action, ghi thẳng DB, **ảnh hưởng NGAY tới retrieval** (R7 của SPEC-P03).
  *Xong khi:* một script đo trong `evidence/` chứng minh 3 bước theo đúng thứ tự: (1) hỏi một câu → có citation tới tài liệu X; (2) đặt tài liệu X thành `Deprecated`; (3) hỏi LẠI cùng câu → KHÔNG còn citation nào tới X. In 3 dòng, exit 0. **Nhớ trả lại trạng thái cũ ở cuối script.**
W3 — Màn `review` (HITL): hàng đợi `review_queue` với ba hành động **Duyệt / Sửa rồi duyệt / Từ chối**, đúng máy trạng thái `review_state` ở `001_enums.sql` (`pending` → `approved` | `edited_approved` | `rejected`). Hàng đợi CHỈ chứa lượt bị escalate (quyết định C-02 của chủ tịch, xem `plan.md` §2).
  *Xong khi:* `node scripts/run_tests.mjs bql-review` exit 0 — test canh máy trạng thái: chuyển hợp lệ thì đổi, chuyển không hợp lệ thì ném lỗi.
  *Lưu ý:* bảng `answer_turns` hiện **rỗng** (worker khác đang nối dây ghi). Gói này phải chạy đúng khi hàng đợi rỗng: hiện "chưa có lượt nào cần duyệt", CẤM crash, CẤM `NaN`, CẤM màn hình trắng.
W4 — Phân quyền: mọi route/trang của gói chặn vai `resident` (HTTP 403 hoặc redirect), không phiên thì về `/login`.
  *Xong khi:* `node scripts/run_tests.mjs bql-authz` exit 0, và test **phải từng ĐỎ** khi gỡ lớp chặn — dán output đỏ vào evidence.
W5 — Cổng tổng: `npx tsc --noEmit` · `npm run build` · `node scripts/run_tests.mjs` · 3 script `check_*.sh`.
  *Xong khi:* tất cả exit 0, số test **không giảm** so với 82, `fail 0`, `skip 0`.

## 4. LUẬT
Không `git add -A` · không `git push` · không `vercel` · mã thoát 2 = dừng hỏi · không "sửa cho tốt hơn" ngoài phạm vi · commit message 100% tiếng Anh, Conventional Commits · SPEC mâu thuẫn ⇒ ghi "Câu hỏi mở" vào report, làm tiếp phần độc lập · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` ra log hay report · CẤM chạy `eval_golden.mjs` hay `probe_defects.mjs` (đốt hạn mức Gemini của cả đội) · giao diện tiếng Việt, tên mã tiếng Anh.

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
| :-- | :-- | :-- |
| W1 | 🟠 | Có schema và SPEC rõ, kết quả đo được bằng `grep -c` |
| W2 | 🔴 | Ghi thẳng vào bảng tri thức và đổi hành vi retrieval đang chạy; sai là hỏng dữ liệu demo |
| W3 | 🟠 | Máy trạng thái đã có trong enum, test tự biết đúng sai |
| W4 | 🟠 | Có mẫu sẵn ở `layout.tsx` và `route.ts` |
| W5 | 🟢 | Chạy lệnh có sẵn, chép số |

## 6. REPORT PHẢI CÓ
Theo `docs/HANDOFF_PROTOCOL.md` §7 tại hub: dòng 1 khai vai + loại + họ/model + Bước 0 exit + hiểu việc bằng lời mình · bảng lệnh + exit code nguyên văn · test tổng/pass/fail/skip · `git diff --stat` + SHA · **bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)** · việc KHÔNG làm + lý do · câu hỏi cần người. Thiếu dòng khai vai hoặc bảng phân công ⇒ report bị trả lại.

7. DÒNG CUỐI: Report: `planning/01_2026-09-20_resident-agent-v1/reports/R07_thi-cong_p03-console-bql.md` · Evidence: `planning/01_2026-09-20_resident-agent-v1/evidence/p03/<ten-do>.txt`
