1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `plan.md` §2 (Đ26, Đ36, **Đ37**, **Đ38**) → `specs/01-CONTRACTS.md` §2.1 (DDL `conversations`/`messages`/`answer_turns`) + §7 (`Citation`) → `specs/SPEC-P02-Agent-Pipeline.md` §6.4 + phần cổng escalate → `specs/TESTING-ACCEPTANCE.md` (BB-04, BB-07). Không đọc gì khác trước khi ghi dòng "hiểu việc".

> **Ghi chú hồ sơ (SO, 2026-09-22):** handoff này được **dựng lại sau khi việc đã xong**. Phiên trước phóng hai gói W1/W2 song song rồi bị cắt giữa dòng trước khi kịp ghi handoff xuống đĩa; code nằm trong working tree, `evidence/uuid-conflict/` rỗng, không có report. Nội dung dưới đây là phạm vi và luật ĐÃ được giao, ghi lại đúng để hồ sơ H↔R↔evidence không khuyết một mắt. Bản thẩm định độc lập đi riêng ở `H11`/`R14`.

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`. Base: `27c38f5`. Thẩm định đối kháng cô lập (`reports/R09`) tìm ra 4 phát hiện thật; hai trong số đó là **G26** và **G28**, chưa vá. Hai gói của handoff này vá đúng hai cái đó.
- **G26/Đ37** — `conversations.id` và `answer_turns.conversation_id` là cột kiểu `uuid`. Trước gói BB-11, `runTurn()` là hàm THUẦN (không ghi DB) nên một nhãn dạng chữ như `"golden-faq-S03"` hoàn toàn vô hại — đó là lý do nó sống sót nhiều phiên. BB-11 nối đường ghi `answer_turns` vào, và mọi script đo truyền nhãn dạng chữ vỡ **ngay ở lệnh ghi đầu tiên**: `ERROR: invalid input syntax for type uuid`.
- **G28/Đ38** — `escalateResult()` trả `citations: []` ở cả ba đường escalate, trong khi `SPEC-P02` §6.4 quy định đúng câu cư dân nhìn thấy: *"đây là hai nguồn để anh/chị đối chiếu"*. Sản phẩm hứa hai nguồn rồi đưa không nguồn nào, đúng vào cảnh demo mạnh nhất (`DEF-03`).
Số đo nền tại `27c38f5` (đo lại, đừng tin dòng này): `tsc` exit 0 · `build` exit 0 · `run_tests.mjs` 134 pass / 0 fail / 0 skip.

## 2. PHẠM VI
**Được ghi:** `lib/adapters/db.ts` · `lib/pipeline/index.ts` · `scripts/{eval_golden,probe_defects,trace_sample,_fixtures}.mjs` · `tests/conversation-id.test.ts` (mới) · `tests/conflict-citations.test.ts` (mới) · `evidence/uuid-conflict/**`.
**CẤM chạm:** `lib/pipeline/eligibility.ts` (chỉ ĐỌC kết quả nó trả về, không sửa cách nó phân loại) · `lib/eval/score.ts` · mọi file dưới `app/` · mọi migration đã chạy (`migrations/00*.sql` — checksum lệch sẽ bị cảnh báo, Đ30) · mọi file trong `knowledge/` và `evals/golden/`.
**CẤM** `git add`/`commit`/`push`/`stash`/`reset`. **CẤM** chạy `scripts/eval_golden.mjs` toàn lượt (198 lời gọi, hạn mức Gemini — Đ19); SO tự chạy. **CẤM** thêm dependency mới: chỉ `node:crypto`.

## 3. VIỆC PHẢI LÀM
**W1 — Đ37, `conversation_id` phải là uuid.**
- Thêm một hàm sinh `conversation_id` **TẤT ĐỊNH** từ một nhãn người đọc được (băm nhãn → uuid hợp lệ). **CẤM `randomUUID()`**: bộ chạy Golden có `--resume` (Đ26), cùng một `case_id` phải nối lại đúng cuộc hội thoại cũ giữa hai lượt chạy cách nhau; ngẫu nhiên thì mỗi lượt đẻ một hội thoại mới và `messages` phình ra vô nghĩa.
- Mọi script đo giữ nguyên nhãn dạng chữ ở đầu vào, đổi sang truyền uuid dẫn xuất xuống tầng ghi.
- Chú ý FK: một uuid hợp lệ nhưng chưa từng có hàng `conversations` mang id đó vẫn vỡ `messages_conversation_id_fkey`. Xử lý bằng cách idempotent, và **không được đổi hành vi đường `/api/chat`** (đường đó đã gọi `createConversation()` trước).
- **Xong khi:** `node scripts/run_tests.mjs` exit 0, có bộ test khẳng định *mọi* `conversation_id` đi vào tầng ghi đều parse được thành uuid (không có cổng thì lỗi này quay lại y hệt ở script thứ tư).

**W2 — Đ38, lượt `source_conflict` phải đưa được hai nguồn.**
- Lượt escalate với gate `G1_conflict` PHẢI trả các section thuộc `conflict_group` đã phát hiện dưới dạng `citations`. **Các đường escalate khác giữ `citations: []`** — chúng không hứa nguồn nào nên không nợ gì. Đây là vùng cấm: đừng "sửa cho tốt hơn" bằng cách kèm citations cho mọi escalate.
- Không vi phạm **BB-04** (`decision='answer'` mà `citations=[]` là vi phạm; BB-04 không cấm lượt escalate KÈM nguồn).
- `snippet_vi` ≤ 300 ký tự theo `01-CONTRACTS` §7. Một `section_id` chỉ xuất hiện MỘT lần dù retrieval trả nhiều chunk cùng section.
- Tra metadata qua `DataStore` đã có sẵn trong tay, **KHÔNG mở connection mới** (BB-07: `lib/adapters/db.ts` là file DUY NHẤT mở connection).
- **Xong khi:** `bash scripts/check_adapter_boundary.sh` in `violations: 0`, và có bộ test chứng minh nhánh `G1_conflict` trả ≥2 citation trong khi nhánh `G2_zero_eligible` vẫn trả 0.

## 4. LUẬT
Sửa tối thiểu, đúng kiến trúc · mọi phát biểu phải có neo · kiểm mã thoát TRỰC TIẾP (`echo $?`), CẤM kết luận qua `grep` · lỗi Tầng 1 (429/503/401/đứt mạng) vào cột **blocked**, KHÔNG tính là trượt (Đ26) · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` · report tiếng Việt, tên mã/commit tiếng Anh · thấy việc ngoài phạm vi thì GHI LẠI vào report, không tự làm.

## 5. TẦNG
🔴 cho W2 (đổi hợp đồng dữ liệu của lượt escalate, chạm câu chữ sản phẩm ở `SPEC-P02` §6.4). 🔴 cho phần hợp đồng `DataStore.appendMessage` của W1; 🟠 cho phần còn lại của W1 (đổi 4 script đo theo mẫu có sẵn).

## 6. REPORT PHẢI CÓ
`reports/R13_thi-cong_uuid-conflict.md`. Dòng 1 = khai vai · loại · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm, bằng lời mình). Dòng 2–4 = `Handoff:` / `Base:` / `Head:`. Rồi: lệnh + mã thoát nguyên văn của mọi cổng · tests tổng/pass/fail/skip · `git diff --stat` · bảng phân công thực tế (gói → tầng yêu cầu → họ/model đã dùng) · việc KHÔNG làm + lý do · câu hỏi cần người. Dòng cuối = phán quyết `✅ DUYỆT` / `🔁 SỬA: <mục>` / `⛔ DỪNG: <vì sao>`. Bằng chứng máy vào `evidence/uuid-conflict/*.txt`, report chỉ TRỎ, CẤM sửa tay file evidence.
