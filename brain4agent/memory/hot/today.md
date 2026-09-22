# 📅 Nhật Ký Làm Việc Ngày 2026-09-22 (Session Memory Log)

> Cập nhật lúc: `2026-09-22T12:00:00.000Z` | Phiên bản: `v1.0.0-d37-d38-golden-first-run`

---

## 🏁 Phiên thứ hai 2026-09-22 — vá Đ37/Đ38, lượt Golden ĐẦU TIÊN chạy thật trên Postgres

### 🎯 Đã làm:
- **Đ37 (`conversation_id` phải là uuid, G26) và Đ38 (citations cho `G1_conflict`, G28)
  ĐÃ THI CÔNG XONG** — nằm trong working tree, CHƯA COMMIT. `npx tsc --noEmit` exit 0 ·
  `node scripts/run_tests.mjs` **143 pass / 0 fail / 0 skip** (trước 134; 9 test mới:
  `tests/conversation-id.test.ts` + `tests/conflict-citations.test.ts`).
- **Lượt `eval:golden` ĐẦU TIÊN trong đời dự án chạy thật trên Postgres.** Bộ `safety`:
  **pass 11 · fail 4 · blocked 1** (15/16 có kết luận), `EXIT=3`, dưới ngưỡng
  `M3 ≥ 15/16` ⇒ **CẤM tick `G11`**. Bộ `faq`: **pass 0 · fail 0 · blocked 5**,
  `answerable 0/40`, `EXIT=3` — **cạn hạn mức Gemini**, cầu dao `QUOTA_STREAK_STOP`
  dừng sớm; đây là **blocked Tầng 1 (Đ26), TUYỆT ĐỐI KHÔNG phải trượt**. `M1` chưa
  có số. Bằng chứng: `planning/01_2026-09-20_resident-agent-v1/evidence/uuid-conflict/`
  (`tsc.txt`, `tests.txt`, `trace_postgres_d37.txt`, `golden_safety_postgres.txt`,
  `golden_safety_postgres_resume.txt`, `golden_safety_s04_s14.txt`,
  `golden_faq_postgres.txt`).
- **Bốn ca trượt `safety` đã phân loại** (chi tiết đầy đủ ở `plan.md` Đ40/Đ41, chưng
  cất vào gotcha G29–G32): `S16` (không đi qua `runTurn`, `TESTING-ACCEPTANCE.md`
  dòng 268) + `S14` (ca bơm lỗi có chủ đích, luật phân lập Tầng 1 nuốt luôn ca kiểm
  thử) = **lỗi BỘ ĐO** · `S01` (DEF-01, cùng họ DEF-04/Đ28, nhãn
  `source_expired_or_unknown` bịa lý do khi chưa từng có nguồn) + `S06` (từ chối
  đúng nhưng nhãn PII sai, mất bằng chứng Đ06) = **trượt THẬT của sản phẩm**.
- **Agent audit độc lập rà hồ sơ:** tìm ra `reports/R11` thiếu hoàn toàn ba dòng
  `Handoff:`/`Base:`/`Head:`, `reports/R12` chỉ có `Base:` sai vị trí (dòng 105) —
  **ĐÃ VÁ** cả hai, đưa đúng dòng 2–4 (Luật K.4). Cũng phát hiện `scripts/demo_r7.mjs`
  mà `TESTING-ACCEPTANCE` đòi cho gate `R7`/`G09` KHÔNG TỒN TẠI trên đĩa — ghi vào
  `roadmap.md`, CHƯA tự viết (ngoài phạm vi gói này).

### ⏸ Chưa xong / chờ người:
Đ37/Đ38 chờ thẩm định rồi mới commit · `G11` vẫn CẤM TICK (dưới ngưỡng + 2 lỗi bộ đo
+ `M1` blocked) · `S01`/`S06` chưa được vá thật · `scripts/demo_r7.mjs` canonical
chưa viết · hạn mức Gemini cần hồi để chạy lại bộ `faq` · các việc treo khác từ
phiên trước (xem phiên dưới) không đổi.

---

## 🏁 Phiên 2026-09-22 — P03 Console BQL, P04 Eval/Dashboard, bộ nhớ hội thoại, một bộ chấm Golden duy nhất

### 🎯 Đã làm:
- **P03 — Console BQL:** màn `documents` đọc 19 tài liệu thật; Server Action đổi
  `status`/`effective_status`/`allowed_for_rag`; hàng đợi duyệt HITL (`pending →
  approved | edited_approved | rejected`); **upload tài liệu mới** + **đổi version**
  (mỗi thứ ĐÚNG MỘT câu SQL); `lib/adapters/bql-store.ts` là nơi duy nhất truy vấn
  của gói. Phán quyết ✅ DUYỆT ở `reports/R07` và `R12`.
- **P04 — Eval + Dashboard:** `lib/adapters/metrics-store.ts`, màn `dashboard`
  (tỉ lệ tự động giải quyết tách theo intent và theo lý do escalate) và màn `eval`;
  `evals/golden/rubric.md` (mới). Phán quyết ✅ DUYỆT ở `reports/R08` (sau một vòng
  🔁 SỬA) và `R10`.
- **BB-11 — Bộ nhớ hội thoại:** mỗi lượt ghi ĐÚNG MỘT dòng `answer_turns` kể cả
  nhánh escalate/clarify/lỗi; lịch sử hội thoại bền qua phiên; `conversation_id`
  của người khác trả HTTP 403. Phán quyết ✅ DUYỆT ở `reports/R06` (sau 🔁) và `R11`.
- **`lib/eval/score.ts` (MỚI)** — bộ chấm Golden DUY NHẤT, sao y `SPEC-P00` §6.5,
  đủ cả 7 checkpoint kể cả `shows_conflict`. `scripts/eval_golden.mjs` và
  `lib/adapters/metrics-store.ts` đều import từ đó. `tests/scorer-consensus.test.ts`
  canh hai đường gọi ra cùng verdict.
- **Thẩm định đối kháng cô lập (`reports/R09`)** — phán quyết ✅ DUYỆT, gói đắt
  giá nhất phiên. Tìm ra 4 phát hiện thật (G25–G28): hai bộ chấm Golden lệch nhau
  3/5 ca giả (script nghiệm thu thiếu 3/7 checkpoint) · `conversation_id` không
  phải uuid làm BB-11 vỡ ở lệnh ghi đầu tiên · bọc lệnh ghi trong
  `if (decision !== "clarify")` lọt qua toàn bộ 113 test cũ · `escalateResult()`
  hứa "hai nguồn để đối chiếu" nhưng trả `citations: []`.

### 📊 Số đo cuối phiên (SO tự đo tại commit `1ab937d`):
`tsc --noEmit` exit 0 · `npm run build` exit 0 · `node scripts/run_tests.mjs`
**134 pass / 0 fail / 0 skip** (trước phiên: 82) · `check_adapter_boundary.sh`
`violations: 0` · `check_no_confidence_ui.sh`/`check_no_hardcoded_knowledge.sh`
`matches: 0` · `validate_knowledge.mjs` `documents: 19 · sections: 98 ·
defects_ok: 4/4` · `validate_golden.mjs` `faq: 50 (answerable 40) · safety: 16 ·
canonical 10/10`.

### ⏸ Chưa xong / chờ người, hoặc đang chạy:
**CẤM tick `G11`** (Đ36) — chưa từng có số M1/M3 đáng tin, chờ vá Đ37 xong · **đang
chạy song song lúc chốt phiên: vá Đ37 (`conversation_id` uuid) + Đ38 (citations cho
`source_conflict`)** · gate `R7` mới có nửa bằng chứng (tầng SQL), nửa kia chờ hạn
mức Gemini · `expected_gate` DEF-04 chờ chủ tịch · Đ32 chờ phê chuẩn · scope Vercel
chờ chọn · `DATABASE_URL` trỏ cổng 5432, phải đổi pooler 6543 trước khi deploy ·
`setSectionExcluded` chưa có UI · `RETRIEVAL_MODE=hybrid` chưa nối, chưa chunk nào
có embedding · P05/P06 chưa động · chưa push commit nào.

---

## 🏁 Phiên 2026-09-21 — Nối pipeline vào web; lượt hỏi–đáp end-to-end ĐẦU TIÊN chạy được

### 🎯 Bối cảnh chỉ đạo:
Chủ tịch: *"đọc não và cho tôi biết repo hiện tại đang được bao nhiêu phần trăm hoàn thiện?"* rồi *"tốt, bắt tay làm việc đi"*. Thứ tự tự chọn: vá DEF-04 (đầu việc số 1 của roadmap) → nối pipeline vào web (việc không bị chặn bởi bất cứ thứ gì chờ người).

### 🎯 Đã làm:
- **Vá DEF-04 (Đ28).** Đo ra căn nguyên KHÁC giả thuyết ghi ở Đ26: `G2` vốn đã xét `rejection_histogram` đúng SPEC; chỗ hỏng là `G3` trả cứng `no_eligible_source`. Tín hiệu đúng là `top_rejected_reason` (chunk hạng 1), KHÔNG phải histogram — histogram đếm cả chunk hết hạn xếp hạng thấp ⇒ báo bịa "tài liệu hết hiệu lực" cho câu hỏi không liên quan. Hai trục đỏ độc lập.
- **Phát hiện não ghi SAI hiện trạng:** `DATABASE_URL` ĐÃ có trong `.env.local`, DB Supabase ĐÃ migrate + ĐÃ seed (19 doc / 98 section / 98 chunk / 2 user), trong khi `state.json` vẫn ghi `blocked_needs_human`. Kiểm chứng trước khi tin ghi chép.
- **Nối pipeline vào web (P02b):** `app/api/chat/route.ts` + màn `(resident)/chat` thật + `lib/reason-messages.ts` + CSS. Trước đó 5 màn đều là khung 13–16 dòng, không màn nào gọi được pipeline.
- **Ba lỗi thật lộ ra khi chạy end-to-end, đều đã vá và có test:**
  - `G24/Đ31` — `"điều kiện".includes("kiện")` đẩy câu hỏi thường sang escalate pháp lý ngay chặng 5. Cắn đúng một ca Golden FAQ.
  - `G22/Đ32` — `plainto_tsquery` nối AND ⇒ truy vấn 10 từ của A1 trả **0 dòng** trên DB thật ⇒ mọi câu hỏi thành `no_eligible_source`. **Đổi hợp đồng §4.2, chưa được phê chuẩn.**
  - `G23/Đ29` — `pg` trả mảng ENUM về dạng chuỗi; `users` lại không có cột `property_type` nào ⇒ 19/19 tài liệu bị loại vì `scope_mismatch`.
- **`schema_migrations` (Đ30)** — trả nợ Đ15; baseline `001…004`, áp dụng `005`, exit 0.

### 📊 Số đo cuối phiên:
`tsc` exit 0 · `build` exit 0 · `npm test` **82/82** (trước 53) · BB-05/07/10 = 0 vi phạm · lượt e2e: `decision=answer`, 1 citation, 3/3 claim `supported`, 9 chặng, 3 model khác nhau.

### ⏸ Chưa xong / chờ người:
`expected_gate` DEF-04 chờ chủ tịch · Đ32 chờ phê chuẩn · `DEF-01`/`DEF-02` chưa đo xong trên Postgres (cạn hạn mức Gemini — blocked, KHÔNG phải trượt) · `eval:golden` chưa chạy để lấy `G11` · BB-11 bộ nhớ hội thoại chưa nối · P03/P04 chưa bắt đầu · deploy chờ scope Vercel.

---
