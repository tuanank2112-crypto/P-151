1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: THI CÔNG.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. `CẦN NÂNG CẤP` ⇒ chạy lại KHÔNG cờ đúng một lần → `--check` phải 0. Mã 2 ⇒ dừng, báo.
3. Đọc theo thứ tự: `planning/01_2026-09-20_resident-agent-v1/plan.md` §2 → `specs/00-ARCHITECTURE.md` → `specs/01-CONTRACTS.md` (§3.4 bảng vận hành, §7 kiểu) → `specs/SPEC-P02-Agent-Pipeline.md` §7 (memory) + §9 (bảng lỗi). Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH TỰ CHỨA
Repo `D:\build phase`, nhánh `main`, HEAD `10e2997`, cây sạch. Next.js + TS strict, Node 24 chạy thẳng `.ts`.
Số đo nền tại HEAD: `npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` **82 pass / 0 fail / 0 skip** · `bash scripts/check_adapter_boundary.sh` → `violations: 0` · `check_no_confidence_ui.sh` và `check_no_hardcoded_knowledge.sh` → `matches: 0`.
DB Supabase ĐANG SỐNG, đã migrate + seed: 19 documents · 98 sections · 98 chunks · 2 users. Bảng `conversations`, `messages`, `answer_turns`, `audit_log`, `review_queue` ĐÃ tồn tại (xem `db/migrations/004_operational.sql`) nhưng **rỗng 0 dòng** — pipeline chưa ghi dòng nào. `DATABASE_URL` có sẵn trong `.env.local`; script tự nạp qua `scripts/_batch.mjs::loadLocalEnv()`, chạy tay thì thêm `--env-file=.env.local`.
Đường đi hiện tại: `POST /api/chat` → `lib/pipeline/index.ts::runTurn()` → 9 chặng → trả `PublicTurnResult`. `runTurn` hiện là hàm THUẦN, không ghi DB.

## 2. PHẠM VI
Được đụng: `lib/adapters/db.ts` · `lib/pipeline/index.ts` · `app/api/chat/route.ts` · `lib/types.ts` (chỉ THÊM kiểu) · `tests/memory.test.ts` (tạo mới) · `db/migrations/006_*.sql` (chỉ nếu thật sự thiếu cột — phải idempotent, xem Luật §4).
CẤM đụng: `app/(bql)/**` · `app/(resident)/**` · `lib/adapters/store-mock.ts` · `lib/adapters/model.ts` · `lib/confidence.ts` · `lib/pipeline/{eligibility,retrieval,ownership,errors}.ts` · `lib/retrieval/**` · `knowledge/**` · `evals/**` · `specs/**` · `plan.md` · `brain4agent/**` · `db/migrations/001..005` · `scripts/**`. Hai worker khác đang chạy song song trên `app/(bql)/**` — đụng vào là hỏng cả hai.
VÙNG CẤM + LÝ DO: `specs/00-ARCHITECTURE.md` §3. Thêm: **BB-07** — CHỈ `lib/adapters/db.ts` được mở connection, CHỈ `lib/adapters/model.ts` được gọi nhà cung cấp model. **P02-C10** — CẤM bỏ qua ghi `answer_turns` ở nhánh lỗi; mẫu số dashboard sẽ sai. **BB-05** — CẤM để `confidence`/`gate_triggered` ra khỏi máy chủ; chỗ cắt đã có sẵn ở `route.ts::toPublic()`, giữ nguyên nó. **P02-C11** — CẤM đưa lịch sử hội thoại vào A2.

## 3. VIỆC PHẢI LÀM
W1 — `DataStore` mọc thêm các hàm vận hành (`createConversation`, `appendMessage`, `listMessages`, `insertAnswerTurn`), cài cho `PostgresDataStore`. Kho mock: cài bản **ném lỗi rõ ràng** hoặc no-op có ghi chú — mock không có bảng vận hành (Đ24), CẤM giả vờ ghi được.
  *Xong khi:* `npx tsc --noEmit` → exit 0.
W2 — `runTurn()` ghi **đúng MỘT dòng** `answer_turns` mỗi lượt, **kể cả nhánh escalate và nhánh ném lỗi** (P02-C10). Ghi đủ: `conversation_id`, `question_vi`, `decision`, `reason_code`, `confidence`, `gate_triggered`, `citations`, `lifecycle_state`, `is_golden_run`. Cột nào `004_operational.sql` không có thì KHÔNG tự bịa — ghi vào "Câu hỏi mở".
  *Xong khi:* `DATA_BACKEND=postgres node --env-file=.env.local -e "<gọi runTurn 1 lượt>"` rồi `node --env-file=.env.local scripts/sql.mjs "select count(*) from answer_turns"` → tăng đúng **1**.
W3 — Lịch sử hội thoại bền qua phiên: `/api/chat` nhận `conversation_id` có sẵn thì dùng lại, không có thì tạo mới; mỗi lượt ghi 2 `messages` (hỏi + đáp). `ConversationNotOwned` → HTTP 403 (SPEC-P02 §9).
  *Xong khi:* gọi `/api/chat` hai lần cùng `conversation_id` → `select count(*) from messages where conversation_id=...` = **4**, và lần hai `select count(*) from conversations` KHÔNG tăng.
W4 — `tests/memory.test.ts`: canh bất biến "một lượt = đúng một dòng `answer_turns`" và nhánh lỗi vẫn ghi. Test **phải từng ĐỎ**: hoàn nguyên bằng cách bỏ lời ghi ở nhánh escalate ⇒ test đỏ; dán output đỏ vào evidence.
  *Xong khi:* `node scripts/run_tests.mjs memory` → exit 0, và có file evidence chụp lượt ĐỎ.
W5 — Cổng tổng: `npx tsc --noEmit` · `npm run build` · `node scripts/run_tests.mjs` · 3 script `check_*.sh`.
  *Xong khi:* tất cả exit 0, `npm test` **≥ 82 + số ca mới**, `fail 0`, `skip 0`.

## 4. LUẬT
Không `git add -A` (chỉ stage đúng file trong phạm vi) · không `git push` · không `vercel` · mã thoát 2 = dừng hỏi · không "sửa cho tốt hơn" ngoài phạm vi · commit message 100% tiếng Anh, Conventional Commits · SPEC mâu thuẫn hoặc thiếu cột ⇒ ghi "Câu hỏi mở" vào report, làm tiếp phần độc lập, KHÔNG tự chế schema · migration ĐÃ CHẠY thì CẤM sửa (`schema_migrations` giữ checksum) — thiếu thì thêm file `006_*.sql` idempotent · CẤM in `GEMINI_API_KEY`/`DATABASE_URL` ra log hay report · CẤM chạy `eval_golden.mjs` (đốt hạn mức của cả đội).

## 5. BẢNG GÓI VIỆC → TẦNG
| Gói | Tầng | Vì sao |
| :-- | :-- | :-- |
| W1 | 🟠 | Có schema sẵn ở `004_operational.sql`, chữ ký suy ra được, test tự biết đúng sai |
| W2 | 🔴 | Chạm bất biến BB-11 + P02-C10 và đường đi của mọi lượt hỏi; sai là hỏng mẫu số dashboard mà không ai thấy |
| W3 | 🟠 | Có spec §7, hành vi đo được bằng `count(*)` |
| W4 | 🟠 | Viết test theo bất biến đã nêu |
| W5 | 🟢 | Chạy lệnh có sẵn, chép số |

## 6. REPORT PHẢI CÓ
Theo `docs/HANDOFF_PROTOCOL.md` §7 tại hub: dòng 1 khai vai + loại + họ/model + Bước 0 exit + hiểu việc bằng lời mình · bảng lệnh + exit code nguyên văn · test tổng/pass/fail/skip · `git diff --stat` + SHA · **bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)** · việc KHÔNG làm + lý do · câu hỏi cần người. Thiếu dòng khai vai hoặc bảng phân công ⇒ report bị trả lại.

7. DÒNG CUỐI: Report: `planning/01_2026-09-20_resident-agent-v1/reports/R06_thi-cong_bb11-memory.md` · Evidence: `planning/01_2026-09-20_resident-agent-v1/evidence/bb11/<ten-do>.txt`
