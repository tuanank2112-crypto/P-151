1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THẨM ĐỊNH**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. **DỪNG Ở `--check`** — ghi mã thoát vào report rồi đi tiếp. CẤM chạy chế độ GHI. Mã 2 ⇒ dừng, báo.
3. Đọc theo thứ tự: `brain4agent/memory-distill.txt` → `plan.md` §2 (ĐÚNG ba mục **Đ36**, **Đ37**, **Đ38**) → `specs/01-CONTRACTS.md` §7 (`Citation`) + DDL `conversations`/`messages`/`answer_turns` → `specs/SPEC-P02-Agent-Pipeline.md` §6.4 + cổng escalate → `specs/TESTING-ACCEPTANCE.md` (BB-04, BB-05, BB-07, BB-10). Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH
Repo `D:\build phase`. Base `27c38f5`, thay đổi **chưa commit** trong working tree: hai bản vá Đ37 (`conversation_id` phải là uuid) và Đ38 (lượt `G1_conflict` phải kèm citations). Chi tiết phạm vi thi công: `handoffs/H10_uuid-conflict-d37-d38.md`.
**KHÔNG được cấp report của worker thi công.** Nhiệm vụ của bạn là **làm đỏ**, không phải xác nhận lời kể của ai. Đây là cổng 🔴 vì đổi hợp đồng `DataStore.appendMessage` và đổi hợp đồng dữ liệu của lượt escalate.
Số đo nền do SO tự đo tại working tree này (đo lại, đừng tin dòng này): `npx tsc --noEmit` exit 0 · `node scripts/run_tests.mjs` tests 143 / pass 143 / fail 0 / skipped 0 (base `27c38f5` là 134).

## 2. PHẠM VI
**CHỈ ĐỌC + chạy lệnh đo.** CẤM sửa bất kỳ file nào trong repo, kể cả test, kể cả tài liệu. Muốn làm hỏng để thử thì làm trong thư mục tạm của bạn. CẤM `git add`/`commit`/`push`/`stash`/`checkout`/`reset`.
CẤM chạy `scripts/eval_golden.mjs` toàn lượt (hạn mức Gemini — Đ19). Phép đo cần DB/LLM thật mà không có ⇒ ghi **blocked (Tầng 1)**, KHÔNG ghi là trượt.

## 3. VIỆC PHẢI LÀM — tự thiết kế TỐI THIỂU 3 CÁCH PHÁ, mỗi cách một phép đo
Các trục nghi vấn dưới đây là gợi ý về HÌNH DẠNG, không phải danh sách đủ; tự tìm thêm.
1. Hàm băm nhãn → uuid: có thật **tất định**, có thật là uuid Postgres chấp nhận (`::uuid`)? Ca biên: nhãn rỗng, unicode, nhãn rất dài, hai nhãn khác nhau va nhau?
2. **Bộ test MỚI có thật từng ĐỎ?** Cố tình làm hỏng cài đặt (trong bản sao tạm của bạn) để chứng minh test bắt được. Test không bao giờ đỏ được là test vô giá trị — đúng họ lỗi G12/Đ21 của repo này.
3. Còn đường gọi nào truyền nhãn dạng chữ vào `conversation_id` mà **chưa** được vá? Grep toàn repo, đừng tin danh sách file trong handoff thi công.
4. Đ38: có đúng **CHỈ** gate `G1_conflict` kèm citations? Có nhánh escalate nào vô tình nhận, hoặc nhánh conflict nào KHÔNG nhận? Hàm dựng citations có thể trả mảng rỗng trong đúng ca `DEF-03` không — tức lời hứa §6.4 vẫn suông?
5. Vi phạm **BB-04** (`answer` mà `citations=[]`) hay **BB-07** (chỉ `lib/adapters/db.ts` mở connection) khi thêm câu SQL upsert?
6. `snippet_vi ≤ 300` (`01-CONTRACTS` §7): có ca nào ra > 300, hoặc ra chuỗi rỗng/vô nghĩa?
7. Upsert hàng `conversations`: có lỗ hổng quyền — một người dùng chiếm được `conversation_id` của người khác? Đối chiếu luật "conversation_id của người khác trả HTTP 403" đã có ở gói BB-11.

## 4. LUẬT
Phán bằng số đo, không bằng cảm giác · kiểm mã thoát TRỰC TIẾP (`echo $?`), CẤM kết luận qua `grep` · lỗi Tầng 1 (429/503/401/đứt mạng) vào cột **blocked** · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` · report tiếng Việt, tên mã tiếng Anh · thấy việc ngoài phạm vi thì GHI LẠI, không tự làm.

## 5. TẦNG
🔴 toàn gói (đổi hợp đồng dữ liệu + chạm câu chữ sản phẩm). Khác họ model với worker thi công khi có thể.

## 6. REPORT PHẢI CÓ
`reports/R14_tham-dinh_d37-d38.md`. Dòng 1 = khai vai · loại (thẩm định) · họ/model · Bước 0 exit · hiểu việc bằng lời mình. Dòng 2–4 = `Handoff:` / `Base:` / `Head:`. Rồi: **bảng các cách phá đã thiết kế** (cách phá → lệnh → mã thoát nguyên văn → ĐỎ THẬT / xanh / blocked Tầng 1) · lệnh + mã thoát mọi cổng · `git diff --stat` · bảng phân công thực tế · việc KHÔNG làm + lý do · câu hỏi cần người. Dòng cuối = `✅ DUYỆT` / `🔁 SỬA: <mục>` / `⛔ DỪNG: <vì sao>`.
