# R32 — THI CÔNG — H28: Đ56 mục 3 — Golden "một trong các" (any-of)

Vai: worker (vai-thi-cong) · loại: THI CÔNG · họ/model: Claude Sonnet 5 · Bước 0: exit 0 (não đã hoàn hảo, không cần nâng cấp; cảnh báo BRN-028 không do engine sửa, không liên quan gói này) · hiểu việc: sửa `lib/eval/score.ts` để `must_cite_section_ids`/`must_contain_vi` chấp nhận phần tử mảng = "một trong các" (Đ56), áp cho đúng 3 ca F-I01-05/F-I01-06/F-I04-05 sau khi verify dữ kiện bằng grep trên `knowledge/`, thêm test mới, sửa `rubric.md`; KHÔNG chạm `lib/pipeline/**` (H27 đang sửa), KHÔNG git add/commit/push/stash/checkout--/reset/clean, KHÔNG chạy Golden.

Handoff: `planning/01_2026-09-20_resident-agent-v1/handoffs/H28_d56-golden-any-of.md`
Base: `0f817fd`
Head: (chưa commit — worker không được phép `git add/commit`)

## 1. Lệnh + exit code nguyên văn

| Lệnh | Exit | Evidence |
| :-- | :-- | :-- |
| `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check` | 0 | (in trực tiếp trong hội thoại, không lưu file — nằm ngoài phạm vi `evidence/h28-golden-any-of/`) |
| `node scripts/run_tests.mjs golden-any-of` (trên baseline CŨ, tạm phục hồi `lib/eval/score.ts` về `HEAD` để chứng minh đỏ) | 1 (3/7 fail) | `evidence/h28-golden-any-of/red.txt` |
| `node scripts/run_tests.mjs golden-any-of` (bản đã sửa) | 0 (7/7 pass) | `evidence/h28-golden-any-of/green.txt` |
| `npx tsc --noEmit` | 0 | `evidence/h28-golden-any-of/tsc.txt` |
| `node scripts/run_tests.mjs` (toàn bộ) | 1 (276 pass / 5 fail — cả 5 đều Postgres, xem mục 3) | `evidence/h28-golden-any-of/full_tests.txt` |
| `node scripts/run_tests.mjs conversation-id` (chạy lại riêng) | 0 (9/9 pass) | in trong hội thoại |
| `node scripts/run_tests.mjs p05-quota` (chạy lại riêng) | 0 (2/2 pass) | in trong hội thoại |
| `node scripts/run_tests.mjs p05-write-timeout` (chạy lại riêng) | 0 (2/2 pass) | in trong hội thoại |
| `node scripts/run_tests.mjs pipeline-steps-persist` (chạy lại riêng) | 0 (4/4 pass) | in trong hội thoại |
| `node scripts/validate_golden.mjs .` | 0 — `faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10` | `evidence/h28-golden-any-of/km2.txt` |
| `node scripts/validate_knowledge.mjs .` | 0 — `documents: 19 · sections: 98 · defects_ok: 4/4` | `evidence/h28-golden-any-of/km1.txt` |

## 2. Test tổng/pass/fail/skip

Toàn repo (chạy chung, có tranh kết nối Postgres với worker H27/tiến trình khác): **281 tổng · 276 pass · 5 fail · 0 skip**.
5 ca fail (`conversation-id.test.ts`, `R4/W3 …`, `P05-M6 (postgres)`, `P05-M10 (postgres)`, `H25 W6 (d …)`) đều là test Postgres — khi chạy LẠI RIÊNG từng file, cả 5 **PASS 100%** (bằng chứng ở bảng trên) ⇒ đúng như handoff dự đoán "tranh kết nối", không phải lỗi thật do thay đổi của gói này.

Bộ test mới `tests/golden-any-of.test.ts`: **7/7 pass**, và đã chứng minh ĐỎ trên baseline cũ (3/7 fail đúng ba hành vi mới: citation mảng, must_contain_vi mảng ×2) trước khi phục hồi bản sửa.

Số nền handoff ghi: tsc 0 · test 263/263. Số đo được ở đầu phiên này đã là 281 tổng (khác 263) — chênh lệch đến từ các file test mà H27 đang thêm song song trên cùng cây (`tests/eligibility-d56.test.ts` và các case Đ56 W1/W2 xuất hiện trong `full_tests.txt`), KHÔNG phải do gói H28 — gói H28 chỉ thêm đúng 1 file test mới (`tests/golden-any-of.test.ts`, 7 case).

## 3. `git diff --stat` + SHA

Base SHA: `0f817fd`. Chưa commit (đúng luật — CẤM `git add/commit/push`).

```
 evals/golden/golden_faq.jsonl                                          |  6 +-
 evals/golden/rubric.md                                                 |  4 +-
 lib/eval/score.ts                                                      | 26 ++++++---
 lib/pipeline/eligibility.ts                                            | 67 +++++++++++++++++++--- (H27 — KHÔNG đụng)
 lib/pipeline/index.ts                                                  |  4 +- (H27 — KHÔNG đụng)
 planning/01_2026-09-20_resident-agent-v1/plan.md                       | 25 ++++++++
 .../specs/01-CONTRACTS.md                                              |  4 +- (đã M trước khi H28 bắt đầu — không đụng)
 .../specs/SPEC-P00-Knowledge-Golden.md                                 |  4 +- (đã M trước khi H28 bắt đầu — không đụng)
 8 files changed, 116 insertions(+), 24 deletions(-)
```

File H28 THỰC SỰ đã sửa (đối chiếu `git status` đầu phiên — hai file `01-CONTRACTS.md`/`SPEC-P00-Knowledge-Golden.md` và `plan.md` phần Đ56 đã `M` từ TRƯỚC khi H28 bắt đầu, chỉ `plan.md` được H28 ghi thêm ở cuối để mở câu hỏi):

- `evals/golden/golden_faq.jsonl` — 3 dòng (F-I01-05, F-I01-06, F-I04-05) đổi `must_cite_section_ids`/`must_contain_vi` sang dạng mảng, giữ nguyên mọi trường khác.
- `evals/golden/rubric.md` — thêm 2 mệnh đề giải thích "mảng = một trong các (Đ56)" ở bảng checkpoint M1 §2.
- `lib/eval/score.ts` — đổi kiểu `must_cite_section_ids`/`must_contain_vi` sang `Array<string | string[]>`; `citesAll` và `containsAllVi` xử lý phần tử mảng = "ít nhất một". Hành vi chuỗi cũ giữ nguyên tuyệt đối (test khoá lại).
- `tests/golden-any-of.test.ts` (mới) — 7 case.
- `planning/01_2026-09-20_resident-agent-v1/plan.md` — thêm khối "Câu hỏi mở (H28, 2026-09-23)" ngay dưới Đ56 (xem mục 5).
- `planning/01_2026-09-20_resident-agent-v1/evidence/h28-golden-any-of/**` — `red.txt`, `green.txt`, `tsc.txt`, `full_tests.txt`, `km1.txt`, `km2.txt`.

Không đụng `lib/pipeline/**`, `lib/adapters/**`, `golden_safety.jsonl`, `expected_defects.json`, `knowledge/**`, `db/**`, `planning/**/specs/**` (ngoài việc chỉ ĐỌC), `brain4agent/**`, `package.json`.

## 4. Bảng phân công thực tế

| Gói | Tầng yêu cầu | Họ/model đã dùng | Kết quả |
| :-- | :-- | :-- | :-- |
| W1 — bộ chấm (`score.ts`) | 🟠 | Claude Sonnet 5 | Xong, 7/7 test mới pass, không phá test cũ (`scorer-consensus`, `gate-set` vẫn xanh trong `full_tests.txt`) |
| W2 — dữ liệu 3 ca | 🟢 | Claude Sonnet 5 | Xong, verify bằng grep + đọc trực tiếp 3 file `knowledge/sections/*.json` TRƯỚC khi ghi — cả 5 section_id tồn tại, dữ kiện thật sự có (xem mục 6) |
| W3 — K-M2 | 🟠 | Claude Sonnet 5 | **KHÔNG làm phần "cross-check section_id ⊆ knowledge/"** — mâu thuẫn với SPEC/mã nguồn thật (xem mục 5). Đã xác nhận phần còn lại (exit 0, output đúng chuỗi) |
| W4 — rubric.md | 🟢 | Claude Sonnet 5 | Xong |
| W5 — cổng | 🟢 | Claude Sonnet 5 | Xong, xem mục 1/2 |

## 5. Việc KHÔNG làm + lý do (Câu hỏi mở — đã ghi vào `plan.md`)

**W3 chỉ làm được một phần.** Handoff yêu cầu: *"`validate_golden.mjs` chấp nhận phần
tử mảng (mỗi `section_id` trong mảng phải tồn tại trong `knowledge/` **như luật hiện
có với chuỗi**)"* và yêu cầu chứng minh đỏ bằng cách chèn một `section_id` không tồn
tại vào mảng.

Kiểm tra thực tế trước khi sửa (đúng luật §2 vai-thi-cong — không đoán, đọc mã trước):
- `grep -rn "must_cite_section_ids" scripts/ tests/` chỉ ra field này được đọc ở
  `lib/eval/score.ts` và hai file test (`metrics.test.ts`, `scorer-consensus.test.ts`)
  — **KHÔNG** ở `scripts/validate_golden.mjs`. Đọc toàn bộ `validate_golden.mjs`
  (77 dòng): script không hề tham chiếu trường `must_cite_section_ids`.
- `SPEC-P00-Knowledge-Golden.md` §8 (bảng phân loại lỗi) chỉ có `GoldenCountError`
  và `CoverageError` cho `validate_golden.mjs` — không có error class nào cho
  "section_id không tồn tại trong knowledge". §9 dòng `K-M2` chỉ đòi đúng chuỗi
  `faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10`, exit 0.

Kết luận: **không có "luật hiện có với chuỗi"** như handoff mô tả — đây là handoff
mâu thuẫn với SPEC/mã nguồn thật. Theo luật nhận việc của `vai-thi-cong` ("Handoff
mâu thuẫn SPEC ⇒ KHÔNG tự quyết, ghi Câu hỏi mở, làm phần độc lập, báo lại"), tôi
**không tự thêm** một luật kiểm tra + error class mới vào `validate_golden.mjs`
(đó là quyết định kiến trúc ngoài SPEC, và sửa `specs/**` để thêm error class nằm
ngoài phạm vi CẤM chạm của gói này). Đã ghi khối "Câu hỏi mở (H28, 2026-09-23)"
vào `plan.md` ngay dưới Đ56. Phần còn lại của W3 (xác nhận `validate_golden.mjs`
vẫn `exit 0` với dữ liệu mảng mới) đã làm và đo (mục 1, `km2.txt`) — đúng, vì
script này chưa từng đọc trường đó nên không cần sửa gì để "chấp nhận" mảng.

Không tạo `red_km2.txt` vì không có hành vi nào để chứng minh đỏ (không có check
để phá).

## 6. Xác minh dữ kiện trong `knowledge/` cho 3 ca (W2, trước khi ghi)

| Case | Section thay thế | `grep`/đọc trực tiếp | Dữ kiện |
| :-- | :-- | :-- | :-- |
| F-I01-05 | `CARD-NEW-02` (`knowledge/sections/OCP1-RESIDENT-CARD-ISSUANCE-GUIDE-001.json`) | tồn tại, đọc trực tiếp | body chứa nguyên văn "3 ngày làm việc" — khớp `must_contain_vi` |
| F-I01-06 | `BQL-CONTACT-03` (`knowledge/sections/OCP1-BQL-OFFICE-DIRECTORY-001.json`) | tồn tại, đọc trực tiếp | body chứa nguyên văn "hotline nội bộ" — khớp `must_contain_vi` |
| F-I04-05 | `CONS-PERMIT-02` (`knowledge/sections/OCP1-APARTMENT-CONSTRUCTION-RULES-001.json`, section gốc — không đổi `must_cite_section_ids`, chỉ đổi `must_contain_vi`) | đọc trực tiếp | body chứa "để **được cấp phép** thi công" — khớp cả hai biến thể `["cấp phép thi công","được cấp phép"]` |

Cả 5 `section_id` (`CARD-TIME-06`, `CARD-NEW-02`, `CARD-CONTACT-07`, `BQL-CONTACT-03`,
`CONS-PERMIT-02`) được xác nhận tồn tại bằng `grep -rn "<id>" knowledge/` trước khi ghi
(kết quả: cả 5 khớp đúng 1 lần, không trùng lặp).

## 7. Câu hỏi cần người

Không có câu hỏi cần quyết ngay — câu hỏi mở về W3 đã ghi vào `plan.md`, chờ
Super Orchestrator xác nhận có cần mở gói riêng thêm luật cross-check
`must_cite_section_ids ⊆ knowledge/` hay không (cần sửa `SPEC-P00` §8/§9 trước).

## Tiếp theo

🖐 Cần tay người: quyết có mở gói riêng cho cross-check `must_cite_section_ids ⊆ knowledge/` (mục 5) hay bỏ qua vĩnh viễn — cần sửa SPEC trước khi code.
🤖 Agent làm được ngay: chờ lệnh tiếp theo (không tự ý mở rộng phạm vi).
⭐ Nên làm trước: người duyệt đo lại `git diff --stat` so với phạm vi handoff và chạy lại `tests/golden-any-of.test.ts` — vì đây là bằng chứng nghiệm thu chính của gói.
⏸ Chưa làm: (a) phần cross-check section_id trong W3 (lý do: mâu thuẫn SPEC, mục 5); (b) không chạy Golden thật (đúng luật CẤM của handoff); (c) không commit (đúng luật CẤM).

✅ Đề xuất phán quyết của worker (không tự tuyên bố ĐẠT cổng — chỉ số đo, người duyệt tự đo lại): W1/W2/W4/W5 đủ bằng chứng đỏ→xanh, cổng gate xanh; W3 báo cáo mâu thuẫn thay vì tự quyết.
