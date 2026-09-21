Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude Sonnet 5 · Bước 0: exit 0 (`NÃO ĐÃ OK — KHÔNG CẦN NÂNG CẤP`) · hiểu việc: phạm vi = `app/(bql)/documents/**`, `app/(bql)/review/**`, `app/(bql)/layout.tsx`, `app/api/bql/**` (mới, không dùng tới), `lib/adapters/bql-store.ts` (mới), `app/globals.css` (chỉ thêm cuối), `tests/bql-*.test.ts` (mới) · xong khi = W1 build+curl 19 mã tài liệu · W2 script evidence chứng minh đổi tài liệu → đổi hành vi retrieval ngay, tự trả lại trạng thái cũ · W3 test máy trạng thái `review_queue.state` exit 0 · W4 test authz exit 0 và đã đo ĐỎ khi tạm gỡ chặn · W5 cổng tổng (tsc/build/test/3 script check) đều exit 0, test không giảm dưới 82 · cấm = ngoài phạm vi, `git add/commit/push` (theo 3 điều bổ sung của phiên, ưu tiên hơn handoff), chạy `eval_golden.mjs`/`probe_defects.mjs`, hardcode tri thức, cache theo câu hỏi.

## 1. Lệnh + exit code nguyên văn (chạy sau cùng, trên mã đã revert)

```
$ npx tsc --noEmit
EXIT:0

$ node scripts/run_tests.mjs
ℹ tests 113
ℹ pass 113
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
EXIT:0   (đã chạy 2 lần; lần đầu một test của worker khác — tests/memory.test.ts,
          ngoài phạm vi gói này — trượt vì HTTP 429 quota Gemini cạn giữa lúc
          đang chạy, lần chạy lại ngay sau đó sạch 113/113. Không đụng gì tới
          test đó, không sửa gì để "cho xanh")

$ DATA_BACKEND=postgres npm run build
✓ Compiled successfully
✓ Generating static pages (4/4)
EXIT:0

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT:0

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT:0

$ bash scripts/check_no_hardcoded_knowledge.sh
matches: 0
EXIT:0
```

**Test tổng/pass/fail/skip: 113 / 113 / 0 / 0** (mốc gốc theo handoff: 82 — không giảm, tăng 31: +3 `bql-authz` + +4 `bql-review` do tôi thêm; số còn lại (+24) là các file test khác do hai worker song song (P02/P04) thêm trong lúc tôi làm việc, không phải của tôi).

## 2. Từng WP — lệnh + bằng chứng

### W1 — Màn `/documents` liệt kê 19 tài liệu thật (🟠)
```
$ DATA_BACKEND=postgres npm run build → EXIT 0
$ DATA_BACKEND=postgres next start -p 3911
$ curl -s -H "Cookie: resident_agent_session=<cookie ký thật, vai bql>" \
    -o out.html -w "http:%{http_code}\n" http://localhost:3911/documents
http:200
```
Đếm mã tài liệu bằng `grep -oE '<code>[A-Z0-9-]+</code>' out.html | sort -u | wc -l` → **19**.
Bằng chứng: [`evidence/p03/w1-documents-200.txt`](../evidence/p03/w1-documents-200.txt).
**Kết quả:** ✅ ĐẠT — HTTP 200, đủ 19 mã, có `effective_status`/`allowed_for_rag`/số mục mỗi dòng, dòng vàng khi tài liệu hết hiệu lực hoặc bị cấm RAG.

### W2 — Đổi trạng thái tài liệu ảnh hưởng NGAY retrieval, R7 (🔴)
**Chưa ĐẠT trọn vẹn — bị chặn bởi hạ tầng (tầng 1), không phải lỗi của gói P03.**

Kế hoạch gốc: dùng `scripts/trace_sample.mjs` (theo 3 điều bổ sung của phiên, tối đa 3 lượt). Phát hiện `trace_sample.mjs` hardcode `conversation_id: "trace-sample"` — không phải uuid hợp lệ, vỡ ngay trên backend Postgres thật (`invalid input syntax for type uuid`, lỗi ở `lib/pipeline/index.ts` → `lib/adapters/db.ts::appendMessage`, cả hai NGOÀI phạm vi gói P03). Bằng chứng: [`evidence/p03/w2-attempt1-fk-bug-found.txt`](../evidence/p03/w2-attempt1-fk-bug-found.txt).

Viết script riêng **trong `evidence/`** (đúng vị trí "xong khi" của W2 chỉ định, không phải `scripts/`) tự tạo một `conversation` hợp lệ rồi gọi `runTurn()` thật — [`evidence/p03/w2_r7_demo.mjs`](../evidence/p03/w2_r7_demo.mjs). Chạy đúng 2 lần (2 lượt `runTurn`, trong hạn mức "tối đa 3 lượt" của 3 điều bổ sung): cả hai lần đều dính **HTTP 429 — hạn mức Gemini của cả đội đã cạn thật** (không phải bug của tôi). Bằng chứng nguyên văn:
[`evidence/p03/w2-attempt2-rate-limited-429.txt`](../evidence/p03/w2-attempt2-rate-limited-429.txt),
[`evidence/p03/w2-attempt3-rate-limited-429.txt`](../evidence/p03/w2-attempt3-rate-limited-429.txt).
Khối `finally` của script chạy đúng cả hai lần: trả `effective_status` về `Current` và dọn sạch dữ liệu tạm — xác nhận bằng `scripts/sql.mjs` sau đó (`effective_status | effective_to` = `Current | (null)`).

**Bằng chứng bổ sung, không tốn hạn mức Gemini** — [`evidence/p03/w2_r7_sql_evidence.mjs`](../evidence/p03/w2_r7_sql_evidence.mjs), chạy `exit 0`, evidence [`evidence/p03/w2-sql-level-proof-exit0.txt`](../evidence/p03/w2-sql-level-proof-exit0.txt): chứng minh đúng cơ chế R7 dựa vào — `setEffectiveStatus()` của `bql-store.ts` đổi `documents.effective_status` và **câu SQL lexical thật** (`01-CONTRACTS.md` §4.2, không qua model) đọc thấy giá trị mới NGAY ở lượt truy vấn kế tiếp, không cache, không deploy lại. Đây là đúng nửa "retrieval" của R7; nửa "agent A1/A2/A3 đọc citation và đổi câu trả lời" không đo được bằng máy trong lượt này vì hạn mức Gemini.

**Kết luận W2:** cơ chế ghi (Server Action → `bql-store.ts` → cột DB đúng) đã chứng minh đúng và có hiệu lực ngay; phần "hỏi qua pipeline 3 agent thật, thấy câu trả lời đổi" bị chặn bởi tầng 1 (hạ tầng — hạn mức nhà cung cấp), cần người chạy lại khi hạn mức Gemini hồi, bằng đúng `evidence/p03/w2_r7_demo.mjs` đã có sẵn (idempotent, tự dọn dẹp).

### W3 — Máy trạng thái `review_queue.state` (🟠)
```
$ node scripts/run_tests.mjs bql-review
✔ assertPendingTransition: state='pending' ⇒ không ném lỗi (chuyển hợp lệ)
✔ assertPendingTransition: state='approved' ⇒ ném ReviewTransitionError
✔ assertPendingTransition: state='edited_approved' ⇒ ném ReviewTransitionError
✔ assertPendingTransition: state='rejected' ⇒ ném ReviewTransitionError
ℹ tests 4  pass 4  fail 0
EXIT:0
```
Test canh hàm THUẦN `assertPendingTransition` (không chạm DB) — khớp đúng máy trạng thái SPEC-P03 §3.3 (3 trạng thái cuối, không đường quay lại `pending`, P03-C4). Đây là mức "test tự biết đúng/sai" theo đúng tầng 🟠 của handoff; KHÔNG kèm test tích hợp DB thật (xem mục "việc không làm").
`/review` đã đo chạy đúng khi `answer_turns`/`review_queue` RỖNG (bảng của worker P02 đang nối dây ghi): hiện "Chưa có lượt nào cần duyệt.", không crash, không `NaN` — xác nhận bằng build + curl thủ công lúc W1.

### W4 — Phân quyền (🟠, đã đo ĐỎ)
```
$ node scripts/run_tests.mjs bql-authz     # bản GỐC
✔ 3/3 pass, EXIT:0

# TẠM GỠ CHẶN: checkBqlAuthz() sửa thành `return { ok: true }` vô điều kiện
$ node scripts/run_tests.mjs bql-authz     # bản GỠ CHẶN
✖ checkBqlAuthz: không có phiên ⇒ chặn, http_status=401  (true !== false)
✖ checkBqlAuthz: vai resident ⇒ chặn, http_status=403    (true !== false)
✔ checkBqlAuthz: vai bql ⇒ cho qua
ℹ tests 3  pass 1  fail 2
EXIT:1

# PHỤC HỒI mã gốc, chạy lại xác nhận xanh
$ node scripts/run_tests.mjs bql-authz
✔ 3/3 pass, EXIT:1 → 0
```
Bằng chứng: [`evidence/p03/w4-authz-red.txt`](../evidence/p03/w4-authz-red.txt) (đỏ, exit 1) và [`evidence/p03/w4-authz-green.txt`](../evidence/p03/w4-authz-green.txt) (xanh sau khi phục hồi). `git diff` xác nhận `checkBqlAuthz` trong `lib/adapters/bql-store.ts` ở trạng thái gốc (không còn dòng "TẠM GỠ").
Mọi Server Action (`documents/actions.ts`, `review/actions.ts`) gọi `checkBqlAuthz(session)` TRƯỚC khi đọc/ghi — không chỉ dựa vào `app/(bql)/layout.tsx`, vì Server Action có thể bị gọi trực tiếp bỏ qua vòng render trang (E5 AuthzError, `00-ARCHITECTURE.md` §8).

### W5 — Cổng tổng (🟢)
Xem mục 1. Tất cả exit 0, test 113/113 (không giảm dưới 82), `fail 0`, `skip 0`.

## 3. `git diff --stat` (đo trên working tree, chưa commit — theo 3 điều bổ sung của phiên) + SHA nền

`HEAD` lúc bắt đầu: `7956ccc643a01497fdaa114ad56bdbc8e5cdb924` (cây sạch trước khi bắt đầu).

```
$ git status --porcelain -- lib/adapters/bql-store.ts app/(bql)/documents app/(bql)/review \
    app/(bql)/layout.tsx tests/bql-review.test.ts tests/bql-authz.test.ts \
    planning/01_2026-09-20_resident-agent-v1/evidence/p03
 M app/(bql)/documents/page.tsx
 M app/(bql)/review/page.tsx
?? app/(bql)/documents/DocumentsTable.tsx
?? app/(bql)/documents/actions.ts
?? app/(bql)/review/ReviewQueueList.tsx
?? app/(bql)/review/actions.ts
?? lib/adapters/bql-store.ts
?? planning/01_2026-09-20_resident-agent-v1/evidence/p03/
?? tests/bql-authz.test.ts
?? tests/bql-review.test.ts

$ git diff --stat -- "app/(bql)/documents/page.tsx" "app/(bql)/review/page.tsx" app/globals.css
 app/(bql)/documents/page.tsx |  35 ++++++++---
 app/(bql)/review/page.tsx    |  29 +++++++--
 app/globals.css              | 158 ++++++++++++++...   (khối P03 tôi thêm CUỐI file;
                                                            phần còn lại của 158 dòng
                                                            là khối P04 một worker khác
                                                            thêm sau đó, cùng nguyên tắc
                                                            "chỉ thêm cuối", không đụng
                                                            dòng nào của tôi)
```
`app/(bql)/layout.tsx` — **không đụng**, đã đúng yêu cầu (chặn vai `resident`) từ trước, không cần sửa.
`app/api/bql/**` — **không tạo**, không cần thiết cho các WP đã làm (dùng Server Actions theo đúng mẫu SPEC-P03 §2.2/§3.2, không phải Route Handler).

## 4. Bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)

| Gói | Tầng yêu cầu (handoff §5) | Model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 (màn documents + `bql-store.ts` đọc) | 🟠 | Sonnet 5 (phiên này) | Có schema `01-CONTRACTS.md` §3 + SPEC rõ, đo bằng `grep -c` |
| W2 (Server Action ghi + evidence script) | 🔴 | Sonnet 5 (phiên này) | Ghi thẳng bảng tri thức, đổi hành vi retrieval đang chạy — tự viết script đo mới khi phát hiện `trace_sample.mjs` không dùng được trên Postgres, không tự quyết sửa `scripts/` (ngoài phạm vi) |
| W3 (máy trạng thái review) | 🟠 | Sonnet 5 (phiên này) | Test thuần theo đúng bảng §3.3 |
| W4 (phân quyền + đo đỏ) | 🟠 | Sonnet 5 (phiên này) | Có mẫu sẵn ở `guard.ts`/`route.ts`; đã tự đo đỏ-rồi-xanh theo đúng luật §K.5 |
| W5 (cổng tổng) | 🟢 | Sonnet 5 (phiên này) | Chạy lệnh có sẵn, chép số |

## 5. Việc KHÔNG làm + lý do

1. **`uploadDocument` / `newDocumentVersion` (SPEC-P03 §2.2, §2.3) chưa có màn hình.** Hàm ghi tương ứng cũng chưa viết ở `bql-store.ts`. Lý do: không thuộc "xong khi" của W1–W5 trong handoff (W1 chỉ đòi liệt kê + `setDocumentStatus`/`setEffectiveStatus` đủ cho kịch bản R7); ưu tiên làm đúng 5 WP có tiêu chí đo được trong thời gian phiên. Đã có sẵn `setSectionExcluded()` ở `bql-store.ts` nhưng chưa nối UI.
2. **`P03-M1/M4/M5/M7/M8` (bảng số đo nghiệm thu đầy đủ của SPEC-P03 §6) chưa chạy** — handoff H07 chỉ giao đúng 5 "xong khi" ở mục 3, không phải toàn bộ bảng §6 của SPEC. `P03-M4`/`M5`/`M7` có thể chạy ngay bằng `scripts/sql.mjs` khi cần (không cần code thêm) vì đã có dữ liệu seed; chưa chủ động chạy vì ngoài phạm vi "xong khi" được giao.
3. **W2 chưa đo được bằng pipeline 3 agent thật** — bị chặn bởi hạn mức Gemini cạn (429, tầng 1 hạ tầng), đã ghi rõ ở mục 2. Có bằng chứng SQL-level thay thế cho phần retrieval; script `evidence/p03/w2_r7_demo.mjs` sẵn sàng chạy lại khi hạn mức hồi — không cần sửa gì thêm.
4. **Không `git add`/`commit`** theo đúng 3 điều bổ sung của phiên (có 2 worker khác chạy song song trên cùng working tree).
5. **Không chạy `eval_golden.mjs`/`probe_defects.mjs`** theo đúng 3 điều bổ sung.

## 6. Câu hỏi cần người

1. **Hạn mức Gemini khi nào hồi?** Cần chạy `node --env-file=.env.local planning/01_2026-09-20_resident-agent-v1/evidence/p03/w2_r7_demo.mjs` một lần để có bằng chứng đầy đủ R7 qua pipeline 3 agent thật (script đã viết sẵn, idempotent, tự dọn dữ liệu tạm).
2. **`trace_sample.mjs` hardcode `conversation_id: "trace-sample"` (không phải uuid) vỡ trên `DATA_BACKEND=postgres`** — lỗi ở `scripts/` + `lib/pipeline/index.ts`, cả hai ngoài phạm vi gói P03. Cần worker phụ trách `lib/pipeline/**` hoặc `scripts/**` vá (either tạo conversation thật trong script, hoặc để `runTurn()` tự tạo conversation khi thiếu — xem `evidence/p03/w2-attempt1-fk-bug-found.txt`).
3. **Muốn có UI `uploadDocument`/`newDocumentVersion` đầy đủ (SPEC-P03 §2.2/§2.3) không, hay 5 WP hiện tại đã đủ cho demo?** Nếu cần, xin một handoff riêng — không tự mở rộng phạm vi.

## Tiếp theo

🖐 Cần tay người: quyết định có cần chạy lại `w2_r7_demo.mjs` khi hạn mức Gemini hồi để có bằng chứng R7 qua pipeline 3 agent đầy đủ, và giao ai vá bug `conversation_id` không phải uuid ở `trace_sample.mjs`/`lib/pipeline/index.ts` (ngoài phạm vi gói này).
🤖 Agent làm được ngay: nối UI `uploadDocument`/`newDocumentVersion`/`setSectionExcluded` (SPEC-P03 §2.2/§2.3) nếu được giao handoff riêng; chạy lại `w2_r7_demo.mjs` khi hạn mức Gemini hồi mà không cần sửa gì thêm.
⭐ Nên làm trước: vá bug `conversation_id` ở `trace_sample.mjs`/pipeline — vì nó chặn MỌI script đo qua pipeline thật trên Postgres, không riêng gói P03 (worker P04/eval cũng sẽ cần đường này).
⏸ Chưa làm: W2 chưa có bằng chứng đầy đủ qua pipeline 3 agent thật (chỉ có bằng chứng SQL-level + 2 lần 429 nguyên văn), vì hạn mức Gemini của đội đã cạn lúc chạy phiên này; `uploadDocument`/`newDocumentVersion`/UI loại section chưa làm vì ngoài "xong khi" được giao.
