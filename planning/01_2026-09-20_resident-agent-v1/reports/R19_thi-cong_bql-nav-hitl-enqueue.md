# R19 — Thi công H16: nav BQL + enqueue HITL + khoá nút theo state

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 (claude-sonnet-5) · Bước 0: exit 0 · hiểu việc: phạm vi `lib/adapters/db.ts` (chỉ `insertAnswerTurn`+`AnswerTurnInput`) · `lib/adapters/store-mock.ts` (chỉ `insertAnswerTurn`) · `lib/adapters/bql-store.ts` · `app/(bql)/**` · CSS BQL · `tests/hitl-enqueue.test.ts` (mới) · `evidence/h16-bql/**`; xong khi W1/W2/W3/W4 đạt số đo nêu ở handoff §3; cấm bằng lời mình: không enqueue golden run, không cho state quay lại pending, không ghi đè `original_draft_vi`.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H16_bql-nav-hitl-enqueue.md`
Base: `18cbd29` (lúc bắt đầu) — HEAD repo đã tiến sang `4037c27` trong lúc tôi làm (gói khác commit song song); mọi thay đổi của tôi vẫn ở working tree, CHƯA commit (đúng luật CẤM commit của handoff).
Head: (chưa commit — xem `git status`/`git diff --stat` bên dưới)

## 1. Lệnh + exit code nguyên văn

```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
👉 Trạng thái: NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!
EXIT:0

$ npx tsc --noEmit
(không có output)
TSC_EXIT:0

$ npm run build
✓ Compiled successfully in 3.6s
✓ Generating static pages (4/4)
BUILD_EXIT:0

$ bash scripts/check_adapter_boundary.sh
violations: 0
BOUNDARY_EXIT:0

$ node --env-file=.env.local scripts/run_tests.mjs
ℹ tests 180
ℹ pass 179
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
RUN_TESTS_EXIT:1   ← xem mục "Việc KHÔNG làm" — 1 ca đỏ NGOÀI phạm vi gói này

$ node --env-file=.env.local --test tests/hitl-enqueue.test.ts
ℹ tests 5
ℹ pass 5
ℹ fail 0
EXIT:0
```

## 2. Test tổng / pass / fail / skip

- `tests/hitl-enqueue.test.ts` (mới, 5 ca — 3 Postgres thật + 2 thuần JS): **5/5 pass, 0 fail, 0 skip**.
- Toàn bộ `node scripts/run_tests.mjs`: **180 tổng / 179 pass / 1 fail / 0 skip** (số nền handoff ghi 172; +5 ca mới của tôi +3 ca `chat-history.test.ts` mà gói H15 thêm song song = 180). 1 ca fail là `tests/eligibility-top.test.ts` ("DEF-04 — chunk hạng 1 bị loại vì hết hiệu lực") — KHÔNG thuộc phạm vi gói này (không đụng `knowledge/**`, `lib/pipeline/**`, `scripts/**`), xem mục "Việc KHÔNG làm".

## 3. Bằng chứng "bộ đo mới từng ĐỎ" (Luật §4 handoff)

Tắt điều kiện enqueue tạm thời (`WHERE $7 = 'escalate' AND $14 = false` → `WHERE false`) trong `lib/adapters/db.ts`, chạy lại `tests/hitl-enqueue.test.ts`:

```
✖ H16 W1: decision='escalate' + is_golden_run=false ⇒ đúng 1 dòng review_queue pending trỏ đúng answer_turn_id
  AssertionError: 0 !== 1
✔ H16 W1 (P03-C3): decision='answer' ⇒ 0 dòng review_queue
✔ H16 W1 (chốt SO): decision='escalate' + is_golden_run=true ⇒ 0 dòng review_queue
ℹ pass 2, fail 1
```
Đã khôi phục điều kiện đúng ngay sau đó, chạy lại xác nhận 5/5 pass.

## 4. `git diff --stat` (đúng phạm vi handoff)

```
 app/(bql)/layout.tsx                 |  30 +++++++++-
 app/(bql)/review/ReviewQueueList.tsx | 103 ++++++++++++++++++++---------------
 app/globals.css                      |  38 +++++++++++++
 lib/adapters/bql-store.ts            |  15 ++++-
 lib/adapters/db.ts                   |  38 ++++++++++--
 lib/adapters/store-mock.ts           |  35 +++++++++++-
 6 files changed, 207 insertions(+), 52 deletions(-)
```
File mới (chưa tracked, đúng phạm vi): `app/(bql)/review/queue-logic.ts`, `tests/hitl-enqueue.test.ts`, `evidence/h16-bql/*.txt`.

`git status` cho thấy nhiều file khác đang bị sửa/tạo đồng thời bởi các gói song song (`app/(resident)/**`, `app/api/conversations/**`, `tests/conversation-id.test.ts`, `tests/memory.test.ts`, `tests/conflict-citations.test.ts`, `tests/eval-golden-injection.test.ts`, `docs/OVERVIEW.md`, `.env.example`, `.gitignore`, v.v.) — **tôi KHÔNG chạm bất kỳ file nào trong số đó**, đúng vùng cấm handoff.

## 5. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Tầng thực làm | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 — Enqueue trong `insertAnswerTurn` | 🟠 | 🟠 | Một câu SQL (CTE `WITH new_turn ... new_review ...`) — atomic, đúng phong cách `uploadDocument()` ở `bql-store.ts`; không lộ thêm API transaction (ngoài phạm vi, giống ghi chú sẵn có trong `bql-store.ts:371`) |
| W2 — Thanh điều hướng BQL | 🟢 | 🟢 | 4 `<Link>` + email + đăng xuất; thêm `getUserEmail()` vào `bql-store.ts` vì `SessionPayload` không có email (quyết định trong phạm vi được giao) |
| W3 — Khoá nút theo state + sort | 🟢 | 🟢 | Tách logic thuần vào `app/(bql)/review/queue-logic.ts` để test không cần render React |
| W4 — Cổng chung | 🟢 | 🟢 | Đo lại; 1 ca đỏ ngoài phạm vi, ghi rõ ở dưới |

## 6. Việc KHÔNG làm + lý do

- **KHÔNG sửa `tests/eligibility-top.test.ts`** hay bất cứ gì dưới `knowledge/**`/`lib/pipeline/**`/`scripts/**` để làm ca `DEF-04` xanh lại — đây là vùng CẤM chạm tường minh của handoff H16. Ca này KHÔNG liên quan tới nav/enqueue/khoá nút (nó kiểm tra retrieval chọn `expired_or_unknown` cho tài liệu hết hiệu lực nhưng thực tế trả `scope_mismatch`) — nghi do dữ liệu `knowledge/`/`documents` bị gói khác chỉnh song song (G37: DB demo dùng chung, nhiều gói ghi cùng lúc). Không tự quyết sửa — báo lên.
- **KHÔNG mở API transaction mới ở `db.ts`** cho `insertAnswerTurn` — dùng một câu SQL CTE atomic thay vì `BEGIN/COMMIT`, đúng tiền lệ đã có ở `uploadDocument()` (ghi chú sẵn trong `bql-store.ts:371`: "ngoài phạm vi sửa"). Nếu SO muốn API transaction tường minh, đây là việc khác, cần handoff riêng.
- **KHÔNG chỉnh `mockConversationOwners`/luồng no-op ghi chú BB-11 khác** trong `store-mock.ts` — chỉ thêm đúng nhánh enqueue theo yêu cầu W1.
- **KHÔNG đăng nhập qua form thật để lấy cookie** cho evidence W2 — ký cookie trực tiếp bằng `createSessionCookie()` (cùng secret `.env.local`) cho nhanh và tất định; không tạo thêm route hay sửa `login/actions.ts`.

## 7. Câu hỏi cần người

- Ca `tests/eligibility-top.test.ts::DEF-04` đang đỏ trên `main` hiện tại (ngoài phạm vi tôi) — cần người xác nhận đây là do gói song song đang sửa dữ liệu (G37) hay là hồi quy thật, và ai phụ trách vá.
- HEAD đã tiến từ `18cbd29` (lúc tôi bắt đầu) sang `4037c27` trong lúc tôi làm — tôi KHÔNG rebase/merge, mọi thay đổi vẫn nằm trên working tree so với HEAD hiện tại, chưa kiểm tra file tôi sửa có bị 3-way conflict với `4037c27` không (chỉ `git diff --stat` xác nhận đúng 6 file trong phạm vi thay đổi, không có conflict marker).

## 8. Phán quyết

✅ W1/W2/W3/W4 đạt số đo yêu cầu của gói này (tsc 0, build 0, adapter boundary 0, bộ test mới 5/5 pass và đã chứng minh đỏ khi tắt enqueue). Cổng `run_tests.mjs` tổng thể còn 1 ca đỏ NGOÀI phạm vi (`eligibility-top.test.ts`), không phải do thay đổi của gói H16 — đề nghị người duyệt xác nhận trước khi coi cổng chung W4 là ✅ toàn repo.
