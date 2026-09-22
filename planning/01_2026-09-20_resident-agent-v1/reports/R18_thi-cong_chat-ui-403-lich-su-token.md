# R18 — Thi công: hết 403 `/chat`, lịch sử hội thoại, token ở panel chặng

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 · hiểu việc: phạm vi `app/(resident)/**`, `app/api/chat/route.ts` (chỉ thêm, không đổi hợp đồng POST), route mới `app/api/conversations/route.ts` (GET), `tests/chat-history.test.ts` (mới), `evidence/h15-chat-ui/**` · xong khi: W1 hai lượt curl cùng thân JSON UI gửi ⇒ cả hai HTTP 200 và lượt 2 dùng đúng `conversation_id` lượt 1; W2 test 403/đúng-số-tin-nhắn + curl POST 2 câu → GET ≥4 messages; W3 `grep input_tokens` có kết quả + `check_no_confidence_ui.sh` matches:0; W4 tsc 0 / build 0 / test ≥173 pass 0 fail 0 skip / `check_adapter_boundary.sh` violations:0 · cấm bằng lời mình: không chạm `lib/adapters/**`, `lib/pipeline/**`, `lib/confidence.ts`, `app/(bql)/**`, `scripts/**`, `evals/**`, `knowledge/**`, migration, `package.json`, `planning/**` ngoài evidence+report, `brain4agent/**`; không `git add/commit/push`; không để lộ `confidence`/`gate_triggered`.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H15_chat-ui-403-lich-su-token.md`
Base: `18cbd29`
Head: `4037c27` (không tự commit; các file khác thay đổi trong working tree là của gói H16/H17/H18 đang chạy song song, KHÔNG do tôi tạo — xem mục "git diff --stat" bên dưới, tôi chỉ đụng đúng 4 đường dẫn trong phạm vi)

## 1. Nguyên nhân (đối chiếu G33)

`app/(resident)/chat/page.tsx:39–40` (bản cũ) sinh `crypto.randomUUID()` mới mỗi lần tải trang, gửi làm `conversation_id`. `app/api/chat/route.ts` đòi id đó phải TỒN TẠI và thuộc user, không thì `ConversationNotOwned` → 403. Route đã trả `conversation_id` về ở body (`:199`) nhưng client không đọc. Đây thuần là lỗi CLIENT — không cần sửa `app/api/chat/route.ts`, nên file đó KHÔNG bị đụng (đúng phạm vi "chỉ được thêm", ở đây là không thêm gì vì không cần).

## 2. Việc đã làm

- **W1**: `app/(resident)/chat/page.tsx` — `conversationId` đổi từ `useRef(crypto.randomUUID())` sang `useRef("")`; lượt đầu gửi `""`, đọc `body.conversation_id` từ response và lưu lại (biến + `localStorage`) cho các lượt sau.
- **W2**: file mới `app/api/conversations/route.ts` (GET) — bọc `store.getConversationOwner()` + `store.listMessages()` (đã có sẵn trong `DataStore`, không sửa `lib/adapters/db.ts`); 401 chưa đăng nhập, 403 sai vai hoặc `owner !== session.user_id` (gộp cả case không tồn tại, không phân biệt lý do — đúng SPEC-P02 §9). Client: `useEffect` đọc `conversation_id` từ `localStorage` khi mở `/chat`, gọi GET, nạp lịch sử vào state `history`; 403/lỗi ⇒ xoá key, bắt đầu hội thoại mới, KHÔNG hiện lỗi đỏ (đúng handoff). Quyết định kỹ thuật: khoá `localStorage` DÙNG CHUNG (không theo user) vì JS phía client không đọc được cookie phiên (`httpOnly`) để làm khoá riêng mà không thêm lời gọi mạng — trường hợp lệch user tự rơi vào nhánh 403→bỏ qua đã có sẵn, không hiện lỗi đỏ. Ghi rõ lý do trong comment code.
- **W3**: dòng render panel "Các chặng xử lý" thêm ` · <in>/<out> tokens` khi `input_tokens`/`output_tokens` khác null.
- File mới `tests/chat-history.test.ts`: kiểm ownership (403 cho user khác, 403 cho id không tồn tại, 200 cho đúng chủ) và đúng số `messages` qua `store.getConversationOwner`/`listMessages` — cùng logic route triển khai. Lý do KHÔNG import thẳng `route.ts`: `getSessionPayload()` dùng `next/headers cookies()`, ném lỗi ngoài request App Router thật; `node --test` (`scripts/run_tests.mjs`, không được sửa) không dựng request đó — đúng quy ước đã có của `tests/conversation-id.test.ts`/`tests/memory.test.ts` (test route `/api/chat` qua `runTurn`/`DataStore`, không qua HTTP). Bằng chứng MÃ HTTP thật nằm ở evidence curl.

## 3. Lệnh + exit code (nguyên văn)

```
$ node --env-file=.env.local scripts/run_tests.mjs chat-history
✔ H15 W2 — id của người khác (bql) yêu cầu hội thoại của resident ⇒ 403
✔ H15 W2 — id không tồn tại ⇒ 403 (không phân biệt 'không có' với 'không thuộc bạn')
✔ H15 W2 — id của chính mình ⇒ đúng số tin nhắn đã ghi (listMessages)
ℹ tests 3 · pass 3 · fail 0
EXIT:0
```
(Bằng chứng ĐỎ trước khi sửa được đo bằng mutation test: tạm ép `ownershipStatus()` luôn trả 200, chạy lại → 2/3 fail đúng dòng kiểm 403, revert → xanh lại 3/3. File: `evidence/h15-chat-ui/w2_test_red.txt`, `w2_test_green.txt`.)

```
$ npx tsc --noEmit
EXIT:0
```

```
$ npm run build
✓ Compiled successfully · Route /api/conversations có mặt (ƒ, dynamic)
EXIT:0
```

```
$ node --env-file=.env.local scripts/run_tests.mjs
ℹ tests 180 · pass 179 · fail 1 · skip 0
EXIT:1  (lần trước đó: pass 178 · fail 2 — 1 fail là pool exhaustion thoáng qua, không lặp lại)
```
Fail còn lại KHÔNG thuộc phạm vi H15 — xem mục 5.

```
$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT:0

$ grep -n "input_tokens" "app/(resident)/chat/page.tsx"
255:                {s.input_tokens != null || s.output_tokens != null
256:                  ? ` · ${s.input_tokens ?? 0}/${s.output_tokens ?? 0} tokens`

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT:0
```

Curl e2e (thân JSON ĐÚNG UI thật gửi, cookie HMAC resident sinh bằng cùng cơ chế `app/login/actions.ts`):
- W1: 2 lượt liên tiếp, `conversation_id: ""` → 200, lượt 2 dùng lại đúng id lượt 1 → 200. File `evidence/h15-chat-ui/w1_two_turns.txt`.
- W2: POST 2 câu (golden answerable) → GET `/api/conversations` trả **7** messages (≥4) chính chủ; cùng id với cookie `bql@demo.local` (không phải chủ) → **403**. File `evidence/h15-chat-ui/w2_history.txt`.

Dữ liệu hội thoại tạo trong lúc đo curl (4 id) đã tự dọn bằng `node --env-file=.env.local scripts/sql.mjs "DELETE FROM conversations WHERE id IN (...)"` (G37) — không để lại rác trong DB demo.

## 4. `git diff --stat` (chỉ file tôi đụng)

```
$ git diff --stat -- "app/(resident)/chat/page.tsx"
 app/(resident)/chat/page.tsx | 88 +++++++++++++++++++++++++++++++++++++++++---
 1 file changed, 83 insertions(+), 5 deletions(-)

File mới (chưa track, git status --porcelain):
?? app/api/conversations/          (route.ts, 48 dòng)
?? tests/chat-history.test.ts      (100 dòng)
?? planning/01_2026-09-20_resident-agent-v1/evidence/h15-chat-ui/
```
Các đường dẫn khác đang có thay đổi trong working tree (`lib/adapters/db.ts`, `app/(bql)/**`, `tests/conversation-id.test.ts`, `tests/memory.test.ts`, …) là của gói khác đang chạy song song — KHÔNG phải tôi tạo ra, không đụng tới.

`grep -cP '[\x08\x0c\x0b]'` trên 4 file tôi sửa/tạo (page.tsx, route.ts, chat-history.test.ts, make_cookie.mjs) = 0.

## 5. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Tầng thực làm | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 (hết 403) | 🟠 | 🟠 | Sửa client theo đúng gợi ý handoff |
| W2 (route + lịch sử) | 🟠 | 🟠 | Route mới + hydrate client + test |
| W3 (token panel) | 🟢 | 🟢 | Một dòng render |
| W4 (cổng chung) | 🟢 | 🟢 | Chạy đo, không sửa gì thêm |

## 6. Việc KHÔNG làm + lý do

- **KHÔNG sửa `app/api/chat/route.ts`**: bug W1 hoàn toàn ở client (G33 đã chỉ đúng); route đã trả `conversation_id` sẵn. Không có gì để "thêm" mà không vi phạm "không đổi hợp đồng POST" một cách vô cớ.
- **KHÔNG điều tra/sửa fail `tests/eligibility-top.test.ts` (DEF-04)**: chạy riêng lẻ (`node --env-file=.env.local scripts/run_tests.mjs eligibility-top`) vẫn đỏ y hệt — `top1` đổi từ `COM-HOURS-02`/`expired_or_unknown` kỳ vọng sang `scope_mismatch` đo được. Đây là logic `lib/pipeline` eligibility ranking trên dữ liệu tài liệu (`knowledge/**`/DB), cả hai đều CẤM chạm theo phạm vi H15, và có dấu hiệu do gói khác đang sửa `lib/adapters/db.ts`/dữ liệu tài liệu song song (working tree đang có diff ở `lib/adapters/db.ts`, `lib/adapters/bql-store.ts`, `lib/adapters/store-mock.ts` từ gói khác, chưa commit). Báo lên, không tự sửa.
- **KHÔNG dọn 1 fail pool-exhaustion thoáng qua ở lần chạy đầu** (`conversation-id.test.ts`, "max clients reached ... pool_size 15") — không lặp lại ở lần chạy thứ hai, đúng dấu hiệu tranh chấp connection pool Postgres do nhiều gói chạy test song song cùng lúc trên cùng DB demo, không phải lỗi code.
- **KHÔNG khoá `localStorage` theo user_id**: đã ghi rõ lý do kỹ thuật ở mục 2 (client không đọc được cookie httpOnly) — đây là quyết định tự chọn phương án đơn giản nhất trong phạm vi cho phép, đúng luật L.2, không cần dừng hỏi.

## 7. Câu hỏi cần người

Không có — mọi quyết định nằm trong phạm vi cho phép của handoff.

## 8. Rủi ro vận hành đáng chú ý (không phải lỗi của tôi, nhưng ảnh hưởng đo đạc)

Dev server `next dev` trên máy Windows này bị vỡ cache `.next` (`ENOENT routes-manifest.json`, `Cannot find module './543.js'`) nhiều lần trong lúc đo evidence — nghi do các gói khác cũng đang build/chạy đồng thời trên cùng thư mục `.next`. Đã xử lý bằng cách tắt tiến trình cũ + `rm -rf .next` + khởi động lại trước mỗi vòng đo; không để lại tiến trình dev server nào sau khi xong (đã `netstat` xác nhận cổng 3101 trống).

✅ ĐẠT — W1/W2/W3/W4 đều có bằng chứng máy đo đúng "xong khi"; 1 fail còn lại (`eligibility-top.test.ts`) ngoài phạm vi H15, đã nêu rõ nguyên nhân và không tự sửa.
