1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. **DỪNG Ở `--check`**, CẤM chế độ GHI. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `plan.md` §2 — **Đ40** (đặc tả của bạn, đọc nguyên văn kể cả khối VÙNG CẤM), rồi **Đ26** (luật phân lập lỗi Tầng 1 — nó là một nửa nguyên nhân của ca `S14`) và **Đ36** → `specs/TESTING-ACCEPTANCE.md` **§4.4** (bơm lỗi cho `S14`) và **dòng 268** (chốt `= 65` = *"66 case trừ `S16` không gọi `runTurn`"*) → `specs/SPEC-P03-BQL-Console.md` §3.3 (`rejectAnswer`) → `specs/SPEC-P00-Knowledge-Golden.md` §6.5 (bảng 7 checkpoint). Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base `1140708` (working tree SẠCH). Lượt `eval:golden` **đầu tiên trong đời dự án** chạy thật trên Postgres hôm nay: bộ `safety` ra `pass 11 · fail 4 · blocked 1`, exit 3, trong khi ngưỡng `M3 ≥ 15/16`.
Hai trong bốn ca không pass **không phải lỗi sản phẩm — là lỗi BỘ ĐO**, và đó là việc của bạn. Hai ca kia (`S01`, `S06`) là trượt thật, gói khác đang làm song song.
Số đo nền (đo lại, đừng tin dòng này): `npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` **152 pass / 0 fail / 0 skipped** · `check_adapter_boundary.sh` `violations: 0`.
**Hạn mức Gemini ĐÃ CẠN hôm nay** — xem mục 2.

## 2. PHẠM VI
**Được ghi:** `scripts/eval_golden.mjs` · `scripts/_batch.mjs` · `lib/eval/score.ts` (chỉ nếu bắt buộc, và phải giữ đúng 7 checkpoint `SPEC-P00` §6.5) · `tests/*.test.ts` (thêm ca mới) · `evidence/bo-do-s16-s14/**`.
**CẤM chạm:** `lib/pipeline/**` · `lib/confidence.ts` · `lib/adapters/**` (gói khác đang sửa `lib/pipeline` song song — chạm vào là gây xung đột) · `evals/golden/**` · `knowledge/**` · mọi file dưới `app/` · `planning/**` · `brain4agent/**` · `package.json` · mọi migration.
**CẤM** `git add`/`commit`/`push`/`stash`/`reset`/`checkout`. **CẤM** chạy `eval_golden.mjs` **toàn lượt** (198 lời gọi, cạn hạn mức); được chạy `--only=S14,S16` hoặc `--limit` nhỏ nếu thật cần, tối đa **6 lời gọi model** cho cả gói. **CẤM tick `G11`**.
**CẤM sửa kỳ vọng trong `evals/golden/` cho khớp đầu ra, CẤM xoá ca khỏi Golden** — vùng cấm tường minh của Đ40.

## 3. VIỆC PHẢI LÀM

**W1 — `S16` phải đi ĐÚNG đường của nó (Đ40).**
Hiện `eval_golden.mjs` đẩy `question_vi` của `S16` vào `runTurn()` và nhận về `unsupported_intent`. Nhưng `question_vi` của ca đó chỉ là **placeholder mô tả** (chính Golden ghi thế trong `note_vi`), và `reason_code = reviewer_rejected_draft` **chỉ sinh ra khi BQL bấm Từ chối** trong hàng đợi HITL (`lib/adapters/bql-store.ts` chạy `UPDATE answer_turns SET reason_code = 'reviewer_rejected_draft'`, `SPEC-P03` §3.3, mã A10 của `01-CONTRACTS` §2.3). Nó **không** là đầu ra của `runTurn()`, và `TESTING-ACCEPTANCE.md` dòng 268 đã chốt bằng số: `= 65` = *"66 case trừ `S16` không gọi `runTurn`"*.
**Hậu quả phải hiểu rõ trước khi sửa:** ca này **không đời nào pass theo cấu tạo**, nên nó ghim trần `M3` ở **15/16 vĩnh viễn** — ngưỡng nghiệm thu `M3 ≥ 15/16` chỉ còn đạt được khi 15 ca kia pass tuyệt đối, không còn một ly dung sai. Một bộ đo tự ăn mất toàn bộ dung sai của chính nó.
**Việc:** lái `S16` qua **đường `rejectAnswer` của `SPEC-P03`** (dựng một lượt nháp rồi mô phỏng BQL bấm Từ chối), hoặc — nếu đo được rằng đường đó không gọi được từ script — **tách `S16` ra khỏi mẫu số của `M3` một cách TƯỜNG MINH**, in ra rõ mẫu số thật và ghi lý do trỏ tới dòng 268. **CẤM âm thầm bỏ qua ca** để số đẹp lên: dù chọn đường nào, output phải nói thẳng `S16` được xử lý thế nào.
**Xong khi:** `node scripts/eval_golden.mjs --set=safety --only=S16 --resume` cho ra **một kết luận** (pass/fail thật, không phải `unsupported_intent` vô nghĩa), và output in rõ mẫu số của `M3`.

**W2 — `S14` phải được lái bằng cờ bơm lỗi (Đ40).**
`S14` blocked **dai dẳng**, chạy lại hai lượt riêng vẫn blocked — không phải hạn mức. Đây là ca **bơm lỗi upstream có chủ đích**: `TESTING-ACCEPTANCE` §4.4 quy định `forceUpstreamError: "429"` tại A2, kỳ vọng `system_error` sau 2 lần retry (backoff 2s→8s).
**Nghịch lý phải ghi rõ trong report:** bộ đo không có đường truyền cờ bơm lỗi, nên ca chạy như thường; và khi lỗi thật xảy ra thì `runBatch` phân lập nó thành **Tầng 1** (đúng luật Đ26) rồi không kết luận. Ca có mục đích duy nhất là kiểm xử lý lỗi thì bị chính luật phân lập lỗi loại khỏi vòng chấm.
**Việc:** truyền được cờ bơm lỗi của §4.4 cho đúng ca `S14`, và để `runBatch` **kết luận** ca này thay vì xếp nó vào `blocked`. Cẩn thận vùng cấm đã có trong `state.json`: *"không được gộp cả họ `TypeError` vào Tầng 1"* — đừng làm ngược lại bằng cách kéo mọi lỗi 429 ra khỏi Tầng 1. Chỉ **đúng ca có cờ bơm lỗi** mới được coi là lỗi ĐƯỢC MONG ĐỢI và đem kết luận; 429 thật ngoài ý muốn vẫn phải là Tầng 1.
**Xong khi:** `S14` cho ra kết luận pass/fail thật; và có test chứng minh một lỗi 429 **thật** (không có cờ) vẫn vào cột `blocked`, không bị tính là trượt. Hai chiều, cùng một lượt chạy.

**W3 — Bộ đo phải TỪNG ĐỎ.** Với mỗi test bạn thêm ở W1/W2: tự làm hỏng cài đặt trong **bản sao tạm** của bạn (KHÔNG sửa repo gốc), chạy test, **dán mã thoát đỏ nguyên văn** vào report. Repo này đã có bốn lần "test xanh mà không canh gì" (họ lỗi G12/Đ21); một assertion không bao giờ đọc được thì tệ hơn là không có.

## 4. LUẬT
Sửa tối thiểu, giữ đúng kiến trúc `_batch.mjs` sẵn có · kiểm mã thoát TRỰC TIẾP (`echo $?`), CẤM kết luận qua `grep` · giữ nguyên bảng mã thoát của `_batch.mjs` (`0` xong sạch · `1` có trượt thật · `2` sai tham số · `3` chưa kết luận được) · lỗi Tầng 1 vào cột **blocked** · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` · comment và report tiếng Việt, tên mã tiếng Anh · thấy việc ngoài phạm vi thì GHI LẠI, KHÔNG tự làm.
**Không được làm giảm số test.** Nền **152**; sau khi xong ≥ 152 và **0 skip**.

## 5. TẦNG
🟠 toàn gói — Đ40 đã chốt nguyên tắc (lái đúng đường, CẤM sửa kỳ vọng), bạn thi hành và có test tự biết đúng sai. Chỗ Đ40 **để mở** là *"lái bằng cách nào"*: nếu hai đường của W1 đều đo được là không khả thi từ script, **DỪNG và hỏi** kèm số đo, CẤM tự đổi ngưỡng `M3`.

## 6. REPORT PHẢI CÓ
`reports/R17_thi-cong_bo-do-s16-s14.md`. Dòng 1 = khai vai · loại (thi công) · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm, bằng lời mình). Dòng 2–4 = `Handoff:` `handoffs/H14_bo-do-s16-s14.md` / `Base:` / `Head:`. Rồi: bảng W1–W3 (gói → làm gì → lệnh → mã thoát nguyên văn) · **mẫu số thật của `M3` sau khi xong, nói rõ `S16` được xử lý thế nào** · **bằng chứng test TỪNG ĐỎ** · **bằng chứng 429 thật vẫn vào cột blocked** · tests tổng/pass/fail/skip · số lời gọi model đã dùng · `git diff --stat` · bảng phân công thực tế · việc KHÔNG làm + lý do · câu hỏi cần người. Dòng cuối = `✅ DUYỆT` / `🔁 SỬA: <mục>` / `⛔ DỪNG: <vì sao>`.
Bằng chứng máy vào `evidence/bo-do-s16-s14/*.txt`, report chỉ TRỎ, CẤM sửa tay file evidence.
