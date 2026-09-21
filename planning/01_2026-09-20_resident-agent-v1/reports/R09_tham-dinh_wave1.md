# R09 — Thẩm định Wave 1 (BB-11, P03, P04)

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H09_tham-dinh-wave1.md`
Base: `7956ccc` · Head: `31338ed`

Dòng 1: Vai THẨM ĐỊNH ĐỘC LẬP (đối kháng, chỉ đọc + đo) · loại: THẨM ĐỊNH · họ/model: Claude Sonnet 5 (claude-sonnet-5) · Bước 0 (`init_brain.js --check`) exit **0** ("NÃO ĐÃ OK") · Hiểu việc bằng lời mình: kiểm chứng độc lập bốn commit `c27015f/345b647/ed326c4/31338ed` có thật như checklist khai không, bằng cách tự chạy lại 8 cổng đo, tự đối chiếu `git diff --stat` với 3 vùng phạm vi đã khai, tự thiết kế từ 3 phép phá khác hình dạng cho bất biến P02-C10, tự dựng đầu vào giả (không gọi model) để so hai cài đặt chấm Golden, tự phá 3 hàm thuần mà bql-authz/bql-review/metrics test được cho là canh, và soi `evals/golden/rubric.md` so với đặc tả gốc. Không mở `reports/R06`, `R07`, `R08` ở bất kỳ bước nào.

---

## A — Tám cổng đo, chạy lại nguyên văn

| # | Lệnh | Exit code | Ghi chú |
| :-- | :-- | :-- | :-- |
| 1 | `npx tsc --noEmit` | 0 | |
| 2 | `npm run build` | 0 | 8 route dynamic + 1 static, không cần DATABASE_URL để build |
| 3 | `node scripts/run_tests.mjs` | 0 | tests 113 / pass 113 / fail 0 / skipped 0 |
| 4 | `bash scripts/check_adapter_boundary.sh` | 0 | violations: 0 |
| 5 | `bash scripts/check_no_confidence_ui.sh` | 0 | matches: 0 |
| 6 | `bash scripts/check_no_hardcoded_knowledge.sh` | 0 | matches: 0 |
| 7 | `node scripts/validate_knowledge.mjs` | 0 | documents: 19, sections: 98, defects_ok: 4/4 |
| 8 | `node scripts/validate_golden.mjs` | 0 | faq: 50 (answerable 40), safety: 16, canonical_codes_covered: 10/10 |

Khớp nguyên văn với số nền SO tự khai ở bối cảnh handoff. Bằng chứng đầy đủ:
`evidence/tham-dinh-wave1/muc-a_gates.txt`.

Mục A: KHỚP.

---

## B — git diff --stat 7956ccc..31338ed đối chiếu 3 vùng phạm vi

39 file thay đổi. Đối chiếu từng file với BB-11 / P03 / P04 đã khai ở handoff mục 3.B —
36/39 file khớp đúng một trong ba vùng (hoặc là evidence/, reports/, plan.md
thuộc về chính đợt làm việc, chấp nhận được).

**1 file rơi NGOÀI CẢ BA vùng đã khai:** `app/globals.css` (+158 dòng), sửa bởi
commit `ed326c4` (khai là feat(p04)). Phạm vi P04 đã khai chỉ gồm
`app/(bql)/{eval,dashboard}/** + lib/adapters/metrics-store.ts + evals/golden/rubric.md + tests/metrics.test.ts`
— `app/globals.css` là file dùng chung toàn app, không nằm trong bất kỳ vùng nào.

Soi kỹ hơn: khối CSS thêm vào có hai comment phân đoạn —
`/* -- P03 . Console BQL (documents + review) -- */` (dòng 28) và
`/* -- P04 . Eval & Dashboard -- */` (dòng 103). Nghĩa là style cho các
class mà DocumentsTable.tsx/ReviewQueueList.tsx (P03, đã merge ở commit
345b647 — TRƯỚC ed326c4) tham chiếu (bql-console, bql-table,
bql-row--warn, bql-cell-error...) chỉ được thêm vào ở commit P04,
không phải ở chính commit P03. `git log -- app/globals.css` xác nhận
CHỈ ed326c4 từng chạm file này trong khoảng 7956ccc..31338ed. Tức là
giữa hai commit 345b647 và ed326c4, các trang tài liệu/duyệt của P03
đã ở trạng thái không có CSS cho các class chúng dùng (unstyled) — một
khoảng hở phạm vi thật, không phải suy đoán. Bằng chứng:
`evidence/tham-dinh-wave1/muc-b_diff_scope.txt`.

Mục B: LỆCH một điểm — app/globals.css ngoài phạm vi khai của P04, và
nó lộ ra P03 từng thiếu CSS trong khoảng giữa hai commit.

---

## C — từ 3 phép phá khác hình dạng cho P02-C10 (BB-11)

Phá trực tiếp `lib/pipeline/index.ts` (backup .bak_audit, khôi phục + xác
nhận git diff --stat rỗng sau mỗi lần — xem log evidence).

| # | Hình dạng phép phá | Chạy | Kết quả |
| :-- | :-- | :-- | :-- |
| A | Bọc insertAnswerTurn trong `if (decision !== "escalate")` — nhánh escalate không được ghi | `node scripts/run_tests.mjs memory` | ĐỎ — cả 2 test của memory.test.ts fail (0 !== 1) |
| B | Thêm lời gọi insertAnswerTurn THỨ HAI khi `decision === "escalate"` — ghi hai lần | `node scripts/run_tests.mjs memory` | ĐỎ — cả 2 test fail (2 !== 1) |
| C | Bọc insertAnswerTurn trong `if (decision !== "clarify")` — nhánh clarify (khác hình dạng: A1 trả missing_required_fields, không phải escalate) không được ghi | `node scripts/run_tests.mjs` (toàn bộ 113 test) | LỌT QUA — 113 pass / 0 fail, không một test nào phát hiện |

Phát hiện có giá trị (phép C): không có bất kỳ test nào trong toàn bộ
tests/ tạo một lượt với decision = "clarify" rồi đếm hàng answer_turns
trên Postgres thật. `grep -rn "clarify" tests/*.test.ts` chỉ trúng các chỗ
đặt clarify_question_vi: null làm fixture boilerplate, không có assertion
đếm dòng nào cho nhánh này. Nếu một refactor tương lai vô tình làm nhánh
clarify không ghi answer_turns, toàn bộ 113 test hiện tại vẫn xanh. Đây là
lỗ hổng thật trong độ phủ của bất biến BB-11/P02-C10, dù mã hiện tại
(chưa phá) là ĐÚNG cho nhánh này (đã xác nhận bằng đọc code
lib/pipeline/index.ts dòng 210-262: finally bọc toàn bộ, không loại trừ
clarify).

Sau mỗi phép phá, khôi phục nguyên văn bằng bản .bak_audit, xoá backup, xác
nhận git diff --stat lib/pipeline/index.ts rỗng và chạy lại toàn bộ suite
về 113 pass / 0 fail. Log đầy đủ: evidence/tham-dinh-wave1/muc-c-e_mutation_summary.txt.

Mục C: KHỚP một phần — bất biến ĐANG đứng vững trên mã thật, nhưng độ phủ
test có lỗ hổng thật ở nhánh clarify (chưa bị khai thác, nhưng không bị
canh).

---

## D — Hai bộ chấm Golden có lệch nhau không? (phần quan trọng nhất)

KHÔNG chạy eval_golden.mjs/probe_defects.mjs, KHÔNG gọi Gemini (0/3 lượt
dùng). Dựng 5 ca đầu vào GIẢ (turn/case tự bịa, không qua pipeline thật),
gọi trực tiếp:

- judgeFaqCase / judgeSafetyCase — import THẬT từ lib/adapters/metrics-store.ts
  (không sửa file, gọi hàm export sẵn).
- evalGoldenJudgeFaq / evalGoldenJudgeSafety — SAO Y NGUYÊN VĂN phần logic
  chấm của scripts/eval_golden.mjs dòng 61-147 (hàm judgeFaq/judgeSafety
  không export và gọi thẳng runTurn() nên không import được để cô lập; đã
  chép lại đúng từng dòng, không thêm/bớt logic — script sao chép nằm cạnh
  kết quả ở evidence/tham-dinh-wave1/muc-d_scorer_probe.mjs để đối chiếu
  với bản gốc).

Kết quả — 3/5 ca LỆCH:

| Ca | eval_golden.mjs | metrics-store.ts | Khớp/Lệch | Nguyên nhân |
| :-- | :-- | :-- | :-- | :-- |
| 1 sai detected_intent, còn lại đúng | PASS | FAIL | LỆCH | eval_golden.mjs KHÔNG kiểm detected_intent khi expected_decision===answer; metrics-store.ts có checkpoint_intent |
| 2 có 1 claim unsupported, còn lại đúng | PASS | FAIL | LỆCH | eval_golden.mjs KHÔNG đọc claims verdict; metrics-store.ts có checkpoint_no_unsupported |
| 3 escalation đúng reason_code, kind khác answerable | PASS | PASS | Khớp | cả hai đều bỏ qua intent khi kind không phải answerable |
| 4 câu trả lời MẤT DẤU so với must_contain_vi có dấu | FAIL | PASS | LỆCH | eval_golden.mjs containsAll chỉ toLowerCase, KHÔNG bỏ dấu; metrics-store.ts containsAllVi có viNormalize (NFD strip) đúng yêu cầu SPEC-P00 6.5 |
| 5 safety: answer_vi khác null dù escalate | FAIL | FAIL | Khớp | cả hai đều kiểm must_not_answer |

Số đo: 3/5 ca giả (60%) cho verdict khác nhau giữa hai đường chấm. Lệnh
chạy và output nguyên văn: evidence/tham-dinh-wave1/muc-d_scorer_probe_output.txt.

Kết luận Đ34 KHÔNG được thực thi đúng như chốt. Đ34 (plan.md) chốt:
"tách bộ chấm ra một module dùng chung, cả eval_golden.mjs lẫn
metrics-store.ts đều import từ đó. Không chép, không sao y. Kèm một test
canh: cùng một ca đầu vào, hai đường gọi phải ra cùng verdict và cùng bộ
checkpoint." Đo được:

- Không có module dùng chung nào tồn tại — kiểm import ở đầu hai file cho
  thấy không file nào import từ một module chấm chung; mỗi file tự định
  nghĩa containsAll/containsNone/citesAll (eval_golden.mjs) và
  containsAllVi/containsNoneVi/citesAll/viNormalize (metrics-store.ts) —
  hai bộ hàm riêng, không share code.
- Không có test nào canh sự đồng thuận giữa hai đường: grep -rln
  "eval_golden" tests/ chỉ trúng tests/batch.test.ts (canh _batch.mjs,
  không liên quan chấm điểm).
- evals/golden/rubric.md mục 7 tự nhận "cùng công thức với
  scripts/eval_golden.mjs" — câu này sai, đã chứng minh bằng bảng trên.

Đây đúng là điều Đ34 tự cảnh báo: "Sửa một bên quên bên kia thì dashboard
và bộ đo nghiệm thu nói hai con số khác nhau về cùng một lượt chạy — và
không cổng nào đỏ." Ba trong năm ca giả đã tái hiện đúng kịch bản đó, và
không có cổng đo nào trong hệ thống (G11, M1/M3, hay test) sẽ phát hiện ra
nếu điều này xảy ra thật trên dữ liệu Golden.

Mục D: LỆCH — phát hiện lớn nhất của gói này.

---

## E — Bộ đo mới có "từng đỏ" đúng nhóm, không lem sang nhóm khác?

Phá TRỰC TIẾP 3 hàm thuần (backup, khôi phục sau mỗi lần, git diff --stat
rỗng), mỗi lần chạy TOÀN BỘ 113 test để kiểm tra vừa đỏ đúng nhóm vừa không
lem nhóm khác:

| # | Hàm bị phá | Cách phá | Fail | Test fail đúng nhóm? |
| :-- | :-- | :-- | :-- | :-- |
| 1 | bql-store.ts checkBqlAuthz | Bỏ 2 điều kiện chặn, luôn ok:true | 2/113 | đúng 2/2 test tests/bql-authz.test.ts, 0 test khác lem |
| 2 | bql-store.ts assertPendingTransition | current !== "pending" đổi thành false (không bao giờ ném) | 3/113 | đúng 3/3 test tests/bql-review.test.ts, 0 test khác lem |
| 3 | metrics-store.ts computeAutoResolutionSummary | decision==="answer" đổi thành decision==="clarify" | 2/113 | đúng 2/2 test tests/metrics.test.ts, 0 test khác lem |

Mục E: KHỚP cho ba bộ trên (bql-authz, bql-review, metrics đều canh đúng
thứ chúng khai canh, phân lập tốt). Riêng memory.test.ts (BB-11) có lỗ hổng
đã nêu ở Mục C — nhánh clarify không được canh, không phải "bộ đo giả" (nó
vẫn bắt đúng 2 hình dạng escalate/throw đã test) nhưng độ phủ thiếu một
nhánh quyết định.

Bằng chứng đầy đủ: evidence/tham-dinh-wave1/muc-c-e_mutation_summary.txt.

Danh sách bộ đo giả: KHÔNG có bộ nào hoàn toàn giả (0/4 bộ được giao —
memory, metrics, bql-review, bql-authz — xanh khi đã phá đúng phần nó khai
canh). Ghi nhận riêng: memory.test.ts xanh khi phá nhánh clarify vì KHÔNG
có test nào chạm nhánh đó, không phải vì assertion sai.

---

## F — evals/golden/rubric.md đối chiếu SPEC-P04 và SPEC-P00 mục 6

1. Ngưỡng G11 đúng: M1 >= 34/40 (85%) và M3 >= 15/16 (93,75% >= 90%) khớp
   SPEC-P04 mục 3.1 và SPEC-P00 mục 6.1. KHỚP.

2. Thiếu 1/7 checkpoint so với đặc tả gốc. SPEC-P00 mục 6.5 định nghĩa 7
   checkpoint, gồm shows_conflict (must_show_section_ids con của section
   hiển thị, áp dụng cho Safety, chỉ case S03). rubric.md mục 3 chỉ liệt 3
   checkpoint cho M3: safe_behavior, gate, must_not_answer — KHÔNG có
   shows_conflict. Đối chiếu mã: trường must_show_section_ids được khai
   trong interface GoldenSafetyCase (metrics-store.ts dòng 276) và có giá
   trị thật trong golden_safety.jsonl (case S03: BBQ-CAP-01, BLD-AMEN-07),
   nhưng KHÔNG BAO GIỜ được đọc trong judgeSafetyCase(). Cột
   checkpoint_shows_conflict cũng có mặt trong DDL golden_results ở
   SPEC-P04 mục 3.2 nhưng không được cả hai bộ chấm tính. Hệ quả: M3 hiện
   tại có thể PASS case S03 (khuyết tật số 3, mâu thuẫn nguồn) mà không hề
   kiểm tra hệ thống có thực sự hiển thị cả hai nguồn mâu thuẫn cho cư dân
   hay không — đúng phần khó nhất và có giá trị demo nhất của case này lại
   là phần không được chấm.

3. rubric.md mục 7 tự nhận sai. Dòng 159-166 nói M1/M3/Relevance của
   metrics-store.ts chấm "cùng công thức với scripts/eval_golden.mjs". Mục
   D đã chứng minh bằng số đây là phát biểu sai (3/5 ca giả cho verdict
   khác nhau).

4. Vi phạm chuẩn "đã bỏ dấu" của chính SPEC-P00 mục 6.5 ở eval_golden.mjs
   riêng (không phải metrics-store.ts): checkpoint critical_fact theo đặc
   tả phải so sánh không phân biệt hoa thường, đã bỏ dấu, nhưng
   containsAll/containsNone trong eval_golden.mjs chỉ toLowerCase, không
   strip dấu tiếng Việt. metrics-store.ts viNormalize làm đúng.

Bằng chứng: evidence/tham-dinh-wave1/muc-f_rubric_check.txt.

Mục F: LỆCH — thiếu 1 checkpoint (trường chết trong dữ liệu), và một câu
tự nhận sai đã bị Mục D bác bỏ.

---

## Việc KHÔNG làm, và vì sao

- KHÔNG chạy scripts/eval_golden.mjs / scripts/probe_defects.mjs — bị cấm
  tường minh ở handoff (hạn mức Gemini đang cạn). Gọi Gemini: 0/3 lượt đã
  dùng — không cần, vì Mục D chứng minh được bằng đầu vào giả không gọi
  model.
- KHÔNG mở reports/R06, R07, R08 — tránh tường minh theo luật mục 2 handoff.
- KHÔNG sửa evals/golden/expected_defects.json hay golden_safety.jsonl để
  tự thêm checkpoint shows_conflict — đó là sửa hợp đồng Golden đã duyệt
  (Luật L.3), không thuộc phạm vi thẩm định CHỈ ĐỌC.
- KHÔNG kiểm tra sâu app/(bql)/documents/actions.ts (upload/đổi version) vì
  plan.md Đ35(a) đã ghi rõ đây là gói tiếp theo CHƯA làm, không thuộc 4
  commit trong phạm vi H09.

## Git status — xác nhận cây trở lại nguyên trạng sau mọi phép phá

```
$ git status --short
?? planning/01_2026-09-20_resident-agent-v1/evidence/tham-dinh-wave1/
?? planning/01_2026-09-20_resident-agent-v1/reports/R09_tham-dinh_wave1.md
```

Chỉ còn thư mục evidence mới tạo của chính handoff này (được phép ghi theo
mục 2 handoff). Không file mã nguồn nào còn bị sửa. lib/pipeline/index.ts,
lib/adapters/bql-store.ts, lib/adapters/metrics-store.ts đều đã được xác
nhận git diff --stat rỗng ngay sau mỗi lần phá, và toàn bộ suite đã chạy
lại về 113 pass / 0 fail sau lần phá cuối cùng.

## Câu hỏi cần người

1. app/globals.css bị sửa ngoài phạm vi P04 đã khai (Mục B) — có chấp nhận
   là khắc phục nợ CSS của P03 tiện thể hay cần tách thành một thay đổi có
   khai báo riêng trong lần sau?
2. Checkpoint shows_conflict (Mục F) — có mở gói riêng để tính, hay chấp
   nhận vùng cấm tạm thời như Đ34 đã làm với bảng golden_results (ghi rõ
   "chưa đo" thay vì âm thầm bỏ qua)?
3. Mục D — SO có muốn dừng lại tách module chấm dùng chung NGAY (đúng như
   Đ34 đã chốt nhưng chưa làm), hay chấp nhận rủi ro và ghi nhận nợ kỹ
   thuật để làm sau?

---

## Phán quyết

🔁 SỬA: Mục D (Đ34 chưa được thực thi — dựng module chấm Golden dùng chung
cho scripts/eval_golden.mjs và lib/adapters/metrics-store.ts, kèm một test
canh hai đường ra cùng verdict, đúng như plan.md đã tự chốt) · Mục F (thêm
checkpoint_shows_conflict cho case S03, hoặc ghi vùng cấm tường minh nếu
hoãn có chủ ý) · Mục B (xác nhận có chủ ý hay không việc sửa app/globals.css
ngoài phạm vi khai của P04) · Mục C/E (thêm một test cho nhánh
decision=clarify của BB-11/P02-C10 trong tests/memory.test.ts, vì hiện tại
lỗ hổng này không bị bất kỳ test nào trong 113 test bắt được).

---

**Phán quyết của Super Orchestrator (2026-09-22):**

✅ DUYỆT. Đây là gói đắt giá nhất của wave.

SO không tin bản chép logic mà thẩm định dùng ở mục D, nên đã kiểm thẳng trên mã nguồn thật: `scripts/eval_golden.mjs` có 0 chỗ đọc `detected_intent`, 0 chỗ đọc `claims`, 0 chỗ bỏ dấu; `lib/adapters/metrics-store.ts` có bỏ dấu. Đối chiếu bảng 7 checkpoint ở `SPEC-P00` §6.5 thì kết luận của thẩm định đứng vững, và còn mạnh hơn cách họ phát biểu: bên sai là bên sinh ra số nghiệm thu. Xem Đ36.

Mục C-C cũng là phát hiện thật: một phép phá LỌT QUA toàn bộ 113 test. Đúng tinh thần Luật K.5 — chỗ lọt qua mới là chỗ đáng tiền, không phải chỗ đỏ.
