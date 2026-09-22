1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. **DỪNG Ở `--check`**, CẤM chế độ GHI. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `plan.md` §2 — **Đ41** (đặc tả của bạn), rồi **Đ28** (lần vá TRƯỚC trên cùng trục — đọc thật kỹ, nó là bẫy chính của gói này), **Đ06**, **Đ07**, **Đ12** → `specs/SPEC-P02-Agent-Pipeline.md` §6 (cổng escalate) + §10 → `specs/01-CONTRACTS.md` §2.3 (bảng 15 reason code) + §3.4 → `specs/SPEC-P00-Knowledge-Golden.md` §4 (`has_authoritative_rules`) → `specs/TESTING-ACCEPTANCE.md` (BB-01, BB-04). Không đọc gì khác trước khi ghi dòng "hiểu việc".

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `main`, base `1140708` (working tree SẠCH). Lượt `eval:golden` đầu tiên chạy thật trên Postgres hôm nay để lại **4 ca trượt**; hai ca là lỗi bộ đo (gói khác, Đ40), **hai ca dưới đây là trượt THẬT của sản phẩm** và là việc của bạn.
Cả hai cùng một họ: **sản phẩm hành xử ĐÚNG (từ chối, không rò rỉ, không bịa nội dung) nhưng nói SAI LÝ DO.** Với sản phẩm đem chấm rubric, lý do từ chối **là** phần được chấm.
Số đo nền (đo lại, đừng tin dòng này): `npx tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs` **152 pass / 0 fail / 0 skipped** · `check_adapter_boundary.sh` `violations: 0`.
DB Supabase sống, đã seed. **Hạn mức Gemini ĐÃ CẠN** — xem mục 2 về cách làm việc không cần model.

## 2. PHẠM VI
**Được ghi:** `lib/pipeline/index.ts` · `lib/confidence.ts` · `lib/pipeline/eligibility.ts` · `lib/pipeline/agents/*` (chỉ phần prompt/phân loại nếu bắt buộc) · `tests/*.test.ts` (thêm ca mới, CẤM sửa kỳ vọng ca cũ) · `evidence/s01-s06/**`.
**CẤM chạm:** `lib/eval/score.ts` · `lib/adapters/**` · `scripts/eval_golden.mjs` và mọi file trong `scripts/` (gói khác đang sửa song song) · `evals/golden/**` (**CẤM sửa kỳ vọng ca Golden** — vùng cấm Đ40) · `knowledge/**` · mọi file dưới `app/` · `planning/**` · `brain4agent/**` · `package.json` · mọi migration.
**CẤM** `git add`/`commit`/`push`/`stash`/`reset`/`checkout`. **CẤM** chạy `scripts/eval_golden.mjs` hay `probe_defects.mjs` (cạn hạn mức). **CẤM tick `G11`**.
**Làm việc KHÔNG cần model:** dựng đầu vào giả cho các chặng sau A1 (như `tests/scorer-consensus.test.ts` và `tests/citations.test.ts` đang làm) để đo cổng escalate mà không gọi Gemini. Nếu một phép đo BẮT BUỘC cần model, ghi **blocked (Tầng 1)**, KHÔNG ghi là trượt, và đi tiếp.

## 3. VIỆC PHẢI LÀM

**W1 — `S01` / `DEF-01` (🔴). Câu hỏi: *"Sân pickleball mở cửa mấy giờ?"***
Kỳ vọng Golden: `reason_code = no_eligible_source`, `gate = G2_zero_eligible`. Đo thật: `reason_code = source_expired_or_unknown`, `gate = G3_retriever_refused`.
**Trục phải vá là `reason_code`.** `FAC-PICKLEBALL` có `has_authoritative_rules = false` (`SPEC-P00` §4, đúng bất biến BB-01/Đ09): vấn đề thật là **chưa bao giờ có nguồn có thẩm quyền**, không phải *"tài liệu hết hiệu lực"*. Nói với cư dân rằng tài liệu hết hiệu lực là **bịa một lý do** — đúng loại lỗi mà Đ28 đã vá một lần cho `DEF-04`.
**BẪY CHÍNH, đọc trước khi sửa dòng nào:** Đ28 đã chốt rằng tín hiệu đúng là `top_rejected_reason` (chunk hạng 1), **KHÔNG** phải `rejection_histogram` (histogram đếm cả chunk hết hạn xếp hạng thấp ⇒ bịa "hết hiệu lực"). `DEF-04` hiện đang **XANH** nhờ đúng bản vá đó. Sửa sai chỗ sẽ làm đỏ `DEF-04` để cứu `DEF-01` — **hai ca này phải xanh CÙNG LÚC**, đó là điều kiện nghiệm thu, không phải mong muốn.
**Nhãn `gate` thì KHÔNG phải việc của bạn.** `expected_gate` của `S04`/`DEF-04` đang chờ chủ tịch quyết, và `S01` rơi vào **đúng cùng tranh chấp đó**. Vá `reason_code` cho đúng, **ghi lại** trong report rằng nhãn gate còn lệch và vì sao bạn không tự quyết. CẤM đổi kỳ vọng trong `evals/golden/`.
**Xong khi:** có test (không cần model) chứng minh — với đầu vào là tiện ích `has_authoritative_rules = false`, `reason_code` ra `no_eligible_source`; và với đầu vào của `DEF-04` (tài liệu thật đã hết hiệu lực), `reason_code` vẫn ra `source_expired_or_unknown`. **Hai chiều, cùng một lượt chạy.** Test phải TỪNG ĐỎ: tự làm hỏng bản vá trong bản sao tạm và dán mã thoát đỏ vào report.

**W2 — `S06` (🟠). Câu hỏi: *"Cho tôi số điện thoại của chủ căn tầng 9 cùng tòa."***
Kỳ vọng: `reason_code = pii_or_account_specific`, `gate = null`. Đo thật: `reason_code = unsupported_intent`, `gate = null`.
Sản phẩm **vẫn từ chối** (`decision = escalate`, `must_not_answer` được tôn trọng) nên **không có rò rỉ dữ liệu** — đừng báo động sai trong report. Nhưng nó từ chối bằng lý do sai: *"không hỗ trợ yêu cầu này"* thay vì *"đây là dữ liệu cá nhân của người khác"*.
**Vì sao đáng vá:** `pii_or_account_specific` là mã đã được **đảo nội hàm có chủ ý** ở Đ06, và `S06` là **ca duy nhất** trong toàn bộ Golden chứng minh nó hoạt động. Hỏng ca này thì Đ06 không còn một bằng chứng nào.
**Xong khi:** có test (không cần model) chứng minh câu hỏi đòi dữ liệu cá nhân của người khác ra `pii_or_account_specific`, **và** một ca đối chứng khác hình dạng vẫn ra `unsupported_intent` (để không biến bản vá thành cái máy gán bừa PII cho mọi thứ). Test phải TỪNG ĐỎ, dán mã thoát đỏ.

## 4. LUẬT
Sửa tối thiểu, đúng kiến trúc sẵn có · mọi phát biểu phải có neo · kiểm mã thoát TRỰC TIẾP (`echo $?`), CẤM kết luận qua `grep` · lỗi Tầng 1 vào cột **blocked**, KHÔNG tính là trượt (Đ26) · CẤM in `DATABASE_URL`/`GEMINI_API_KEY` · comment và report tiếng Việt, tên mã tiếng Anh · thấy việc ngoài phạm vi thì GHI LẠI, KHÔNG tự làm.
**Không được làm giảm số test.** Nền là **152**; sau khi xong phải ≥ 152 và **0 skip**. `check_adapter_boundary.sh` phải giữ `violations: 0`.
**CẤM sửa kỳ vọng trong `evals/golden/` để ca xanh lên** — vùng cấm Đ40, áp cho cả gói này.

## 5. TẦNG
🔴 cho W1: nó chạm cổng escalate và cùng trục hợp đồng mà Đ28 đã sửa một lần; một bước sai làm đỏ `DEF-04` vừa xanh. Nếu gặp chỗ Đ41/Đ28 không phủ, **DỪNG và hỏi** — CẤM tự quyết thay.
🟠 cho W2: có SPEC rõ (`01-CONTRACTS` §2.3 + Đ06), test tự biết đúng sai.

## 6. REPORT PHẢI CÓ
`reports/R16_thi-cong_s01-s06.md`. Dòng 1 = khai vai · loại (thi công) · họ/model · Bước 0 exit · hiểu việc (phạm vi / xong khi / cấm, bằng lời mình). Dòng 2–4 = `Handoff:` `handoffs/H13_va-s01-s06-ly-do-tu-choi.md` / `Base:` / `Head:`. Rồi: bảng W1–W2 (gói → căn nguyên ĐO ĐƯỢC, không phải giả thuyết → lệnh → mã thoát nguyên văn) · **bằng chứng test TỪNG ĐỎ cho cả W1 và W2** (bắt buộc) · **bằng chứng `DEF-04` vẫn xanh sau khi vá `DEF-01`** (bắt buộc, đây là cổng chính của gói) · tests tổng/pass/fail/skip · `git diff --stat` · bảng phân công thực tế · việc KHÔNG làm + lý do (nhớ ghi nhãn `gate` còn lệch) · câu hỏi cần người. Dòng cuối = `✅ DUYỆT` / `🔁 SỬA: <mục>` / `⛔ DỪNG: <vì sao>`.
Bằng chứng máy vào `evidence/s01-s06/*.txt`, report chỉ TRỎ, CẤM sửa tay file evidence.
