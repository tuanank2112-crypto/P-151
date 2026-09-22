# R24 — Thi công: UI biên nhận + demo 23:39 (H21, P05)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude, Sonnet 5 · Bước 0: exit 0 ·
hiểu việc: card kết quả hành động trong `/chat` (5 `ActionStatus`) + trang `/chat/receipts`
+ `POST /api/actions/undo` (Hoàn tác) + `scripts/demo_2339.mjs` (P05-M8) + tài liệu, đi qua
`lib/types.ts`/`lib/simbackend/contract.ts` sẵn có, test bằng backend giả tiêm qua
`__setSimBackendForTesting`; CẤM chạm `lib/**` trừ import, CẤM `git add/commit/push`.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H21_p05-ui-bien-nhan-demo2339.md`
Base: `9cd093c` (đầu phiên)
Head: working tree hiện tại, chưa `git add/commit` theo CẤM của handoff — `lib/**` đã bị
gói khác (H19/H20) commit song song trong lúc tôi làm (xem mục 3).

## 1. Lệnh + exit code nguyên văn

```
$ node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check
NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP THÊM!
EXIT:0

$ npx tsc --noEmit
tests/p05-idempotency.test.ts, tests/p05-precheck-guard.test.ts: 3 lỗi TS2352
EXIT:2   -- CẢ HAI file KHÔNG do tôi tạo (git status `??`, thuộc gói H19 đang thi công song
            song — xem mục 5). Không còn lỗi nào trong phạm vi của tôi (đã xác nhận bằng một
            lần chạy `tsc` sạch TRƯỚC KHI hai file đó xuất hiện trong cây làm việc).

$ npm run build
✓ Compiled successfully; /chat, /chat/receipts, /api/actions/undo đều lên đúng route (ƒ)
EXIT:0

$ node --env-file=.env.local scripts/run_tests.mjs   (TOÀN BỘ, không lọc theo file)
tests 222
pass 222
fail 0
cancelled 0
skipped 0
todo 0
EXIT:0

$ node scripts/run_tests.mjs p05-ui-action-card
tests 9 / pass 9 / fail 0
EXIT:0

$ node scripts/run_tests.mjs p05-ui-undo-route
tests 7 / pass 7 / fail 0
EXIT:0

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT:0

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT:0

$ node --env-file=.env.local scripts/demo_2339.mjs   (BACKEND CHƯA CÀI — lúc bắt đầu W3)
CHƯA KẾT LUẬN: lib/simbackend chưa được gói H19 cài đặt thật.
EXIT:3   -- evidence/h21-ui-demo2339/demo_2339_before_backend.txt (xong khi W3 yêu cầu)

$ node --env-file=.env.local scripts/demo_2339.mjs   (BACKEND ĐÃ LÊN — H19/H20 landed giữa phiên)
[3] decision=action status=blocked blocking_reasons=["intake_closed"]   -- bước 1–5 ĐÚNG
[6a] decision=action status=blocked receipt_code=—   -- kỳ vọng status=done, SAI
EXIT:1   -- evidence/h21-ui-demo2339/demo_2339_after_backend_defect.txt (xem mục 5, câu hỏi 1)

$ curl (dev server cổng 3103, rm -rf .next trước — G40)
GET /chat            (không phiên) -> 307 -> /login
GET /chat/receipts    (không phiên) -> 307 -> /login
POST /api/actions/undo (không phiên) -> 403 {"ok":false,"status":"forbidden",...}
```

## 2. Test tổng/pass/fail/skip

- Toàn bộ `tests/` qua `npm test`: **222 tổng / 222 pass / 0 fail / 0 skip** (bao gồm 16 test
  mới của tôi: 9 `p05-ui-action-card.test.ts` + 7 `p05-ui-undo-route.test.ts`, cộng các test
  mới của gói H19/H20 đã có mặt trong cây làm việc).
- `grep -cP '[\x08\x0c\x0b]'` trên toàn bộ file tôi sửa/tạo: **0** ở mọi file.

## 3. `git diff --stat` + SHA

```
README.md                     |  16 +
app/(resident)/chat/page.tsx  | 186 +++++-
app/globals.css               |  58 ++
presentation/README.md        |   4 +-
presentation/demo_script.md   |  19 +
5 files changed, 279 insertions(+), 4 deletions(-)
```

File MỚI của tôi (`git status` báo `??`, không nằm trong `diff --stat`):
`app/(resident)/chat/action-view.ts`, `app/(resident)/chat/receipts/page.tsx`,
`app/(resident)/chat/receipts/ReceiptsTable.tsx`, `app/(resident)/chat/receipts/actions.ts`,
`app/api/actions/undo/route.ts`, `app/api/actions/undo/logic.ts`, `scripts/demo_2339.mjs`,
`tests/p05-ui-action-card.test.ts`, `tests/p05-ui-undo-route.test.ts`,
`evidence/h21-ui-demo2339/demo_2339_before_backend.txt`,
`evidence/h21-ui-demo2339/demo_2339_after_backend_defect.txt`.

File `??` KHÁC trong cây làm việc, KHÔNG phải của tôi (thuộc H19/H20, đối chiếu bằng nội
dung — tôi không sửa dòng nào trong các file này): `db/migrations/006_p05_action_layer.sql`,
`db/seed/`, `lib/pipeline/action.ts`, `lib/simbackend/guard.ts`, `scripts/validate_capabilities.mjs`,
`scripts/validate_policy.mjs`, `tests/_fake-simbackend.ts`, `tests/_p05-helpers.ts`,
`tests/p05-idempotency.test.ts`, `tests/p05-pipeline-a1-action.test.ts`,
`tests/p05-pipeline-action.test.ts`, `tests/p05-precheck-guard.test.ts`,
`planning/01_2026-09-20_resident-agent-v1/evidence/h20-pipeline-action/`. File `M` khác
ngoài của tôi (cùng lý do): `lib/adapters/metrics-store.ts`, `lib/adapters/model.ts`,
`lib/pipeline/index.ts`, `lib/reason-messages.ts`, `lib/simbackend/index.ts`.
SHA đầu phiên: `9cd093c`. KHÔNG `git add/commit` (đúng CẤM handoff).

## 4. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Tầng đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 — card kết quả hành động | 🟠 | 🟠 (tự làm, đọc `lib/types.ts` + SPEC-P05 §9 trước; tách hàm map thuần `toActionView` để test không cần render React) | 9 test, đủ 5 `ActionStatus` + nhánh không có `action_result` |
| W2 — `/chat/receipts` + Hoàn tác | 🟠 | 🟠 (tự làm; tách `logic.ts` khỏi `route.ts` vì `next/server` không resolve dưới `node --test` — phát hiện giữa chừng, xem mục 5) | 7 test: chính mình 200, người khác 403, lần 2 409, thiếu phiên/vai sai/thiếu mã, receipt vốn không hoàn tác được |
| W3 — `scripts/demo_2339.mjs` | 🟠 | 🟠 (tự làm; thiết kế tiền kiểm phát hiện backend chưa cài ⇒ exit 3, cộng proxy đếm lời gọi cho lúc backend lên thật) | Chạy 2 lần: lúc backend chưa cài (exit 3, đúng "xong khi") và sau khi H19/H20 landed giữa phiên (exit 1, phát hiện một khả năng lỗi ở gói khác — mục 5) |
| W4 — kịch bản + README | 🟢 | 🟢 (theo mẫu Cảnh có sẵn trong `demo_script.md`) | Thêm Cảnh 6, mục README, slide Demo — không hứa gì ngoài Đ48 mục 8 |
| W5 — cổng chung | 🟢 | 🟢 (chạy lệnh có sẵn) | tsc: 0 lỗi trong phạm vi tôi (2 file lỗi ngoài phạm vi — mục 5); build 0; test 222/222; hai check bash 0 |

## 5. Việc KHÔNG làm + lý do

1. **`scripts/demo_2339.mjs` chưa đạt exit=0 sau khi backend lên thật (H19/H20 landed giữa
   phiên tôi làm).** Bước 1–5 (23:39, chặn đúng `intake_closed`, không lệnh ghi, không lộ giờ
   hoạt động) ĐÚNG. Bước 6a (sau 08:30 hôm sau, kỳ vọng đặt được) vẫn ra
   `status=blocked, code=too_early`. Điều tra bằng script tạm (đã xoá) cho thấy câu trả lời in
   ra "Bây giờ 02:00" trong khi `SIM_NOW=...09:00:00+07:00` — lệch đúng 7 giờ, giống dạng hiển
   thị giờ UTC thay vì giờ Việt Nam ở tầng soạn câu trả lời (`lib/pipeline/action.ts` hoặc
   `lib/simbackend/guard.ts` — CẢ HAI đều CẤM tôi chạm). Đây là dấu hiệu một lỗi múi giờ ở gói
   H19/H20, KHÔNG phải ở `scripts/demo_2339.mjs` (script chỉ đặt biến môi trường `SIM_NOW` và
   đọc thẳng `action_result`/`answer_vi` do `runTurn` trả về — không tự tính giờ). Bằng chứng:
   `evidence/h21-ui-demo2339/demo_2339_after_backend_defect.txt`. Script phân lập đúng: không
   nuốt lỗi thành "SAI HÀNH VI" âm thầm — in rõ dòng "SAI HÀNH VI" kèm exit=1, đúng luật Đ26 (
   không kết luận giả). Bằng chứng "xong khi" CHÍNH của W3 (exit=3 khi backend chưa cài) đã đạt
   — xem `evidence/h21-ui-demo2339/demo_2339_before_backend.txt`.
2. **`tests/p05-idempotency.test.ts`, `tests/p05-precheck-guard.test.ts` làm `tsc --noEmit`
   thoát mã 2.** Hai file này KHÔNG do tôi tạo (`git status` báo `??`, thuộc gói H19 landed
   song song giữa phiên) — CẤM chạm `lib/**`/file ngoài phạm vi nên tôi không sửa. Đã xác nhận
   trước đó (một lần `tsc` chạy sạch lúc hai file này còn chưa xuất hiện trong cây làm việc) là
   0 lỗi nằm trong phạm vi của tôi.
3. **`party_size` không hiện ở thẻ "Đã thực hiện xong" (status=done).** `ActionResult`
   (`lib/types.ts`) không có trường `party_size` ở cấp trên (chỉ `ActionBookingView` — dùng cho
   `status=listed` — có trường này). Thêm trường vào `ActionResult` là sửa `lib/types.ts`,
   ngoài phạm vi CẤM của handoff (`lib/**` trừ import). Card vẫn hiện đủ tiện ích/khung
   giờ/mã biên nhận như handoff liệt kê, chỉ thiếu đúng một mục.
4. **Không smoke-test đăng nhập thật qua trình duyệt/curl cho `/chat/receipts` với phiên
   `resident` thật** (Server Action `loginAction` cần header `Next-Action` của Next.js, không
   dựng nhanh bằng curl thuần trong thời gian gói này) — thay vào đó đã: (a) xác nhận layout
   `(resident)` chặn thiếu phiên bằng 307 → `/login` (curl), (b) xác nhận route undo trả 403
   đúng khi thiếu phiên (curl), (c) xác nhận toàn bộ logic qua 7 test `node:test` với backend
   giả bao trùm đủ 3 kịch bản "xong khi" (chính mình 200, người khác 403, lần 2 409).

## 6. Câu hỏi cần người

1. **Nghi vấn lỗi múi giờ ở tầng H19/H20** (mục 5.1) — cần người giữ `lib/pipeline/action.ts`
   / `lib/simbackend/guard.ts` xác nhận có phải bug thật không, và chạy lại
   `node --env-file=.env.local scripts/demo_2339.mjs` sau khi vá — script đã sẵn sàng, không
   cần sửa gì thêm về phía UI/script.
2. **`party_size` cho thẻ "Đã thực hiện xong"** (mục 5.3) — nếu muốn hiện, cần thêm trường vào
   `ActionResult` (`lib/types.ts`), việc đó thuộc gói giữ file đó, không phải H21.

---
✅ DUYỆT (W1, W2, W4, W5) / 🔁 SỬA: W3 cần gói H19/H20 xác nhận và vá nghi vấn lỗi múi giờ ở
mục 5.1 rồi chạy lại `demo_2339.mjs` để lấy bằng chứng exit=0 — script/test phía UI (W1, W2)
đã đủ bằng chứng đạt, không phụ thuộc kết quả mục này.
