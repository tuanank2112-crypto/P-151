1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `brain4agent/-known-gotchas.md` **G33** (đặc tả lỗi của bạn) → `specs/00-ARCHITECTURE.md` §2 dòng R3/R4/R6 → `specs/SPEC-P02-Agent-Pipeline.md` §9 (bảng lỗi, 403) → `app/api/chat/route.ts` dòng 150–205 → `app/(resident)/chat/page.tsx` nguyên văn. Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base = `git rev-parse --short HEAD` lúc bạn bắt đầu (ghi vào report). Demo local ngày mai. Đo thật 2026-09-23: **mọi câu hỏi gõ từ UI `/chat` trả 403** vì client sinh `crypto.randomUUID()` mới mỗi lần tải trang và gửi làm `conversation_id`, còn route đòi id đó phải tồn tại và thuộc user. Route ĐÃ trả `conversation_id` về trong body (dòng ~199) nhưng client không đọc. Hệ quả: R3/R4/R5/R6 cùng chết ở cú bấm đầu tiên. Ngoài ra panel "Các chặng xử lý" chỉ in `step · model · ms`, không in token dù `PipelineStep` có `input_tokens`/`output_tokens` (`lib/types.ts:113–114`).
Số nền (đo lại): `npx tsc --noEmit` 0 · `node scripts/run_tests.mjs` 172/172 · `.env.local` đã có `DATA_BACKEND=postgres`, `MODEL_A2=gemini-3.6-flash`.

## 2. PHẠM VI
**Được ghi:** `app/(resident)/**` · `app/api/chat/route.ts` (chỉ được THÊM, không đổi hợp đồng POST) · **một** route mới `app/api/conversations/route.ts` (GET) · `tests/chat-history.test.ts` (mới) · `evidence/h15-chat-ui/**`.
**CẤM chạm:** `lib/adapters/**` (gói H16 đang sửa `db.ts` song song — chạm là xung đột) · `lib/pipeline/**` · `lib/confidence.ts` · `app/(bql)/**` · `scripts/**` · `evals/**` · `knowledge/**` · migration · `package.json` · `planning/**` ngoài evidence+report · `brain4agent/**`.
**CẤM** `git add/commit/push/stash/reset/checkout`. **CẤM** để lộ `confidence`/`gate_triggered` ra cư dân (BB-05, `scripts/check_no_confidence_ui.sh` phải giữ `matches: 0`). **CẤM** xoá dữ liệu DB ngoài dữ liệu test của chính bạn.

## 3. VIỆC PHẢI LÀM
**W1 — Hết 403.** Lượt đầu gửi `conversation_id: ""` (route tự tạo hội thoại); đọc `body.conversation_id` trả về và dùng lại cho các lượt sau trong cùng phiên. **Xong khi:** `curl` đăng nhập resident (mật khẩu `SEED_RESIDENT_PASSWORD` trong `.env.local`; cách lấy cookie xem `evidence/d28-def04/e2e_api_chat_postgres.txt`) rồi gửi ĐÚNG thân JSON mà UI gửi ở lượt 1 và lượt 2 ⇒ cả hai HTTP 200, lượt 2 dùng đúng `conversation_id` của lượt 1. Lưu output vào `evidence/h15-chat-ui/w1_two_turns.txt`.
**W2 — R4: đăng xuất/đăng nhập lại còn nguyên hội thoại.** Chọn phương án đơn giản nhất KHÔNG cần thêm hàm vào `lib/adapters`: lưu `conversation_id` ở client (`localStorage` khoá theo user) hoặc cookie do route set; khi mở `/chat` gọi `GET /api/conversations?conversation_id=…` ⇒ route mới kiểm `getConversationOwner() === session.user_id` (không thì 403) rồi trả `listMessages()` (cả hai hàm ĐÃ CÓ trong `DataStore`). UI render lại lịch sử cũ → mới trước ô nhập. Id không hợp lệ/không thuộc user ⇒ bỏ qua và bắt đầu hội thoại mới, KHÔNG hiện lỗi đỏ. **Xong khi:** `tests/chat-history.test.ts` chứng minh: id của người khác ⇒ 403; id của mình ⇒ đúng số tin nhắn (test tự dọn hội thoại đã tạo: `DELETE FROM conversations WHERE id=$1`, cascade). Và một lượt curl: POST 2 câu → GET trả ≥ 4 messages, lưu `evidence/h15-chat-ui/w2_history.txt`.
**W3 — R6: panel chặng in token.** Mỗi dòng chặng in `step · model · ms · in/out tokens` khi có; nhìn thấy rõ 3 model khác nhau. Không tạo trang mới. **Xong khi:** `grep -n "input_tokens" "app/(resident)/chat/page.tsx"` có kết quả và `bash scripts/check_no_confidence_ui.sh` ⇒ `matches: 0`.
**W4 — Cổng chung:** `npx tsc --noEmit` 0 · `npm run build` 0 · `node scripts/run_tests.mjs` ≥ 173 pass / 0 fail / 0 skip · `bash scripts/check_adapter_boundary.sh` `violations: 0`.

## 4. LUẬT
Mọi bộ đo mới phải từng ĐỎ (tắt bản vá ⇒ test đỏ, ghi output vào evidence). Bằng chứng e2e phải dùng ĐÚNG thân JSON UI gửi (bài học G33). Không đổi mã lỗi/hợp đồng SPEC-P02 §9. A2 có thể chậm 20–30 s — không phải lỗi của bạn. Thấy việc ngoài phạm vi ⇒ GHI vào report, không tự làm.

## 5. TẦNG
W1 🟠 · W2 🟠 · W3 🟢 · W4 🟢.

## 6. REPORT
Ghi `reports/R18_thi-cong_chat-ui-403-lich-su-token.md`: dòng 1 khai vai/loại/họ model/Bước 0 exit/hiểu việc; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit code nguyên văn từng W; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công gói→tầng; việc KHÔNG làm + lý do; câu hỏi cần người; dòng cuối = ✅/🔁/⛔.
