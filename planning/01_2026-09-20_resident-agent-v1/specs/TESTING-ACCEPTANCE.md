# TESTING & ACCEPTANCE — MA TRẬN TEST, SCRIPT KIỂM CHỨNG, EXIT GATES

> Đọc **trước khi báo xong** bất kỳ gói nào. Không bỏ qua được.
> Phụ thuộc đọc: tất cả file SPEC khác (mỗi file có mục *Số đo nghiệm thu* riêng;
> file này gom lại, thêm script và Exit Gate).

---

## 1. Luật chấm

1. **Bằng chứng là output của máy.** Lời của agent không phải bằng chứng. Report phải
   dán **lệnh + output nguyên văn + exit code**, không được viết "đã xong" hay
   "test xanh".
2. **Người duyệt đo lại, không tin report** (`AGENTS.md` §5.K.5). Chạy lại chính lệnh
   đó, so `git diff --stat` với phạm vi handoff.
3. **Bộ đo mới phải từng ĐỎ.** Một script chưa bao giờ fail trên hệ cố tình hỏng thì
   chưa chứng minh được nó đo cái gì. §6 ghi lại các lần đỏ đã chạy thật.
4. **Exit Gate đánh dấu theo môi trường:** `✅ local / ⬜ deploy`. Kế hoạch chỉ được
   đóng khi cột **deploy** cũng xanh.
5. **Máy dev không có `psql`** (`OPERATIONS.md` §2). Mọi lệnh SQL dùng
   `node scripts/sql.mjs "<q>"`.

---

## 2. Ma trận test

| Mã | Phủ | Loại | Gói | Lệnh |
| :-- | :-- | :-- | :-- | :-- |
| `T-KNOW` | Knowledge Pack + 4 khuyết tật | script | P00 | `node scripts/validate_knowledge.mjs` |
| `T-GOLD` | Quy mô & độ phủ Golden | script | P00 | `node scripts/validate_golden.mjs` |
| `T-CAP` | BB-03 precheck + vùng cấm capability | script | P05 | `node scripts/validate_capabilities.mjs` |
| `T-CONF` | Công thức & 5 cổng (Đ07) | unit | P02 | `npm run test -- confidence` |
| `T-OWN` | Định nghĩa mới `pii_or_account_specific` (Đ06) | unit | P02 | `npm run test -- ownership` |
| `T-STEP` | BB-08 thứ tự 9 chặng | unit | P02 | `npm run test -- step-order` |
| `T-CITE` | BB-04 trả lời phải có citation | unit | P02 | `npm run test -- citation` |
| `T-DEF` | 4 khuyết tật kích hoạt đúng mã | tích hợp | P00+P02 | `node scripts/probe_defects.mjs` |
| `T-R7` | Đổi tài liệu → đổi hành vi ngay | tích hợp | P03 | `node scripts/demo_r7.mjs` |
| `T-REVIEW` | Máy trạng thái HITL | unit | P03 | `npm run test -- review-state-machine` |
| `T-EVAL` | M1 / M3 trên Golden | tích hợp | P04 | `npm run eval:golden` |
| `T-BB06` | Số dashboard = số cột DB | tích hợp | P04 | `node scripts/compare_faithfulness.mjs` |
| `T-IDEM` | Chống đặt chỗ hai lần | unit | P05 | `npm run test -- idempotency` |
| `T-2339` | Đọc chính sách trước khi ghi | tích hợp | P05 | `node scripts/demo_2339.mjs` |
| `T-GREP` | BB-05 / BB-07 / BB-10 | grep | mọi gói | §4.5 |
| `T-BUILD` | Biên dịch & build | build | mọi gói | `npx tsc --noEmit && npm run build` |
| `T-EMBED` | Embedding đúng **384** chiều + chuẩn hoá L2 | script | P02 | `node scripts/probe_embedding.mjs [--raw-norm]` |
| `T-SCHEMA` | `responseSchema` được chấp nhận, qua Zod | script | P02 | `node scripts/probe_model.mjs --model=… --schema=…` |
| `T-PARITY` | `responseSchema.required` khớp khoá schema Zod | unit | P02 | `npm run test -- schema-parity` |

---

## 3. Script kiểm chứng — **đã chạy thử trên dữ liệu giả**

Ba script dưới đây đã được chạy thật trên dữ liệu giả tại máy dev ngày **2026-09-20**
trước khi giao SPEC. Output ghi nguyên văn, không tô vẽ. Worker chép mã nguồn vào
`scripts/` và phải tái lập được cùng kết quả.

### 3.1 — `scripts/validate_knowledge.mjs`

```js
#!/usr/bin/env node
// scripts/validate_knowledge.mjs — kiểm Knowledge Pack TRƯỚC khi seed vào DB.
// Exit 0 = PASS. Exit 1 = có lỗi (in mã lỗi + chi tiết). Exit 2 = sai cách dùng.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? ".";
const KDIR = path.join(ROOT, "knowledge");
const DEFECTS_FILE = path.join(ROOT, "evals/golden/expected_defects.json");
const EXPECT_DOCS = 19, MIN_SECTIONS = 97, BODY_MIN = 60, BODY_MAX = 900;
const errors = [];
const fail = (code, msg) => errors.push(`${code}: ${msg}`);

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { fail("ManifestSchemaError", `${p} — ${e.message}`); return null; }
}

const manifest = readJson(path.join(KDIR, "manifest.json"));
const defectSpec = readJson(DEFECTS_FILE);
if (!manifest || !defectSpec) { report(); process.exit(1); }

// ── 1. manifest ────────────────────────────────────────────────────────────
const docs = manifest.documents ?? [];
if (docs.length !== EXPECT_DOCS) fail("ManifestSchemaError", `documents = ${docs.length}, expected ${EXPECT_DOCS}`);
const docIds = new Set();
for (const d of docs) {
  if (docIds.has(d.document_id)) fail("DuplicateIdError", `document_id ${d.document_id}`);
  docIds.add(d.document_id);
  for (const f of ["title_vi","doc_kind","version","status","effective_status","effective_from","source_note_vi"])
    if (d[f] === undefined || d[f] === null || d[f] === "") fail("ManifestSchemaError", `${d.document_id} thiếu ${f}`);
  if (typeof d.allowed_for_rag !== "boolean") fail("ManifestSchemaError", `${d.document_id} allowed_for_rag không phải boolean`);
  if (d.effective_to && d.effective_to < d.effective_from)
    fail("ManifestSchemaError", `${d.document_id} effective_to < effective_from`);
}

// ── 2. sections ────────────────────────────────────────────────────────────
const sectionIds = new Set();
const sectionsByDoc = new Map();
let totalSections = 0;
for (const d of docs) {
  const p = path.join(KDIR, "sections", `${d.document_id}.json`);
  if (!fs.existsSync(p)) { fail("ManifestSchemaError", `thiếu file section: ${p}`); continue; }
  const secs = readJson(p); if (!secs) continue;
  sectionsByDoc.set(d.document_id, secs);
  totalSections += secs.length;
  for (const s of secs) {
    if (sectionIds.has(s.section_id)) fail("DuplicateIdError", `section_id ${s.section_id}`);
    sectionIds.add(s.section_id);
    const len = (s.body_vi ?? "").length;
    if (len < BODY_MIN || len > BODY_MAX)
      fail("BodyLengthError", `${s.section_id} body_vi = ${len} ký tự (cho phép ${BODY_MIN}–${BODY_MAX})`);
    if (s.is_excluded === true && !s.exclusion_note_vi)
      fail("ManifestSchemaError", `${s.section_id} is_excluded=true nhưng thiếu exclusion_note_vi`);
  }
}
if (totalSections < MIN_SECTIONS) fail("ManifestSchemaError", `sections = ${totalSections}, tối thiểu ${MIN_SECTIONS}`);

// ── 3. bốn khuyết tật cài sẵn ──────────────────────────────────────────────
const findSection = (id) => {
  for (const [doc, secs] of sectionsByDoc) { const s = secs.find(x => x.section_id === id); if (s) return { doc, s }; }
  return null;
};
let defectsOk = 0;
for (const def of defectSpec.defects) {
  const before = errors.length;
  if (def.kind === "gap" && def.forbidden_term) {
    const term = def.forbidden_term.toLowerCase();
    for (const [doc, secs] of sectionsByDoc)
      for (const s of secs)
        if (`${s.heading_vi} ${s.body_vi}`.toLowerCase().includes(term))
          fail("DefectMissingError", `${def.id}: từ khoá cấm "${def.forbidden_term}" xuất hiện ở ${s.section_id} (${doc})`);
    if (!findSection(def.anchor_section_id)) fail("DefectMissingError", `${def.id}: thiếu section neo ${def.anchor_section_id}`);
  }
  if (def.kind === "gap" && def.forbidden_section_topic) {
    if (!findSection(def.anchor_section_id)) fail("DefectMissingError", `${def.id}: thiếu section neo ${def.anchor_section_id}`);
  }
  if (def.kind === "conflict") {
    const members = [];
    for (const [, secs] of sectionsByDoc)
      for (const s of secs) if (s.conflict_group === def.conflict_group) members.push(s.section_id);
    if (members.length < 2)
      fail("DefectMissingError", `${def.id}: conflict_group ${def.conflict_group} chỉ có ${members.length} thành viên, cần >= 2`);
    for (const need of def.member_section_ids)
      if (!members.includes(need))
        fail("DefectMissingError", `${def.id}: thiếu ${need} trong conflict_group ${def.conflict_group}`);
  }
  if (def.kind === "expired") {
    const d = docs.find(x => x.document_id === def.anchor_document_id);
    if (!d) fail("DefectMissingError", `${def.id}: thiếu tài liệu ${def.anchor_document_id}`);
    else for (const [k, v] of Object.entries(def.required_metadata))
      if (d[k] !== v) fail("DefectMissingError", `${def.id}: ${def.anchor_document_id}.${k} = ${JSON.stringify(d[k])}, cần ${JSON.stringify(v)}`);
    if (!findSection(def.anchor_section_id)) fail("DefectMissingError", `${def.id}: thiếu section ${def.anchor_section_id}`);
  }
  if (errors.length === before) defectsOk++;
}

function report() {
  const docsN = (manifest?.documents ?? []).length;
  console.log(`documents: ${docsN} · sections: ${totalSections} · defects_ok: ${defectsOk}/${defectSpec?.defects?.length ?? 0}`);
  if (errors.length) { console.log(`errors: ${errors.length}`); errors.forEach(e => console.log(`  ${e}`)); }
}
report();
process.exit(errors.length ? 1 : 0);
```

**Chạy XANH — lệnh `node validate_knowledge.mjs fake`:**

```text
documents: 19 · sections: 98 · defects_ok: 4/4
EXIT=0
```

### 3.2 — `scripts/validate_capabilities.mjs`

```js
#!/usr/bin/env node
// scripts/validate_capabilities.mjs — BB-03: mọi lệnh GHI phải có precheck đọc-thuần.
// Exit 0 = PASS. Exit 1 = vi phạm.
import fs from "node:fs";
const FILE = process.argv[2] ?? "lib/simbackend/capabilities.json";
const caps = JSON.parse(fs.readFileSync(FILE, "utf8"));
const byId = new Map(caps.map(c => [c.capability_id, c]));
const errors = [];

for (const c of caps) {
  if (!["read", "write"].includes(c.kind)) errors.push(`${c.capability_id}: kind không hợp lệ (${c.kind})`);

  if (c.kind === "write") {
    // BB-03
    if (!c.precheck_capability_id) { errors.push(`${c.capability_id}: lệnh GHI thiếu precheck_capability_id (BB-03)`); }
    else {
      const pre = byId.get(c.precheck_capability_id);
      if (!pre) errors.push(`${c.capability_id}: precheck "${c.precheck_capability_id}" không tồn tại`);
      else if (pre.kind !== "read") errors.push(`${c.capability_id}: precheck "${pre.capability_id}" phải là lệnh ĐỌC, đang là ${pre.kind}`);
    }
    // chống gọi lặp: lệnh ghi tạo mới phải có idempotency_key
    if (/create|register|submit|pay|purchase/.test(c.capability_id) && !c.required_params.includes("idempotency_key"))
      errors.push(`${c.capability_id}: lệnh GHI tạo mới thiếu tham số idempotency_key`);
  } else {
    if (c.precheck_capability_id) errors.push(`${c.capability_id}: lệnh ĐỌC không được có precheck`);
    if (c.idempotent !== true) errors.push(`${c.capability_id}: lệnh ĐỌC bắt buộc idempotent`);
  }
}
// vùng cấm §8.4 của 01-CONTRACTS
const FORBIDDEN_PREFIX = ["billing.", "partner.", "promo.", "service.", "event.", "support.", "notify.", "identity."];
for (const c of caps)
  if (FORBIDDEN_PREFIX.some(p => c.capability_id.startsWith(p)))
    errors.push(`${c.capability_id}: nhóm nằm trong vùng cấm vòng 1.0.0 (01-CONTRACTS §8.4)`);

const writes = caps.filter(c => c.kind === "write");
const noPre = writes.filter(c => !c.precheck_capability_id).length;
console.log(`capabilities: ${caps.length} · write: ${writes.length} · write_without_precheck: ${noPre}`);
if (errors.length) { console.log(`errors: ${errors.length}`); errors.forEach(e => console.log(`  ${e}`)); }
process.exit(errors.length ? 1 : 0);
```

**Chạy XANH:**

```text
capabilities: 9 · write: 2 · write_without_precheck: 0
EXIT=0
```

### 3.3 — Bộ chạy công thức confidence

Cài đặt tham chiếu `lib/confidence.ts` nằm ở [`SPEC-P02-Agent-Pipeline.md`](SPEC-P02-Agent-Pipeline.md)
§6.2. Đây là bộ chạy 10 ca dùng làm unit test `T-CONF`:

```js
// scripts/run_conf.mjs (hoặc chuyển thành test case của Vitest)
import { decideTurn, TAU_ANSWER, TAU_FAITHFUL,
         W_RETRIEVAL, W_ELIGIBILITY, W_FAITHFULNESS } from "../lib/confidence.mjs";
const cases = [
  ["W1 D5 bể bơi trẻ em (đối chứng xanh)", {retrieval_top1:0.82, eligible_count:4, retrieved_count:4, faithfulness:1.00, conflict_detected:false}],
  ["W2 D6 giờ BQL (đối chứng xanh)",       {retrieval_top1:0.74, eligible_count:3, retrieved_count:5, faithfulness:1.00, conflict_detected:false}],
  ["W3 sát ngưỡng dưới",                   {retrieval_top1:0.55, eligible_count:2, retrieved_count:8, faithfulness:0.80, conflict_detected:false}],
  ["W4 sát ngưỡng trên nhưng trượt",       {retrieval_top1:0.30, eligible_count:1, retrieved_count:8, faithfulness:0.80, conflict_detected:false}],
  ["W5 faithfulness thấp, raw vẫn cao",    {retrieval_top1:0.90, eligible_count:6, retrieved_count:6, faithfulness:0.75, conflict_detected:false}],
  ["W6 S03 conflict BBQ (DEF-03)",         {retrieval_top1:0.88, eligible_count:4, retrieved_count:4, faithfulness:1.00, conflict_detected:true}],
  ["W7 S01 pickleball (DEF-01)",           {retrieval_top1:0.00, eligible_count:0, retrieved_count:0, faithfulness:0.00, conflict_detected:false}],
  ["W8 S04 bể bơi expired (DEF-04)",       {retrieval_top1:0.79, eligible_count:0, retrieved_count:5, faithfulness:0.00, conflict_detected:false, rejection_histogram:{expired_or_unknown:3}}],
  ["W9 S02 phí thẻ xe máy (DEF-02)",       {retrieval_top1:0.68, eligible_count:2, retrieved_count:6, faithfulness:0.00, conflict_detected:false, retriever_refused:true}],
  ["W10 A3 không tách được claim nào",     {retrieval_top1:0.71, eligible_count:3, retrieved_count:4, faithfulness:0.00, conflict_detected:false}],
];
console.log(`W_RETRIEVAL=${W_RETRIEVAL} W_ELIGIBILITY=${W_ELIGIBILITY} W_FAITHFULNESS=${W_FAITHFULNESS} TAU_ANSWER=${TAU_ANSWER} TAU_FAITHFUL=${TAU_FAITHFUL}`);
console.log("case | S1 | S2 | S3 | S4 | confidence | decision | reason_code | gate");
for (const [name, s] of cases) {
  const o = decideTurn(s);
  console.log(`${name} | ${o.s1.toFixed(2)} | ${o.s2.toFixed(4)} | ${o.s3.toFixed(2)} | ${s.conflict_detected?1:0} | ${o.confidence} | ${o.decision} | ${o.reason_code??"—"} | ${o.gate??"—"}`);
}
```

**Chạy XANH** — output nguyên văn ở [`SPEC-P02-Agent-Pipeline.md`](SPEC-P02-Agent-Pipeline.md)
§6.3 (10 dòng, exit 0). Đó là bảng kỳ vọng của `T-CONF`.

---

## 4. Test bất biến BB-01 → BB-12

### 4.1 — Nhóm pipeline (unit / tích hợp)

| Bất biến | Lệnh | PASS khi |
| :-- | :-- | :-- |
| BB-01 | `npm run test -- bb01` | Hỏi nội quy `FAC-PICKLEBALL` ⇒ `reason_code=no_eligible_source`, `citations=[]`; đặt chỗ cùng tiện ích ⇒ thành công |
| BB-04 | `npm run test -- citation` | Bơm draft không citation ⇒ ném `PipelineInvariantError` |
| BB-06 | `node scripts/compare_faithfulness.mjs` | `delta = 0` |
| BB-08 | `npm run test -- step-order` | 9 nhánh thoát sớm đều đúng thứ tự, không nhảy cóc |
| BB-11 | `npm run eval:golden && node scripts/sql.mjs "select count(*) from answer_turns where is_golden_run=true"` | `= 65` (66 case trừ `S16` không gọi `runTurn`) |

### 4.2 — Nhóm schema

```bash
node scripts/dump_schema.mjs                 # BB-09: in đủ 15 reason_code
node scripts/check_enum_closed.mjs           # BB-09: chèn mã lạ phải bị từ chối
node scripts/validate_capabilities.mjs       # BB-03
node scripts/validate_policy.mjs             # BB-02
```

`check_enum_closed.mjs` PASS khi in đúng chuỗi
`rejected: invalid input value for enum reason_code` và exit 0. **Script này phải
ném lỗi từ Postgres mới là PASS** — đây là loại test dễ viết sai thành luôn xanh.

### 4.3 — BB-12 · cổng P05

Không phải lệnh, là quy trình: kiểm bằng lịch sử git. Commit đầu tiên chạm
`lib/simbackend/` phải **sau** commit làm G01–G12 xanh hết.

```bash
git log --oneline --diff-filter=A -- lib/simbackend/ | tail -1
```

### 4.4 — Bơm lỗi cho case `S14`

`runTurn({ forceUpstreamError: true })` ném `UpstreamRateLimited` (**429**) **ở lời gọi
A2**, sau khi eligibility đã chạy. Kỳ vọng: retry đúng 2 lần với backoff **2s→8s** →
`system_error`, UI có nút *Thử lại*, `answer_turns` vẫn có đúng một dòng (BB-11).

**Ba biến thể BẮT BUỘC có, không chỉ một** — vì bảng lỗi nay phân biệt chúng và mỗi
loại có hành vi khác nhau (`01-CONTRACTS.md` §9):

| Bơm lỗi | Lớp lỗi ném ra | Kỳ vọng |
| :-- | :-- | :-- |
| `forceUpstreamError: "429"` | `UpstreamRateLimited` | retry 2 lần, backoff 2s→8s → `system_error` |
| `forceUpstreamError: "503"` | `UpstreamOverloaded` | **y như 429** — nếu nó retry nhanh 1s→3s thì mã đang gộp nhầm vào "5xx chung", **FAIL** |
| `forceUpstreamError: "blocked"` | `UpstreamContentBlocked` | **0 lần retry**, escalate ngay. Có retry ⇒ **FAIL** |

Case Golden `S14` dùng biến thể `"429"` để giữ nguyên kỳ vọng cũ của nó.

**CẤM** mô phỏng lỗi bằng cách ngắt mạng thủ công — không tái lập được.
**CẤM** mô phỏng bằng cách gọi thật cho tới khi dính 429 — đốt hạn mức chung (`OP-C12`).

### 4.5 — Nhóm grep (BB-05, BB-07, BB-10)

```bash
# BB-05 — không hiển thị confidence ở giao diện cư dân
grep -rniE "confidence|độ tin cậy|% tin cậy" "app/(resident)" --include=*.tsx \
  && echo "VI PHẠM BB-05" && exit 1 || echo "matches: 0"

# BB-07 — chỉ adapter được gọi ra nhà cung cấp model / đọc khoá / mở kết nối DB
# LƯU Ý: mẫu cũ "@anthropic-ai/sdk" đã BỎ — gói đó không còn trong repo nên mẫu ấy
# không bao giờ trúng gì, tức XANH GIẢ. Xem 00-ARCHITECTURE.md §BB-07.b.
grep -rnE "generativelanguage\.googleapis\.com|GEMINI_API_KEY|@neondatabase/serverless" \
  app/ lib/ --include=*.ts --include=*.tsx \
  | grep -v "^lib/adapters/" && echo "VI PHẠM BB-07" && exit 1 || echo "violations: 0"

# BB-10 — tri thức không hardcode trong mã
grep -rn "OCP1-" app/ lib/ --include=*.ts \
  | grep -v "lib/knowledge/seed\|__tests__\|\.test\.ts" && echo "VI PHẠM BB-10" && exit 1 || echo "matches: 0"
```

Cả ba in `0` là PASS. Trên Windows dùng Git Bash; PowerShell dùng `Select-String`
với cùng mẫu.

---

## 5. Số đo trên Golden

### 5.1 — Hai cổng cứng

| Chỉ số | Lệnh | Cổng | Neo |
| :-- | :-- | :-- | :-- |
| **M1** Correct & Grounded | `npm run eval:golden -- --set=faq` | **≥ 34/40** answerable (85%) | `PRD` §9 Metric 1 |
| **M3** Correct Safe Behavior | `npm run eval:golden -- --set=safety` | **≥ 15/16** (93,75% ≥ 90%) | `PRD` §9 Metric 3 |

Dòng tổng kết bắt buộc in ra:

```text
faq: <x>/50 (answerable <y>/40) · safety: <z>/16 · run_id=<uuid>
```

### 5.2 — Số đếm phải khớp

```bash
node scripts/sql.mjs "select count(*) from golden_results"                                  # = 66
node scripts/sql.mjs "select count(*) from answer_turns where is_golden_run=true"           # = 65
node scripts/sql.mjs "select count(*) from answer_turns where decision='answer' and citations='[]'"  # = 0
node scripts/sql.mjs "select count(*) from review_queue r join answer_turns a on a.id=r.answer_turn_id where a.decision<>'escalate'"  # = 0
```

### 5.3 — Bốn khuyết tật

```bash
node scripts/probe_defects.mjs
```

PASS khi in **đúng 4 dòng** và exit 0:

```text
DEF-01 OK no_eligible_source G2_zero_eligible
DEF-02 OK no_eligible_source G3_retriever_refused
DEF-03 OK source_conflict G1_conflict
DEF-04 OK source_expired_or_unknown G2_zero_eligible
```

Một dòng ghi `MISMATCH` ⇒ FAIL toàn bộ. Đây là số đo **quan trọng nhất của cả kế
hoạch**: nó chứng minh cả P00 lẫn P02 cùng đúng, tại đúng chỗ khó nhất.

---

## 6. Bằng chứng ĐỎ — các bộ đo đã từng fail thật

`AGENTS.md` §5.K.5: bộ đo mới phải từng đỏ trên hệ cố tình hỏng ít nhất một lần.
Bốn lần đỏ dưới đây **đã chạy thật** trên dữ liệu giả, ngày 2026-09-20.

### 6.1 — ĐỎ #1 · phá khuyết tật #1

Cách phá: thêm câu *"Ngoài ra còn áp dụng cho Sân Pickleball."* vào `SPORTS-SCOPE-01`.

```text
documents: 19 · sections: 98 · defects_ok: 3/4
errors: 1
  DefectMissingError: DEF-01: từ khoá cấm "pickleball" xuất hiện ở SPORTS-SCOPE-01 (OCP1-SPORTS-COMPLEX-RULES-001)
EXIT=1
```

### 6.2 — ĐỎ #2 và #3 · phá cặp mâu thuẫn + dính bẫy `allowed_for_rag`

Cách phá: gỡ `conflict_group` của `BLD-AMEN-07`; đặt
`OCP1-POOL-RULES-2024.allowed_for_rag = false` (đúng bẫy #1 ở `SPEC-P00` §5.4).

```text
documents: 19 · sections: 98 · defects_ok: 2/4
errors: 3
  DefectMissingError: DEF-03: conflict_group CG-BBQ-CAPACITY chỉ có 1 thành viên, cần >= 2
  DefectMissingError: DEF-03: thiếu BLD-AMEN-07 trong conflict_group CG-BBQ-CAPACITY
  DefectMissingError: DEF-04: OCP1-POOL-RULES-2024.allowed_for_rag = false, cần true
EXIT=1
```

### 6.3 — ĐỎ #4 · bỏ precheck + thêm capability vùng cấm

Cách phá: `amenity.create_booking.precheck_capability_id = null`; thêm
`billing.pay_invoice`.

```text
capabilities: 10 · write: 3 · write_without_precheck: 1
errors: 3
  amenity.create_booking: lệnh GHI thiếu precheck_capability_id (BB-03)
  billing.pay_invoice: lệnh GHI tạo mới thiếu tham số idempotency_key
  billing.pay_invoice: nhóm nằm trong vùng cấm vòng 1.0.0 (01-CONTRACTS §8.4)
EXIT=1
```

### 6.4 — ĐỎ #5 · chứng minh sàn `TAU_FAITHFUL` gánh việc thật

Cách phá: đặt `TAU_FAITHFUL = 0.00` rồi chạy lại đúng 10 ca của §3.3.

```text
case | S1 | S2 | S3 | S4 | confidence | decision | reason_code | gate
W5 faithfulness thấp, raw vẫn cao | 0.90 | 1.0000 | 0.75 | 0 | 0.83 | answer | — | —
W10 A3 không tách được claim nào | 0.71 | 0.7500 | 0.00 | 0 | 0.292 | escalate | no_eligible_source | G5_tau_answer
```

**W5 lật từ `escalate` sang `answer`.** Một bản nháp có 1/4 mệnh đề không neo được
evidence sẽ được nói ra với giọng chắc chắn. Đây là bằng chứng máy cho luật
`SPEC-P02` §6.5: **CẤM đặt `TAU_FAITHFUL = 0`.**

### 6.5 — Bảy lần đỏ CÒN NỢ, worker phải chạy khi có mã nguồn

*(Bốn lần đỏ gốc `R6`–`R9`, cộng ba lần đỏ mới `R10`–`R12` do đổi nhà cung cấp model
`[Đ17/Đ18]`.)*

| # | Bộ đo | Cách cố tình phá | Kỳ vọng ĐỎ |
| :-- | :-- | :-- | :-- |
| R6 | `T-CITE` | Trả `decision='answer'` với `citations=[]` | ném `PipelineInvariantError` |
| R7 | `T-STEP` | Gọi `retrieval` trước `safety` | `assertStepOrder` ném |
| R8 | `T-IDEM` | Gỡ ràng buộc `bookings_idem_uniq` rồi gọi 2 lần | 2 dòng `bookings` ⇒ test fail |
| R9 | `T-BB06` | Sửa tay 1 dòng `s3_faithfulness` trong DB | `delta ≠ 0` |
| **R10** | `check_adapter_boundary.sh` **mẫu MỚI** | Thêm `const k = process.env.GEMINI_API_KEY;` vào một file trong `lib/pipeline/`, và một chuỗi `"https://generativelanguage.googleapis.com/..."` vào một file trong `app/` | `violations: 2`, **exit 1** |
| **R11** | `T-EMBED-DIM` | Gọi `embedContent` **bỏ** `outputDimensionality` | Trả **3072** chiều ⇒ ghi vào `vector(384)` phải **ném lỗi**, KHÔNG được cắt bớt im lặng |
| **R12** | `T-SCHEMA-PARITY` | Xoá một khoá khỏi `required` của một `responseSchema` | `npm run test -- schema-parity` **fail** |

Report của worker **bắt buộc** dán output các lần đỏ này. Thiếu ⇒ report bị trả lại.

> **R10 là bắt buộc, KHÔNG được kế thừa bằng chứng đỏ của gói P01a.** P01a đã chứng
> minh mẫu **cũ** (`@anthropic-ai/sdk`) đỏ đúng, và bằng chứng đó vẫn hợp lệ **cho mẫu
> cũ**. Nhưng mẫu cũ nay không kiểm gì nữa (`00-ARCHITECTURE.md` §BB-07.b đã chạy thật
> và chứng minh nó in `violations: 0` trên một cây đang rò rỉ lộ liễu). **Bộ đo mới phải
> tự đỏ ít nhất một lần** — đúng luật §6 và luật K.5 của `AGENTS.md`.
>
> **R11 chặn đúng cái sai nguy hiểm nhất của cả lần chuyển nhà cung cấp này:** số chiều
> mặc định của `gemini-embedding-001` là **3072**, không phải 384. Sai chỗ này thì hoặc
> vỡ DDL (to tiếng, dễ thấy), hoặc — nếu ai đó "sửa cho chạy" bằng cách cắt bớt vector —
> **hỏng im lặng**: retrieval vẫn chạy, vẫn trả kết quả, chỉ là xếp hạng sai. **CẤM cắt
> bớt vector. CẤM sửa DDL cho khớp 3072** (`C-08`).

---

## 7. EXIT GATES

Đánh dấu hai môi trường: `local` (máy dev) và `deploy` (URL Vercel công khai).
Kế hoạch **chỉ được đóng khi cột deploy cũng xanh**.

### 7.1 — Cổng tầng 1 (rubric) — BẮT BUỘC

| Gate | Nội dung | Rubric | Lệnh / cách kiểm | local | deploy |
| :-- | :-- | :-- | :-- | :-- | :-- |
| G01 | Build & typecheck sạch | — | `npx tsc --noEmit && npm run build` | ⬜ | ⬜ |
| G02 | URL công khai mở được | R1 | `curl -s -o /dev/null -w "%{http_code}" <url>` = `200` | ⬜ | ⬜ |
| G03 | Đăng nhập 2 vai, 2 giao diện | R2 | Thao tác tay + `npm run test -- authz` (8/8 trả 403) | ⬜ | ⬜ |
| G04 | Knowledge Pack hợp lệ, 4 khuyết tật còn nguyên | — | `node scripts/validate_knowledge.mjs` ⇒ `defects_ok: 4/4`, exit 0 | ⬜ | ⬜ |
| G05 | 4 khuyết tật kích hoạt đúng mã qua pipeline thật | R5 | `node scripts/probe_defects.mjs` ⇒ 4 dòng `OK` | ⬜ | ⬜ |
| G06 | Trả lời có trích dẫn `document_id` + `section_id` | R3 | `select count(*) … decision='answer' and citations='[]'` = **0** | ⬜ | ⬜ |
| G07 | Lịch sử hội thoại bền qua phiên | R4 | `npm run test -- memory` | ⬜ | ⬜ |
| G08 | Ba agent tách bạch, log từng chặng | R6 | `node scripts/trace_sample.mjs <id>` ⇒ 3 khối có `model`/`ms`/tokens | ⬜ | ⬜ |
| G09 | BQL đổi tài liệu → hành vi đổi ngay | R7 | `node scripts/demo_r7.mjs` ⇒ 3 dòng đúng thứ tự | ⬜ | ⬜ |
| G10 | Hàng đợi duyệt: Duyệt / Sửa / Từ chối | R8 | `npm run test -- review-state-machine` | ⬜ | ⬜ |
| G11 | M1 ≥ 34/40 **và** M3 ≥ 15/16 | R9 | `npm run eval:golden` | ⬜ | ⬜ |
| G12 | Dashboard tỉ lệ tự động giải quyết, tách theo intent + lý do | R10 | Mở `/bql/dashboard`, có số, không `NaN` | ⬜ | ⬜ |

### 7.2 — Cổng bất biến — BẮT BUỘC

| Gate | Nội dung | Lệnh | local | deploy |
| :-- | :-- | :-- | :-- | :-- |
| G13 | Công tắc ngắt đã thử thật | Bật `KILL_SWITCH_AGENTS=1` **trong khi `RETRIEVAL_MODE=hybrid`**, hỏi 1 câu ⇒ còn citation, **0** lời gọi ra `generativelanguage.googleapis.com` **kể cả embedding** (`OPERATIONS` §7, `OP-M8`) | ⬜ | ⬜ |
| G14 | BB-05 · không hiện confidence cho cư dân | §4.5 grep ⇒ `matches: 0` | ⬜ | ⬜ |
| G15 | BB-07 · ranh giới adapter | §4.5 grep **mẫu MỚI** ⇒ `violations: 0`, **kèm** bằng chứng đỏ `R10` (§6.5). Xanh mà không có `R10` ⇒ **gate KHÔNG được tick** | ⬜ | ⬜ |
| G16 | BB-09 · enum đóng | `node scripts/check_enum_closed.mjs` | ⬜ | ⬜ |
| G17 | BB-11 · mọi lượt đều có log | `select count(*) … is_golden_run=true` = **65** | ⬜ | ⬜ |
| G18 | Các lần đỏ còn nợ (§6.5) đã chạy | Output **R6–R12** dán vào report | ⬜ | ⬜ |
| **G27** | Embedding đúng **384** chiều, khớp DDL | `node scripts/probe_embedding.mjs` ⇒ `dims: 384`, exit 0 (`C-M8`) | ⬜ | ⬜ |
| **G28** | Chuẩn hoá L2 đã đo, có số | `node scripts/probe_embedding.mjs --raw-norm` ⇒ in `norm_before_l2` **và** `norm_after_l2: 1.0000` (`C-M9`) | ⬜ | ⬜ |
| **G29** | `responseSchema` được nhà cung cấp chấp nhận | `node scripts/probe_model.mjs --model=gemini-3.5-flash-lite --schema=classifier` ⇒ 200, `finishReason: STOP`, qua Zod (`C-M11`) | ⬜ | ⬜ |
| **G30** | Không còn vết nhà cung cấp cũ | `grep -rn "ANTHROPIC\|@anthropic-ai/sdk\|claude-" app/ lib/ scripts/ tests/ package.json` ⇒ **rỗng** (`OP-M10`) | ⬜ | ⬜ |
| **G31** | Chặn cứng song song Golden 3–5 | `node scripts/check_env.mjs --reject-out-of-range GOLDEN_CONCURRENCY=9` ⇒ **exit 1** (`OP-M11`, `P04-C9`) | ⬜ | ⬜ |

### 7.3 — Cổng tầng 2 (P05) — CHỈ mở khi G01–G18 **và G27–G31** đều ✅ local `[Đ03 / BB-12]`

| Gate | Nội dung | Lệnh | local | deploy |
| :-- | :-- | :-- | :-- | :-- |
| G19 | BB-03 · lệnh ghi có precheck | `node scripts/validate_capabilities.mjs` ⇒ `write_without_precheck: 0` | ⬜ | ⬜ |
| G20 | BB-02 · hai trục thời gian tách rời | `node scripts/validate_policy.mjs` ⇒ `separated: true` | ⬜ | ⬜ |
| G21 | Chống đặt chỗ hai lần | `npm run test -- idempotency` ⇒ 1 dòng `bookings` | ⬜ | ⬜ |
| G22 | Kịch bản 23:39: đọc chính sách trước, 0 lệnh ghi lãng phí | `node scripts/demo_2339.mjs` ⇒ 6 bước, 1 lời gọi policy, 0 lời gọi ghi | ⬜ | ⬜ |
| G23 | Biên nhận + hoàn tác | `select count(*) from receipts where action='cancel' and undo_capability_id is not null` = **0** | ⬜ | ⬜ |

### 7.4 — Cổng trình diễn (P06)

| Gate | Nội dung | local | deploy |
| :-- | :-- | :-- | :-- |
| G24 | 6 câu hỏi D1–D6 (`00-ARCHITECTURE` §7) ra đúng 6 kết quả | ⬜ | ⬜ |
| G25 | Runbook `OPERATIONS.md` §11 chạy trọn, không vấp | ⬜ | ⬜ |
| G26 | Video dự phòng 3 phút mở được | ⬜ | ⬜ |

**Trạng thái lúc viết SPEC (2026-09-20 02:19 +0700):** 0/26 gate xanh — repo chưa có
dòng mã nào. Đây là mốc gốc.

**Cập nhật 2026-09-20 11:12 +0700** (mốc lấy bằng `date "+%Y-%m-%d %H:%M:%S %z"`), sau
khi đổi nhà cung cấp model sang Gemini `[Đ17/Đ18/Đ19]`: **tổng cổng nay là 31**, thêm
**G27–G31** ở §7.2. Năm cổng mới đều nhắm vào đúng chỗ việc đổi nhà cung cấp có thể hỏng
**im lặng** — số chiều embedding, chuẩn hoá vector, `responseSchema` bị từ chối, vết nhà
cung cấp cũ còn sót, và chặn hạn mức. **CẤM đóng kế hoạch khi còn cổng `⬜` ở cột
`deploy`** (`T-C7`).

---

## 8. Bảng phân loại lỗi khi chạy test

| Triệu chứng | Nghĩa là gì | Hành vi BẮT BUỘC |
| :-- | :-- | :-- |
| Test luôn xanh kể cả khi phá | Bộ đo không đo gì | Sửa test. **CẤM** tick gate (§6, luật 3) |
| `T-EVAL` fail vì 1 case | Có thể là dữ liệu Golden sai, không phải sản phẩm sai | Mở `/bql/trace`, đọc checkpoint nào fail, rồi mới kết luận |
| `T-EVAL` fail vì > 6 case answerable | Hỏng hệ thống | Dừng, không sửa Golden cho khớp sản phẩm |
| **Sửa Golden để test xanh** | Gian lận | **CẤM tuyệt đối.** Sửa Golden phải tăng revision + ghi `plan.md` §2 |
| `429` khi chạy Golden | Hết hạn mức — song song quá cao hoặc chạy quá dày | Giảm `GOLDEN_CONCURRENCY` về **3**, nghỉ ≥60s (`OPERATIONS` §9.3). **CẤM** hạ về tuần tự rồi coi là đã sửa — tuần tự chỉ giấu triệu chứng |
| **`503` *"high demand"* khi chạy Golden** | Quá tải phía nhà cung cấp | Để backoff xử. Dày đặc ⇒ dừng lượt chạy, **CẤM** tick gate bằng lượt chạy dở |
| **Gate model xanh nhưng chưa từng đỏ** | Rất có thể mẫu grep đã lỗi thời (xanh giả) | Chạy bằng chứng đỏ `R10` (§6.5). Xem `00-ARCHITECTURE.md` §BB-07.b |
| **Retrieval trả kết quả "hơi sai" mà không lỗi gì** | Trộn hai không gian vector (lệch model / lệch số chiều / quên chuẩn hoá L2) | Chạy `G27`+`G28`. **CẤM** chỉnh trọng số `S1` để che (`01-CONTRACTS.md` §4.3) |
| Gate xanh local, đỏ deploy | Lệch môi trường (thường là `RETRIEVAL_MODE` hoặc thiếu `GEMINI_API_KEY` trên Vercel) | Sửa env. **CẤM** tick cột deploy bằng bằng chứng local |
| `probe_defects` in `MISMATCH` | P00 hoặc P02 sai | Đọc `SPEC-P00` §5.4 ba bẫy trước khi đổ lỗi cho pipeline |

---

## 9. Vùng cấm của file này

| # | CẤM | Lý do |
| :-- | :-- | :-- |
| T-C1 | CẤM sửa Golden để test xanh | Gian lận. Golden là hợp đồng đo |
| T-C2 | CẤM tick gate bằng lời agent con | §1 luật 1 |
| T-C3 | CẤM tick cột `deploy` bằng bằng chứng chạy local | Hai môi trường, hai cột |
| T-C4 | CẤM chỉnh `TAU_ANSWER`/`TAU_FAITHFUL` để qua gate | `SPEC-P02` §6.5 — xem §6.4 |
| T-C5 | CẤM dùng `KILL_SWITCH_AGENTS` để qua gate | `OPERATIONS` §7 |
| T-C6 | CẤM bỏ `npm run build` vì "chạy dev được rồi" | Vercel build khác dev build |
| T-C7 | CẤM đóng kế hoạch khi còn gate `⬜` ở cột deploy | `AGENTS.md` §3 mục 2.4 |
| T-C8 | CẤM chạy Golden với song song **ngoài khoảng 3–5** | `OPERATIONS` `OP-C5`, `[Đ19]`. *(Luật cũ ghi "CẤM chạy song song" — đã thay, vì đo được 15 song song qua hết 15/15; cái phải cấm là **thả không giới hạn**, không phải song song)* |
| T-C9 | CẤM thêm gate mới mà không cập nhật `plan.md` §4 | Checklist và gate phải khớp |
| T-C10 | CẤM tick `G15` bằng một lượt XANH mà không có lượt ĐỎ `R10` đi kèm | Mẫu grep lỗi thời vẫn in `violations: 0`. Đã chứng minh (`00-ARCHITECTURE.md` §BB-07.b) |
| T-C11 | CẤM sửa DDL `vector(384)`, hoặc cắt bớt vector, để "cho khớp" đầu ra embedding | `C-08`. Đúng cách là truyền `outputDimensionality: 384` |
| T-C12 | CẤM bỏ `responseSchema` để qua `G29` | Bỏ nó thì `G29` mất đối tượng đo. `responseSchema` bị từ chối ⇒ **dừng và hỏi người** (`01-CONTRACTS.md` §11) |
| T-C13 | CẤM gọi API Gemini ngoài lúc chạy gate | `OP-C12` — hạn mức là tài nguyên chung và đang khan |

---

## 10. Mẫu report bắt buộc của worker

```text
Dòng 1: Vai · thi công/thẩm định · <họ/model> · Bước 0 exit: <mã> · Hiểu việc: <…>
Dòng 2: Lệnh đã chạy + exit code nguyên văn (dán, không tóm tắt)
Dòng 3: test tổng/pass/fail/skip
Dòng 4: `git diff --stat` + SHA
Dòng 5: Bảng gate: mã gate → local ✅/⬜ → deploy ✅/⬜ → lệnh + output làm bằng chứng
Dòng 6: Output **7** lần ĐỎ ở §6.5 (`R6`–`R12`) — thiếu `R10` ⇒ `G15` không được tick
Dòng 7: Bảng phân công thực tế (gói → tầng yêu cầu → họ/model đã dùng)
Dòng 8: Việc KHÔNG làm + lý do
Dòng 9: Câu hỏi cần người
```

Thiếu dòng 5 hoặc dòng 6 ⇒ **report bị trả lại**, không xem tiếp.
