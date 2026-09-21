# R08 — Report thi công gói P04 (Eval & Dashboard)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 (não đã OK, không cần nâng cấp) · hiểu việc: phạm vi = `app/(bql)/eval/**`, `app/(bql)/dashboard/**`, `lib/adapters/metrics-store.ts` (mới), `evals/golden/rubric.md` (mới), `app/globals.css` (chỉ thêm cuối file), `tests/metrics*.test.ts` (mới); xong khi = W1–W6 đạt đúng "xong khi" nêu ở mục 3 handoff và cổng tổng (tsc/build/test/3 check_*.sh) đều exit 0, test không giảm dưới 82/0/0; cấm = đụng file ngoài phạm vi, viết "confidence"/"độ tin cậy" trong `.tsx`, tự `new pg.Pool`, tick G11 bằng backend mock, chạy `eval_golden.mjs`/`probe_defects.mjs`, `git add`/`commit`/`push`.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H08_p04-eval-dashboard.md`
Base: HEAD `7956ccc` (nhánh `main`, cây có nhiều worker khác đang chạy song song, không commit)
Head: chưa commit — mọi thay đổi ở dạng working tree, chờ Super Orchestrator đo và commit.

---

## 1. Lệnh + exit code nguyên văn (chạy cuối cùng, sau khi mọi worker khác cũng đã sửa xong tại thời điểm đo)

```
$ npx tsc --noEmit
EXIT=0

$ node scripts/run_tests.mjs
tests 109
suites 0
pass 109
fail 0
cancelled 0
skipped 0
todo 0
EXIT=0

$ npm run build
✓ Compiled successfully
✓ Generating static pages (4/4)
EXIT=0

$ bash scripts/check_no_confidence_ui.sh
matches: 0
EXIT=0

$ bash scripts/check_no_hardcoded_knowledge.sh
matches: 0
EXIT=0

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT=0
```

Output đầy đủ: `planning/01_2026-09-20_resident-agent-v1/evidence/p04/w6-gate-final.txt`.

**Ghi chú số đo baseline vs lúc đo:** handoff ghi baseline `82 pass/0 fail/0 skip`. Lúc
đo cuối của tôi ra **109 pass/0 fail/0 skip** — chênh lệch 27 test đến từ CÁC WORKER
KHÁC đang chạy song song trên cùng cây (P02b/P03/BB-11), không phải của gói P04. Riêng
`tests/metrics.test.ts` (của gói này) đóng góp đúng **20 test mới**, cả 20 đều pass.

## 2. Test riêng của gói (W5)

```
$ node scripts/run_tests.mjs metrics
tests 20 / pass 20 / fail 0 / skip 0
EXIT=0
```

**Bằng chứng ĐỎ (bắt buộc theo W5)** — đã cố tình phá công thức
`computeAutoResolutionSummary` (bỏ lượt `escalate` khỏi mẫu số, vi phạm BB-11),
chạy lại, chụp output đỏ, rồi **revert đúng nguyên bản** trước khi báo cáo:

```
✖ computeAutoResolutionSummary — 10 lượt: 6 answer, 2 clarify, 2 escalate ⇒ 60%
  AssertionError: 8 !== 10
✖ ĐỎ khi đổi mẫu số — bỏ lượt escalate khỏi tổng làm tỉ lệ SAI (xem evidence W5)
  AssertionError: mẫu số phải gồm cả escalate (BB-11)
tests 20 / pass 18 / fail 2
EXIT=1
```

Output đầy đủ + lệnh revert: `planning/01_2026-09-20_resident-agent-v1/evidence/p04/metrics-red-w5.txt`.
Sau revert, chạy lại `node scripts/run_tests.mjs metrics` → `pass 20/20`, đã xác minh
(mục 1 ở trên).

## 3. `git diff --stat` + SHA

```
HEAD = 7956ccc643a01497fdaa114ad56bdbc8e5cdb924 (chưa có commit mới)

 app/(bql)/dashboard/page.tsx | 158 ++++++++++++++++++++++++++++++++++++++++---
 app/(bql)/eval/page.tsx      | 128 +++++++++++++++++++++++++++++++++--
 app/globals.css              | 158 +++++++++++++++++++++++++++++++++++++++++++
 3 files changed, 430 insertions(+), 14 deletions(-)

File MỚI (chưa track, thuộc gói này):
 app/(bql)/eval/labels.ts            35 dòng
 evals/golden/rubric.md              170 dòng
 lib/adapters/metrics-store.ts       520 dòng
 tests/metrics.test.ts               324 dòng
 planning/.../evidence/p04/*.txt     (3 file bằng chứng)
```

**Lưu ý:** `git status --porcelain` lúc đo còn hiện nhiều file KHÁC đã sửa
(`app/(bql)/documents/**`, `app/(bql)/review/**`, `app/api/chat/route.ts`,
`lib/adapters/db.ts`, `lib/adapters/store-mock.ts`, `lib/adapters/bql-store.ts`,
`lib/pipeline/index.ts`, `tests/bql-*.test.ts`) — đây là việc của HAI WORKER
KHÁC đang chạy song song trên cùng cây (điều bổ sung #1/#2 của Super
Orchestrator), **tôi không chạm vào bất kỳ file nào trong nhóm đó**.

`app/globals.css`: chỉ **thêm** khối CSS mới (`/* ── P04 · Eval & Dashboard ── */`)
vào **cuối file**, sau khối `/* ── P03 · Console BQL ── */` đã có sẵn của worker
khác. Không sửa dòng nào đang có.

## 4. Bảng phân công thực tế (gói → tầng yêu cầu → model đã dùng)

| Gói | Tầng yêu cầu | Model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 (`metrics-store.ts` — 6 hàm SQL tổng hợp) | 🟠 | Sonnet 5 (worker chính) | Tự làm đúng tầng, có SPEC + số đo được |
| W2 (trang dashboard) | 🟠 | Sonnet 5 (worker chính) | Tự làm |
| W3 (trang eval) | 🟠 | Sonnet 5 (worker chính) | Tự làm — có mở rộng thiết kế, xem "Câu hỏi mở" §6 |
| W4 (`rubric.md`) | 🔴 | Sonnet 5 (worker chính, KHÔNG lên tầng ngoài) | Không có model tầng đỏ khác trong phiên; đã tự soát kỹ (đối chiếu 3 SPEC nguồn), không tự quyết phần mâu thuẫn — ghi thành "Câu hỏi mở" thay vì bịa |
| W5 (`tests/metrics.test.ts`) | 🟠 | Sonnet 5 (worker chính) | Test thuần, có bằng chứng ĐỎ thật |
| W6 (chạy cổng tổng) | 🟢 | Sonnet 5 (worker chính) | Chạy lệnh có sẵn, chép số |

**Ghi chú tầng W4:** SPEC yêu cầu 🔴 vì "rubric là định nghĩa thế nào là đạt của cả
dự án". Phiên làm việc này chỉ có một model (Sonnet 5, tự vai worker kiêm
orchestrator của việc mình nhận theo luật §"Là orchestrator của việc mình nhận"
skill `vai-thi-cong`). Tôi KHÔNG tự quyết phần có mâu thuẫn SPEC (nguồn dữ liệu
`golden_results` không tồn tại) mà ghi rõ thành câu hỏi mở ở rubric §7 và ở mục 6
dưới đây — đúng luật "SPEC mâu thuẫn ⇒ ghi Câu hỏi mở, không tự quyết".

## 5. Việc KHÔNG làm + lý do

- **Không chạy `npm run eval:golden` / `scripts/probe_defects.mjs`** — luật §4 bổ
  sung của Super Orchestrator (đốt hạn mức Gemini chung).
- **Không tạo bảng `golden_results`** như `SPEC-P04-Eval-Dashboard.md` §3.2 mô tả —
  cần migration mới (`db/migrations/**`) và sửa `scripts/run_golden.mjs`/
  `eval_golden.mjs` (`scripts/**`), cả hai đều **ngoài phạm vi cấp cho gói này**
  (mục 2 handoff H08). Đã đo trước khi làm: `select to_regclass('golden_results')`
  → `NULL` (2026-09-21) — bảng chưa tồn tại. Xem mục 6 "Câu hỏi mở".
- **Không sửa `app/(bql)/layout.tsx`, `lib/adapters/db.ts`, `lib/pipeline/**`,
  `app/api/chat/**`, `app/(bql)/documents/**`, `app/(bql)/review/**`,
  `app/api/bql/**`, `lib/adapters/bql-store.ts`, `db/migrations/**`,
  `scripts/**`, `evals/golden/*.jsonl`, `expected_defects.json`, `plan.md`,
  `specs/**`, `brain4agent/**`** — đúng vùng cấm mục 2 handoff.
- **Không `git add`/`commit`/`push`/`stash`/`checkout`** — luật bổ sung #1 của
  Super Orchestrator (tránh tranh `index.lock` với worker khác).
- Trang `/eval` KHÔNG hiện biểu đồ chuỗi thời gian, KHÔNG so sánh nhiều lượt chạy,
  KHÔNG xuất PDF — đúng vùng cấm `P04-C7`.
- Không đo Metric 2 (Efficiency) — vùng cấm `P04-C6`/C-03, ghi rõ lý do trong
  `rubric.md` §4, không bịa baseline.

## 6. Câu hỏi mở (SPEC mâu thuẫn với phạm vi được cấp — không tự quyết bịa số)

`SPEC-P04-Eval-Dashboard.md` §3.2 thiết kế M1/M3/Relevance đọc từ một bảng
`golden_results` do `npm run eval:golden` ghi. Bảng đó **không tồn tại trong DB**
tại thời điểm gói này chạy, và việc tạo nó (migration + sửa script ghi) nằm
**ngoài phạm vi được cấp** cho handoff `H08` (mục 2: `db/migrations/**` và
`scripts/**` đều bị CẤM).

**Quyết định đã áp dụng (không tự ý mở rộng phạm vi, chỉ đổi NGUỒN số bên trong
phạm vi được cấp):** `lib/adapters/metrics-store.ts::getGoldenEvalSummary()`
chấm lại M1/M3/Relevance trực tiếp trong TypeScript, đối chiếu `answer_turns`
(lượt Golden gần nhất theo `golden_case_id`, join `messages` lấy câu trả lời)
với `evals/golden/*.jsonl` (CHỈ ĐỌC — không sửa, không vi phạm vùng cấm). Logic
chấm bám sát `SPEC-P00-Knowledge-Golden.md` §6.5 và tương đương cách
`scripts/eval_golden.mjs` đang chấm (đọc để tham chiếu, không sửa file đó).
Vẫn giữ đúng BB-06: không lời gọi model nào, không bộ chấm độc lập theo nghĩa
"AI chấm lại chất lượng câu trả lời" — chỉ so sánh dữ liệu đã ghi sẵn với
ground truth có sẵn.

Đã ghi lại đầy đủ lý do và đường lật (nếu Super Orchestrator muốn quay về đúng
thiết kế `golden_results`) ở `evals/golden/rubric.md` §7 — **xin người quyết định
có cần mở một gói riêng để dựng bảng `golden_results` + sửa `run_golden.mjs`
hay giữ cách hiện tại** (cách hiện tại đã qua đủ cổng đo, kể cả curl HTTP 200
trên DB thật không có `golden_results`).

## 7. Câu hỏi cần người

1. Có cần mở gói riêng để dựng bảng `golden_results` (migration + sửa
   `scripts/run_golden.mjs`) đúng nguyên văn `SPEC-P04` §3.2, hay giữ cách chấm
   trực tiếp từ `answer_turns` + `evals/golden/*.jsonl` mà gói này đã làm? (mục 6)
2. `npx tsc --noEmit` lúc tôi bắt đầu việc (trước khi các worker khác sửa xong)
   từng đỏ vì lỗi ở `lib/adapters/bql-store.ts`/`db.ts`/`store-mock.ts` — không
   phải file của tôi. Lúc đo cuối đã xanh trở lại. Nêu ra để Super Orchestrator
   biết đây là trạng thái nhất thời của cây dùng chung, không phải lỗi gói P04.

---

## Tiếp theo

🖐 Cần tay người: quyết định câu hỏi mở §6 (dựng `golden_results` thật hay giữ cách chấm hiện tại) trước khi coi R9/R10 là "đóng hẳn theo đúng văn tự SPEC-P04 §3.2".
🤖 Agent làm được ngay: chờ lệnh — có thể viết migration `golden_results` + sửa `run_golden.mjs` nếu được cấp phạm vi `db/migrations/**` và `scripts/**`.
⭐ Nên làm trước: Super Orchestrator đo lại độc lập (tsc/build/test/3 check + curl `/dashboard` `/eval`) trên cây đã gộp đủ cả ba worker, vì số đo trong report này đo trên cây đang thay đổi liên tục.
⏸ Chưa làm: bảng `golden_results` đúng nguyên văn SPEC-P04 §3.2 (ngoài phạm vi được cấp); Metric 2 Efficiency (vùng cấm P04-C6, chủ động không làm).
