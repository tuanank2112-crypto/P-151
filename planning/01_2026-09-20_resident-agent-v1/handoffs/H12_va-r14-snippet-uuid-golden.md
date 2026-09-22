1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. **DỪNG Ở `--check`**, CẤM chế độ GHI. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `plan.md` §2 — **Đ42, Đ43, Đ44** (ba quyết định này LÀ đặc tả của bạn, đọc nguyên văn, mọi con số trong đó là hợp đồng) → `reports/R14_tham-dinh_d37-d38.md` (bảy phát hiện + 14 phép phá; mục 1,2,3,4,6,7 là việc của bạn) → `specs/01-CONTRACTS.md` §7 `Citation` (dòng 514, nhắc lại 816) → `specs/SPEC-P04-Eval-Dashboard.md` (nguồn số của panel Golden) → `specs/TESTING-ACCEPTANCE.md` (BB-04, BB-07). Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base `27c38f5`. Working tree có sẵn hai bản vá **chưa commit** (Đ37 `conversation_id` uuid + Đ38 citations cho `G1_conflict`) — **lõi của chúng đã qua 5 đột biến đối kháng và ĐỨNG VỮNG, CẤM làm lại**. Việc của bạn là vá **bảy phát hiện** mà thẩm định 🔴 tìm ra *bên trong và quanh* hai bản vá đó.
Số đo nền tại working tree này (đo lại, đừng tin dòng này): `npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` **143 pass / 0 fail / 0 skipped** · `check_adapter_boundary.sh` `violations: 0`.
DB Supabase sống, đã seed (19 doc / 98 section / 98 chunk / 2 user), `DATABASE_URL` trong `.env.local`. **Hạn mức Gemini ĐÃ CẠN hôm nay** — mọi việc dưới đây làm được KHÔNG cần gọi model.

## 2. PHẠM VI
**Được ghi:** `lib/pipeline/index.ts` · `lib/adapters/db.ts` · `lib/adapters/store-mock.ts` · `scripts/eval_golden.mjs` · `tests/conflict-citations.test.ts` · `tests/conversation-id.test.ts` · `tests/citations.test.ts` · `tests/pipeline-order.test.ts` · một file test MỚI cho `toSnippet` nếu bạn thấy tách ra sạch hơn.
**CẤM chạm:** `lib/pipeline/eligibility.ts` · `lib/confidence.ts` · `lib/eval/score.ts` · `lib/adapters/bql-store.ts` · `lib/adapters/metrics-store.ts` · mọi file dưới `app/` · mọi migration đã chạy · `knowledge/**` · `evals/golden/**` · `planning/**` (kể cả plan.md, specs, reports — orchestrator giữ) · `brain4agent/**` · `package.json`.
**CẤM** `git add`/`commit`/`push`/`stash`/`reset`/`checkout`. **CẤM** chạy `scripts/eval_golden.mjs` toàn lượt hay `probe_defects.mjs` (cạn hạn mức). **CẤM** thêm dependency. **CẤM tick `G11`** ở bất kỳ đâu.
**CẤM xoá dữ liệu DB** (239 dòng `answer_turns` nhiễm test — đó là quyết định của chủ tịch, Luật L.3, không phải của bạn).

## 3. VIỆC PHẢI LÀM

**W1 — `toSnippet()` (Đ42, `R14` mục 1+2).** Hiện hàm sai hai kiểu, đo được: input 330 ký tự không có `.?!` trong 300 đầu ⇒ snippet **301** ký tự (vi phạm `01-CONTRACTS` §7 `≤ 300`); `"1." + 400 ký tự` ⇒ snippet `"1."` (2 ký tự), `"." + 500` ⇒ snippet `"."` (1 ký tự).
Chốt của Đ42: cắt cứng ở **299** rồi nối `…` (tổng 300); chỉ cắt theo câu khi dấu câu nằm **sau sàn 80 ký tự**, ngược lại cắt cứng kèm `…`.
**VÙNG CẤM:** CẤM sửa `chunkSection()` để "chặn từ gốc" — giới hạn 300 là hợp đồng của `Citation`, không phải của chunk.
**Xong khi:** có test unit gọi THẲNG `toSnippet` (export nó nếu cần) với input **tự dựng, CHỦ ĐỘNG không dùng dữ liệu seed** — vì chính dữ liệu seed (dài tối đa 200) là thứ làm assertion cũ ở `tests/conflict-citations.test.ts:92` rỗng nghĩa. Phủ tối thiểu 5 ca: ≤300 giữ nguyên · >300 không có dấu câu · dấu câu sau sàn · dấu câu trước sàn (vd `"1."`) · đúng 300 và đúng 301.

**W2 — Bộ đo phải TỪNG ĐỎ (Đ42, `R14` mục 3).** Thẩm định chứng minh: xoá **sạch** giới hạn 300 (`return trimmed;`) mà suite vẫn `EXIT=0`, `pass 2 / fail 0`. Sau khi bạn xong, tự làm lại phép phá đó (trong bản sao tạm của bạn, KHÔNG sửa repo) và **dán mã thoát ĐỎ vào report**. Test không chứng minh được là đỏ được thì không tính là xong — đây là điều kiện nghiệm thu, không phải lời khuyên.

**W3 — Cổng canh uuid (Đ43, `R14` mục 4).** `isValidUuid()` (`db.ts:57`) hiện là **mã chết**: 0 chỗ dùng ở mã sản phẩm. Đ37 đã hứa một cổng canh và cổng đó chưa tồn tại.
Chốt: `appendMessage()` **và** `insertAnswerTurn()` ném ngay khi `!isValidUuid(conversationId)`, ở **CẢ HAI** cài đặt — `PostgresDataStore` **và** `MockDataStore`. Lý do bất biến: kho mock chỉ có giá trị khi cái gì xanh ở mock cũng xanh ở Postgres; chính chỗ mock dễ tính hơn đã sinh ra G26.
Kèm: đổi 6 chỗ nhãn dạng chữ sang `conversationIdFromLabel(...)` — `tests/citations.test.ts:70,96` (`"cit1"`,`"cit2"`) và `tests/pipeline-order.test.ts:67,94,109,136` (`"c1"`…`"c4"`). Không phải để test qua cổng, mà vì chúng đang **mô tả sai cách gọi hợp lệ** cho agent đọc sau.
**Xong khi:** một test chứng minh tầng ghi TỪ CHỐI một `conversation_id` dạng chữ ở cả hai backend, và `node scripts/run_tests.mjs` exit 0.

**W4 — Bỏ uuid hardcode trong hai file test mới (Đ43, `R14` mục 6).** `tests/conversation-id.test.ts:27` và `tests/conflict-citations.test.ts:30` ghim `user_id: "86e44c36-…"`, trong khi `scripts/_fixtures.mjs` **của cùng bản vá** viết ngược lại rằng không được hardcode uuid snapshot (vì `002_users.sql:14` là `DEFAULT gen_random_uuid()`, id đổi sau mỗi lần seed). Đo được: đổi uuid ⇒ `fail 2` với lỗi FK khó hiểu. Dùng cách đã có sẵn: `findUserByEmail("resident@demo.local")`.

**W5 — `is_golden_run` / `golden_case_id` (Đ44, `R14` mục 7).** `lib/pipeline/index.ts:327` ghim cứng `is_golden_run: false`; đo trên DB thật: `answer_turns 239 · is_golden_run=true: 0 · golden_case_id NOT NULL: 0`. Hậu quả: panel Golden của màn `eval` **rỗng vĩnh viễn** (dù `app/(bql)/eval/page.tsx:31` nói với ban giám khảo rằng nó đọc `is_golden_run = true`), và năm panel vận hành bị **nhuộm** bởi traffic Golden/probe/test.
Chốt của Đ44: thêm vào `RunTurnArgs` hai trường **tùy chọn** `is_golden_run?: boolean` và `golden_case_id?: string | null`, mặc định `false`/`null`; `scripts/eval_golden.mjs` truyền vào (cả `judgeFaq` lẫn `judgeSafety`). **Phương án script `UPDATE` lại sau lượt chạy đã bị BÁC** — đừng đề xuất lại, lý do ở Đ44.
**Xong khi:** một test khẳng định lượt chạy có cờ ghi `is_golden_run = true` + `golden_case_id` khác `null`, và lượt không có cờ ghi `false`/`null`.

**W6 — Đổi tên `ensureConversationOwner` (Đ44, `R14` mục 5).** Hàm này dùng `ON CONFLICT (id) DO NOTHING` nên **không kiểm chủ sở hữu**; đo được: BQL tạo hội thoại → cư dân ghi vào mà không lỗi. Hôm nay KHÔNG phải lỗ HTTP (`app/api/chat/route.ts:168` chặn bằng 403 — luật 403 của BB-11 vẫn đứng), rủi ro thật là **tên gọi nói sai việc nó làm**.
Chốt: đổi tên tham số + mọi chỗ dùng thành `createConversationIfMissing`, JSDoc **nói thật một câu**: hàm này KHÔNG kiểm quyền, authz ở route. **CẤM** thêm một lượt đọc chủ sở hữu vào đường ghi nóng "cho chắc" — lỗ đã bịt ở tầng trên, cái đang hỏng là sự hiểu sai.

## 4. LUẬT
Sửa tối thiểu, đúng kiến trúc sẵn có · mọi phát biểu phải có neo · kiểm mã thoát TRỰC TIẾP (`echo $?`), CẤM kết luận qua `grep` · lỗi Tầng 1 (429/503/401/đứt mạng) vào cột **blocked**, KHÔNG tính là trượt (Đ26) · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` · comment và report tiếng Việt, tên mã tiếng Anh · thấy việc ngoài phạm vi thì GHI LẠI vào report, KHÔNG tự làm.
**Không được làm giảm số test.** Nền là 143; sau khi bạn xong phải ≥ 143 và **0 skip**.

## 5. TẦNG
🟠 toàn gói — mọi quyết định 🔴 đã chốt xong ở Đ42/Đ43/Đ44, bạn thi hành theo hợp đồng, có test tự biết đúng sai. Gặp chỗ Đ42/Đ43/Đ44 **không phủ** ⇒ DỪNG và hỏi, CẤM tự quyết thay (đặc biệt: đừng tự đổi ngưỡng 300, sàn 80, hay phương án `RunTurnArgs`).

## 6. REPORT PHẢI CÓ
`reports/R15_thi-cong_va-r14.md`. Dòng 1 = khai vai · loại (thi công) · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm, bằng lời mình). Dòng 2–4 = `Handoff:` `handoffs/H12_va-r14-snippet-uuid-golden.md` / `Base:` / `Head:`. Rồi: bảng W1–W6 (gói → làm gì → lệnh → mã thoát nguyên văn) · **bằng chứng test TỪNG ĐỎ cho W2 và W3** (bắt buộc, dán mã thoát đỏ) · tests tổng/pass/fail/skip · `git diff --stat` · bảng phân công thực tế (gói → tầng yêu cầu → họ/model đã dùng) · việc KHÔNG làm + lý do · câu hỏi cần người. Dòng cuối = `✅ DUYỆT` / `🔁 SỬA: <mục>` / `⛔ DỪNG: <vì sao>`.
Bằng chứng máy ghi vào `evidence/va-r14/*.txt` (tạo thư mục đó), report chỉ TRỎ, CẤM sửa tay file evidence.
