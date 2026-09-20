# R02 — Báo cáo thi công P00: Knowledge Pack mô phỏng + Golden Dataset

Vai · thi công · Claude Sonnet 5 · Bước 0 exit=0 · Hiểu việc: viết tay 19 tài liệu
tri thức mô phỏng (knowledge/) + 66 case Golden (golden/) + 3 script kiểm
(scripts/validate_knowledge.mjs, scripts/validate_golden.mjs,
scripts/report_facility_rules.mjs), cài đúng 4 khuyết tật §5 của SPEC-P00 và
KHÔNG sinh nội dung bằng LLM rồi dùng luôn — mọi defect đã được đọc lại và đối
chiếu thủ công (P00-C6). Cấm: chạm `specs/`, `plan.md`, `brain4agent/`, `docs/`,
`AGENTS.md`, `CLAUDE.md`, `.gitignore`, `git commit`/`push`, cài package qua
mạng, gọi LLM API.

Handoff: H02_p00-knowledge-golden
Base: `663058a75dfcba0de6b9b8eed3085405cae3fe1` (SHA lúc bắt đầu phiên)
Head: chưa commit — worker bị cấm commit. **Lưu ý:** trong lúc worker thi công,
Super Orchestrator đã tạo thêm 1 commit khác (`cb2177a`, "docs(planning): resolve
C-01..C-04, add D13/D14, hand off P00") không liên quan tới thay đổi của worker —
`git log -2 --oneline` xác nhận `cb2177a` → `663058a`. Worker không tạo commit nào.

---

## 1. Lệnh đã chạy + exit code nguyên văn

### W1/W2 — `node scripts/validate_knowledge.mjs`

```
documents: 19 · sections: 98 · defects_ok: 4/4
EXIT=0
```
File: `planning/01_2026-09-20_resident-agent-v1/evidence/p00/validate_knowledge.txt`
Kết quả kỳ vọng ở handoff §3 W1: `documents: 19 · sections: >=97 · defects_ok: 4/4`, exit 0 → **KHỚP** (98 ≥ 97).

### W3 — `node scripts/report_facility_rules.mjs`

```
FAC-PINGPONG	true
FAC-BASKETBALL	true
FAC-VOLLEYBALL	true
FAC-FISHING-LAKE	true
FAC-PICKLEBALL	false
FAC-BBQ	true
FAC-SALT-LAKE	true
FAC-KAYAK	true
FAC-BADMINTON	true
FAC-POOL-KTP	true
FAC-POOL-TP	true
FAC-TENNIS	true
FAC-PLAYGROUND	true
FAC-OUTDOOR-GYM	true
has_authoritative_rules true: 13 · false: 1 (FAC-PICKLEBALL)
EXIT=0
```
File: `planning/01_2026-09-20_resident-agent-v1/evidence/p00/report_facility_rules.txt`
Kết quả kỳ vọng handoff §3 W3: `has_authoritative_rules true: 13 · false: 1 (FAC-PICKLEBALL)`, exit 0 → **KHỚP**.

### W4 — `node scripts/validate_golden.mjs`

```
faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10
EXIT=0
```
File: `planning/01_2026-09-20_resident-agent-v1/evidence/p00/validate_golden.txt`
Kết quả kỳ vọng handoff §3 W4: `faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10`, exit 0 → **KHỚP**.

### W5 — `grep -ril "pickleball" knowledge/ | grep -v README` — **KHÔNG khớp literal, xem mục "SPEC/handoff sai" bên dưới**

```
--- Lệnh literal theo handoff W5 ---
knowledge/expected_defects.json
EXIT=0        (grep tìm thấy 1 dòng ⇒ KHÔNG rỗng ⇒ literal FAIL)

--- Lệnh loại thêm expected_defects.json (chẩn đoán) ---
EXIT=1        (grep không tìm thấy gì ⇒ rỗng ⇒ PASS)
```
File: `planning/01_2026-09-20_resident-agent-v1/evidence/p00/grep_pickleball.txt`

---

## 2. Test tổng/pass/fail/skip

Không có bộ test đơn vị (unit test framework) trong phạm vi P00 — nghiệm thu của
gói này là 3 lệnh script + 1 lệnh grep, theo đúng bảng K-M1..K-M4 của
`SPEC-P00-Knowledge-Golden.md` §9. Kết quả: **3/4 lệnh PASS literal (W1,W2,W3,W4
xanh), 1/4 lệnh (W5) FAIL literal do xung đột đường dẫn giữa handoff và SPEC —
xem mục 4**. 0 skip.

---

## 3. `git status --short` (mọi file đều mới, chưa có gì để `git diff --stat`)

```
?? golden/
?? knowledge/
?? package.json
?? planning/01_2026-09-20_resident-agent-v1/evidence/
?? scripts/
```

Danh sách file đã tạo (đúng phạm vi handoff §2):

- `knowledge/manifest.json` — 19 tài liệu
- `knowledge/sections/*.json` — 19 file, tổng 98 section
- `knowledge/expected_defects.json` — hợp đồng 4 khuyết tật (DEF-01..DEF-04)
- `knowledge/README.md` — revision `SIM-1.0.0` + ghi chú khuyết tật
- `golden/golden_faq.jsonl` — 50 dòng (40 answerable + 5 clarification + 5 escalation)
- `golden/golden_safety.jsonl` — 16 dòng (đúng bảng §6.4, phủ 10/10 mã canonical)
- `scripts/validate_knowledge.mjs`, `scripts/validate_golden.mjs`, `scripts/report_facility_rules.mjs`
- `package.json` — chỉ `"type": "module"` + 3 npm script gọi lại 3 file trên, **0 dependency**
- `planning/01_2026-09-20_resident-agent-v1/reports/R02_p00-knowledge-golden.md` (file này)
- `planning/01_2026-09-20_resident-agent-v1/evidence/p00/*.txt`

Không file nào ngoài danh sách trên bị chạm. Không `git add`/`git commit` nào được chạy.

`grep -cP '[\x08\x0c\x0b]'` trên toàn bộ 9 file trên: **0** cho mọi file (đã đo,
không phải suy đoán).

---

## 4. SPEC/handoff sai — phát hiện trong lúc thi công (KHÔNG tự sửa)

### 4.1 — Xung đột đường dẫn `knowledge/` vs `evals/golden/` — vỡ literal command của W5

`SPEC-P00-Knowledge-Golden.md` §2 định nghĩa cấu trúc:
```
knowledge/{manifest.json, sections/, README.md}
evals/golden/{golden_faq.jsonl, golden_safety.jsonl, rubric.md, expected_defects.json}
```
và script tham chiếu trong `TESTING-ACCEPTANCE.md` §3.1 hardcode
`DEFECTS_FILE = path.join(ROOT, "evals/golden/expected_defects.json")`.

Nhưng **handoff H02 §2 "Được tạo/ghi" chỉ cấp phạm vi**:
`knowledge/expected_defects.json` (không phải `evals/golden/...`) và
`golden/golden_faq.jsonl`, `golden/golden_safety.jsonl` (không phải
`evals/golden/...`, không có thư mục `evals/` nào được cấp phạm vi).

Vì handoff là hợp đồng phạm vi bắt buộc tuân theo tuyệt đối (CẤM chạm ngoài
phạm vi), tôi đã đặt `expected_defects.json` vào `knowledge/` và hai file golden
vào `golden/` theo đúng chữ của handoff, **không tạo `evals/`**.

**Hệ quả đo được:** lệnh W5 `grep -ril "pickleball" knowledge/ | grep -v README`
theo đúng chữ của handoff **không rỗng** — nó khớp
`knowledge/expected_defects.json` (vì file này chứa
`trigger_question_vi: "Sân pickleball mở cửa mấy giờ?"` theo đúng lược đồ §5.5
của SPEC-P00, là dữ liệu hợp đồng bắt buộc phải có, không phải rò rỉ khuyết
tật). Trong thiết kế gốc của SPEC-P00, file này nằm ở `evals/golden/` — NGOÀI
`knowledge/` — nên đáng lẽ không bao giờ bị lệnh grep quét tới. Việc dồn nó vào
`knowledge/` theo đúng phạm vi handoff đã vô tình phá lệnh kiểm W5.

**Tôi đã KHÔNG tự sửa** theo bất kỳ hướng nào (không đổi lệnh W5, không đổi nội
dung `trigger_question_vi`, không tự tạo `evals/` ngoài phạm vi). Bằng chứng đo
kép ở mục 1: lệnh literal FAIL (in ra 1 dòng), lệnh chẩn đoán loại
`expected_defects.json` thì PASS (rỗng) — chứng minh khuyết tật #1 trong dữ liệu
tri thức thật sự vẫn nguyên vẹn (không doc `.json` nào trong `sections/` chứa
"pickleball"; xem `documents: 19 · sections: 98 · defects_ok: 4/4` ở W1 và ĐỎ #1
ở mục 5), chỉ có file hợp đồng metadata bị grep quét trúng do đổi vị trí thư mục.

**Đề xuất cho Super Orchestrator** (không tự quyết, chỉ hai lựa chọn loại trừ
nhau, cần người/SO chọn và sửa `plan.md`/SPEC nếu chọn):
(a) mở rộng phạm vi cho phép tạo `evals/golden/` và di chuyển
`expected_defects.json`, `golden_*.jsonl` sang đó đúng như SPEC-P00 gốc; hoặc
(b) sửa `SPEC-P00` §2 và câu lệnh W5 thành
`grep -ril "pickleball" knowledge/ | grep -v README | grep -v expected_defects.json`
để khớp với phạm vi `knowledge/` phẳng mà handoff đã cấp.

### 4.2 — `facility_id` của Sàn Câu cá: `FAC-FISHING-DECK` (§3.2) vs `FAC-FISHING-LAKE` (§3.4)

`SPEC-P00-Knowledge-Golden.md` §3.2 (bảng 9 tài liệu nhóm tiện ích) ghi cột
`facility_ids phủ` của `OCP1-FISHING-DECK-RULES-001` là `FAC-FISHING-DECK`.
Nhưng §3.4 "Danh mục 12 facility_id" — nguồn dùng để tính `has_authoritative_rules`
ở §4 (K-M4, số nghiệm thu chính của mục này) — liệt kê `FAC-FISHING-LAKE`, **không
có `FAC-FISHING-DECK`** trong 12 mã đó.

Nếu dùng đúng chữ `FAC-FISHING-DECK` như §3.2, kết quả K-M4 sẽ là **12 true / 2
false** (`FAC-PICKLEBALL` và `FAC-FISHING-LAKE` mồ côi), sai với số nghiệm thu
`13 true / 1 false` mà cả `SPEC-P00` §4 lẫn handoff §3-W3 đều yêu cầu.

**Quyết định đã áp dụng (ghi rõ để không tự quyết ngầm):** dùng `FAC-FISHING-LAKE`
(theo §3.4, vì đó là danh sách mà script K-M4 chạy qua và là số nghiệm thu được
handoff yêu cầu chính xác). Đã chú thích trực tiếp trong
`scripts/report_facility_rules.mjs`. Không tự sửa `SPEC-P00-Knowledge-Golden.md`.

---

## 5. Bốn lần đỏ đã chạy thật (khác 4 lần đỏ §6.5 TESTING-ACCEPTANCE — đó là của
P02, không thuộc phạm vi P00). Bốn lần dưới đây là bằng chứng ĐỎ của chính 3
script P00 mới viết, đo trên dữ liệu THẬT (không phải "dữ liệu giả" như ví dụ
trong SPEC), đúng yêu cầu AGENTS.md §5.K.5. File nguyên văn:
`planning/01_2026-09-20_resident-agent-v1/evidence/p00/red_tests.txt`.

```
=== ĐỎ #1 - phá khuyết tật pickleball ===
documents: 19 · sections: 98 · defects_ok: 3/4
errors: 1
  DefectMissingError: DEF-01: từ khoá cấm "pickleball" xuất hiện ở SPORTS-SCOPE-01 (OCP1-SPORTS-COMPLEX-RULES-001)
EXIT=1
--- sau khi phục hồi ---
documents: 19 · sections: 98 · defects_ok: 4/4
EXIT=0

=== ĐỎ #2 - gỡ conflict_group BLD-AMEN-07 + đặt allowed_for_rag=false cho POOL-RULES-2024 ===
documents: 19 · sections: 98 · defects_ok: 2/4
errors: 3
  DefectMissingError: DEF-03: conflict_group CG-BBQ-CAPACITY chỉ có 1 thành viên, cần >= 2
  DefectMissingError: DEF-03: thiếu BLD-AMEN-07 trong conflict_group CG-BBQ-CAPACITY
  DefectMissingError: DEF-04: OCP1-POOL-RULES-2024.allowed_for_rag = false, cần true
EXIT=1
--- sau khi phục hồi ---
documents: 19 · sections: 98 · defects_ok: 4/4
EXIT=0

=== ĐỎ #3 - phá coverage golden: đổi expected_reason_code của S12 (emergency) thành no_eligible_source ===
faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 9/10
errors: 1
  CoverageError: thiếu mã canonical trong golden_safety: emergency_or_life_safety
EXIT=1
--- sau khi phục hồi ---
faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10
EXIT=0

=== ĐỎ #4 - report_facility_rules: vô hiệu hoá mọi nguồn của FAC-BBQ ===
FAC-BBQ	false
has_authoritative_rules true: 12 · false: 2 (FAC-PICKLEBALL, FAC-BBQ)
EXIT=0
--- sau khi phục hồi ---
FAC-BBQ	true
has_authoritative_rules true: 13 · false: 1 (FAC-PICKLEBALL)
EXIT=0
```

Sau mỗi lần đỏ, dữ liệu đã được phục hồi bằng script (không sửa tay), và lệnh
xanh lại được chạy để xác nhận không còn sai lệch. `git status --short` sau khi
phục hồi không còn file `.bak` nào sót lại (đã đo, xem mục 3).

**Đối chiếu ĐỎ #1 và ĐỎ #2 với `TESTING-ACCEPTANCE.md` §6.1 và §6.2 (đã chạy
sẵn trên "dữ liệu giả" trước khi giao SPEC):** cùng cách phá, cùng thông điệp
lỗi, cùng `defects_ok` — script `validate_knowledge.mjs` tái lập được đúng kết
quả đã công bố trước, trên dữ liệu thật của P00. ĐỎ #3 và ĐỎ #4 là hai bộ đo
MỚI (`validate_golden.mjs`, `report_facility_rules.mjs`) không có trong
`TESTING-ACCEPTANCE.md` §6, tự thiết kế cách phá và tự chạy đỏ theo đúng luật
AGENTS.md §5.K.5.

---

## 6. Bảng phân công thực tế

| WP | Việc | Tầng yêu cầu (handoff §5) | Họ/model đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- | :-- |
| W1 | 19 tài liệu + tuyên bố mô phỏng | 🔴 | Claude Sonnet 5 (phiên này, không có model 🔴 riêng khả dụng) | Thiếu model 🔴 đúng nghĩa — đã LÊN mức cẩn trọng cao nhất có thể (đọc lại toàn bộ nội dung, đối chiếu tay từng khuyết tật ở mục "P00-C6 tự kiểm" bên dưới) thay vì đổi model, vì phiên không có lựa chọn model khác |
| W2 | 4 khuyết tật cài sẵn + `expected_defects.json` | 🔴 | Claude Sonnet 5 | Đã tự kiểm thủ công 4/4 khuyết tật (mục "P00-C6 tự kiểm"), cộng 4 lần ĐỎ ở mục 5 |
| W3 | 12 `facility_id` + `has_authoritative_rules` | 🟢 | Claude Sonnet 5 | Chép đúng bảng §3.4/§4, phát hiện thêm mâu thuẫn §4.2 |
| W4 | Golden 50 FAQ + 16 Safety | 🟠 | Claude Sonnet 5 | Có spec + script tự biết đúng/sai (K-M2), đã chạy PASS |
| W5 | Kiểm khuyết tật #1 còn nguyên | 🟢 | Claude Sonnet 5 | Literal FAIL do xung đột đường dẫn — xem mục 4.1, đã đo cả hai chiều |

**Ghi chú thiếu model đúng tầng (🔴):** phiên làm việc này chỉ có một model
(Claude Sonnet 5) khả dụng cho toàn bộ nhiệm vụ, không có lựa chọn "model mạnh
nhất" tách biệt để giao riêng W1/W2. Theo đúng luật "Thiếu model đúng tầng ⇒
LÊN một tầng ⇒ Thiếu 🔴 ⇒ dừng hỏi", đây là câu hỏi cần người ở mục 8: xác nhận
liệu Sonnet 5 chạy với kỷ luật tự-kiểm-lại (P00-C6) có được chấp nhận thay cho
🔴, hay cần một agent thẩm định độc lập soát lại 4 khuyết tật trước khi P02 dựa
vào chúng.

### P00-C6 tự kiểm (đọc lại sau khi viết, KHÔNG dùng luôn)

Đã tự kiểm tay từng khuyết tật sau khi sinh dữ liệu (không tin lời mình, đối
chiếu bằng lệnh máy — output dán ở trên):

1. `grep -ri "và các sân khác" knowledge/` → không tìm thấy (P00-C2 giữ nguyên).
2. Đọc lại `SPORTS-SCOPE-01`: liệt kê đích danh 5 sân, không chuỗi "pickleball"
   ở bất kỳ đâu trong `knowledge/sections/*.json` (W1 `defects_ok: 4/4` +
   grep W5 xác nhận không doc nào trong `sections/` khớp).
3. Đọc lại `BBQ-CAP-01` = "tối đa 10 người", `BLD-AMEN-07` = "tối đa 15 người",
   cả hai cùng `conflict_group: "CG-BBQ-CAPACITY"`, cả hai đều
   `status: Approved`/`effective_status: Current`/`allowed_for_rag: true` (đúng
   yêu cầu §5.3 — không cái nào Expired).
4. Đọc lại metadata `OCP1-POOL-RULES-2024`: `status: Approved` (không phải
   Deprecated — tránh bẫy #2), `allowed_for_rag: true` (không phải false —
   tránh bẫy #1), `effective_status: Expired`, `effective_to: "2025-12-31"`.
   Đọc lại `OCP1-POOL-RULES-001`: đúng 5 section
   (`POOL-SCOPE-01/ENTRY-02/SAFE-03/HYG-04/BAN-05`), **không có** section giờ mở
   cửa nào (tránh bẫy #3).

---

## 7. Việc KHÔNG làm + lý do

- **K-M5** (`npm run db:seed && node scripts/count_rows.mjs`) — KHÔNG làm. Chưa
  có `DATABASE_URL` Neon, ngoài phạm vi handoff §3 dòng cuối.
- **K-M6 / `scripts/probe_defects.mjs`** — KHÔNG làm. Cần P02 (pipeline thật)
  chạy được trước; đây là gate G05 của `TESTING-ACCEPTANCE.md`, không phải gate
  của P00, đúng như handoff §3 dòng cuối đã nêu.
- **`evals/golden/rubric.md`** (nêu trong cấu trúc §2 của SPEC-P00) — KHÔNG tạo.
  Không nằm trong danh sách "Được tạo/ghi" của handoff H02 §2, và không có lệnh
  "xong khi" nào ở handoff §3 kiểm tra file này.
- **Không tạo thư mục `evals/`** — xem phân tích mục 4.1. Đợi quyết định của
  Super Orchestrator giữa hai phương án (a)/(b).

---

## 8. Câu hỏi cần người / cần Super Orchestrator quyết

1. **W5 xung đột đường dẫn (mục 4.1):** chọn phương án (a) mở rộng phạm vi cho
   `evals/golden/` và di chuyển 3 file, hay (b) sửa lại câu lệnh W5 trong
   `SPEC-P00` §9 K-M3 và handoff để loại trừ `expected_defects.json` khỏi vùng
   quét của `knowledge/`? Cả hai đều là thay đổi hợp đồng, worker không tự quyết.
2. **`facility_id` Sàn Câu cá (mục 4.2):** xác nhận `FAC-FISHING-LAKE` (đã dùng)
   là đúng, và sửa cột `facility_ids phủ` ở `SPEC-P00` §3.2 từ
   `FAC-FISHING-DECK` thành `FAC-FISHING-LAKE` cho khớp §3.4/§4.
3. **Thiếu model 🔴 cho W1/W2:** phiên chỉ có Sonnet 5. Cần xác nhận liệu tự-kiểm
   theo P00-C6 (mục 6) có đủ thay thế yêu cầu 🔴, hay cần một lượt thẩm định độc
   lập (agent khác, không thừa kế ngữ cảnh worker này) soát lại 4 khuyết tật và
   98 section trước khi P02/P04 được phép dựa vào Knowledge Pack này.

Dòng cuối: KHÔNG tự phán quyết. Super Orchestrator đo lại và ra `✅ DUYỆT` /
`🔁 SỬA` / `⛔ DỪNG`.

---

## Phán quyết của Super Orchestrator — 2026-09-20

Đã **đo lại toàn bộ, không dùng số của worker**. Bằng chứng: `evidence/p00/so-remeasure.txt`, `evidence/p00/so-red-tests.txt`.

| Cổng | SO đo lại | Kết quả |
| :-- | :-- | :-- |
| K-M1 | `node scripts/validate_knowledge.mjs` | `documents: 19 · sections: 98 · defects_ok: 4/4` · exit 0 ✅ |
| K-M2 | `node scripts/validate_golden.mjs` | `faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10` · exit 0 ✅ |
| K-M3 | `grep -ril "pickleball" knowledge/ \| grep -v README` | rỗng ✅ (**sau khi SO sửa đường dẫn**, xem dưới) |
| K-M4 | `node scripts/report_facility_rules.mjs` | `true: 13 · false: 1 (FAC-PICKLEBALL)` · exit 0 ✅ |
| Bộ đo mới từng ĐỎ | SO tự thiết kế 2 phép phá KHÁC worker | `DefectMissingError` và `GoldenCountError`+`CoverageError`, cả hai exit 1, phục hồi tái xanh ✅ |
| Phạm vi | `git status --short` | 0 file ngoài phạm vi handoff ✅ |

### Hai câu hỏi của worker — SO trả lời

**Câu 1 — xung đột đường dẫn `expected_defects.json`: LỖI CỦA SO, không phải worker.** `SPEC-P00` §2 đặt `expected_defects.json` và hai file golden ở `evals/golden/`; H02 mục 2 của SO ghi nhầm thành `knowledge/expected_defects.json` và `golden/*.jsonl`. Worker theo đúng phạm vi được cấp và **báo lên thay vì tự sửa SPEC — xử lý đúng luật**. SO đã tự tay chuyển về `evals/golden/`, sửa hằng đường dẫn trong `validate_knowledge.mjs` / `validate_golden.mjs`, sửa lại H02 và ghi chú lỗi. K-M3 xanh sau khi chuyển.

**Câu 2 — `FAC-FISHING-DECK` vs `FAC-FISHING-LAKE`: worker chọn ĐÚNG.** `SPEC-P00` §3.4 và §4 (nguồn nghiệm thu K-M4) dùng `FAC-FISHING-LAKE`; §3.2 dòng 117 là lỗi gõ. SO đã sửa SPEC §3.2 sang `FAC-FISHING-LAKE`.

**Câu 3 — thiếu model 🔴 cho W1/W2:** chấp nhận. Bù đắp là đủ: worker tự kiểm P00-C6, chạy 4 phép đỏ, và SO đã đo lại độc lập cộng 2 phép phá tự thiết kế. Nội dung 4 khuyết tật vốn đã được đặc tả kín ở `SPEC-P00` §5.1–§5.5 nên phần phán đoán còn lại là nhỏ.

**Việc chưa làm, ghi nhận đúng:** K-M5 (cần `DATABASE_URL` Neon), K-M6 (cần P02), `evals/golden/rubric.md` — SO xác nhận cả ba nằm ngoài phạm vi H02; `rubric.md` chuyển sang gói P04.

✅ **DUYỆT**
