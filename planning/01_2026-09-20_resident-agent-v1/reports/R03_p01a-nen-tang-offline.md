# R03 — Báo cáo thi công gói P01a: nền tảng chạy được KHÔNG CẦN key/tài khoản

Vai: worker (vai-thi-cong) · loại: thi công · họ/model: Claude · Sonnet 5 · Bước 0 exit=0 · hiểu việc: phạm vi = khung Next.js + TS strict, lib/types, DDL (soạn mã không chạy), auth scrypt+HMAC, retrieval lexical query builder, 3 script kiểm BB-05/07/10, tests; xong khi = 10 lệnh W1–W10 ở bảng §3 handoff đều đúng kết quả nêu; cấm (bằng lời mình) = không chạm DATABASE_URL/ANTHROPIC_API_KEY/Vercel, không tạo `lib/db/` hay module thứ hai mở connection/import SDK Anthropic, không prerender route chạm DB lúc build, không `git commit`/`push`, không sửa `knowledge/`/`evals/`/3 script P00/`specs/`/`plan.md`/`brain4agent/`/`docs/`/`AGENTS.md`/`CLAUDE.md`/`.gitignore`.

Handoff: H03_p01a-nen-tang-offline
Base: `010a8d3c4cd4a704de4ebe85a5077d4aeffc6500`
Head: chưa commit — worker bị cấm commit

---

## 1. Lệnh §3 và exit code nguyên văn

| WP | Lệnh đã chạy | Exit | Evidence |
| :-- | :-- | :-- | :-- |
| — | `npm install` | `0` | `evidence/p01a/npm_install.txt` |
| W1 | `npx tsc --noEmit` | `0` | `evidence/p01a/w1_tsc.txt` |
| W2 | `npm run build` (KHÔNG đặt `DATABASE_URL`) | `0` | `evidence/p01a/w2_build.txt` — tất cả route trừ `/_not-found` đều `ƒ (Dynamic)`, không route nào bị prerender |
| W3 | `npm test` — ca `REASON_CODES` có 15 phần tử | `0` (13/13 pass) | `evidence/p01a/w3_w4_w5_w6_test.txt` |
| W4 | `node --check` trên 5 script mới + `npm test` — ca đọc `db/migrations/*.sql` khẳng định đủ 8 bảng | `0` / `0` | `evidence/p01a/w4_node_check.txt`, `w3_w4_w5_w6_test.txt` |
| W5 | `npm test` — hash/verify đúng-sai, cookie sửa 1 byte ⇒ `false` | `0` | `w3_w4_w5_w6_test.txt` |
| W6 | `npm test` — chuỗi SQL có `ts_rank_cd(..., 32)` | `0` | `w3_w4_w5_w6_test.txt` |
| W7 | `bash scripts/check_adapter_boundary.sh` | `0`, `violations: 0` | `w7_boundary_green_after.txt` |
| W8 | `bash scripts/check_no_hardcoded_knowledge.sh` | `0`, `matches: 0` | `w8_hardcoded_green_after.txt` |
| W9 | `bash scripts/check_no_confidence_ui.sh` | `0`, `matches: 0` | `w9_confidence_green_after.txt` |
| W10 | `node scripts/validate_knowledge.mjs` / `node scripts/validate_golden.mjs` | `0` / `0` | `w10_validate_knowledge.txt` (`documents: 19 · sections: 98 · defects_ok: 4/4`), `w10_validate_golden.txt` (`faq: 50 (answerable 40) · safety: 16 · canonical_codes_covered: 10/10`) |

`npm test` tổng: **13 pass / 0 fail / 0 skip** (13 tổng).

## 2. Bảng 3 phép ĐỎ bắt buộc (Luật K.5)

| Script | Vi phạm giả đã tạo | Output ĐỎ (nguyên văn, rút gọn) | Exit đỏ | Evidence đỏ | Sau khi gỡ |
| :-- | :-- | :-- | :-- | :-- | :-- |
| W7 `check_adapter_boundary.sh` | Thêm `import Anthropic from "@anthropic-ai/sdk"` vào `lib/retrieval/query.ts` | `--- import @anthropic-ai/sdk ngoài lib/adapters/ ---` / `lib/retrieval/query.ts:35:...` / `violations: 1` | `1` | `evidence/p01a/w7_boundary_RED.txt` | `violations: 0`, exit `0` (`w7_boundary_green_after.txt`) |
| W8 `check_no_hardcoded_knowledge.sh` | Thêm `export const __TEMP_DOC_ID = "OCP1-POOL-RULES-001";` vào `lib/types.ts` | `lib/types.ts:138:export const __TEMP_DOC_ID = "OCP1-POOL-RULES-001";` / `matches: 1` | `1` | `evidence/p01a/w8_hardcoded_RED.txt` | `matches: 0`, exit `0` (`w8_hardcoded_green_after.txt`) |
| W9 `check_no_confidence_ui.sh` | Thêm hàm `TempConfidenceBadge` in `<span>Độ tin cậy: 92%</span>` vào `app/(resident)/chat/page.tsx` | 2 dòng khớp (`confidence` trong comment + `Độ tin cậy`) / `matches: 2` | `1` | `evidence/p01a/w9_confidence_RED.txt` | `matches: 0`, exit `0` (`w9_confidence_green_after.txt`) |

Sau mỗi phép đỏ đã gỡ vi phạm bằng `sed` và chạy lại `npx tsc --noEmit` (`0`) + `npm test` (13/13 pass) + `npm run build` (`0`) để xác nhận không có tác dụng phụ.

## 3. `git status --short` (nguyên văn, xem `evidence/p01a/git_status.txt`)

```
 M package.json
?? app/
?? db/
?? lib/
?? next-env.d.ts
?? next.config.mjs
?? package-lock.json
?? planning/01_2026-09-20_resident-agent-v1/handoffs/H03_p01a-nen-tang-offline.md
?? planning/01_2026-09-20_resident-agent-v1/reports/R03_p01a-nen-tang-offline.md
?? planning/01_2026-09-20_resident-agent-v1/evidence/p01a/
?? scripts/check_adapter_boundary.sh
?? scripts/check_no_confidence_ui.sh
?? scripts/check_no_hardcoded_knowledge.sh
?? scripts/dump_schema.mjs
?? scripts/migrate.mjs
?? scripts/seed_knowledge.mjs
?? scripts/seed_users.mjs
?? scripts/sql.mjs
?? tests/
?? tsconfig.json
```

`git diff --stat`: **59 files changed, 2880 insertions(+), 1 deletion(-)** (nguyên văn ở `evidence/p01a/git_diff_stat.txt`). `git rev-parse HEAD` sau toàn bộ thao tác vẫn là `010a8d3c4cd4a704de4ebe85a5077d4aeffc6500` — chưa commit gì (đúng cấm §2).

## 4. Bảng phân công thực tế

| WP | Tầng yêu cầu (handoff §5) | Tầng đã dùng | Ghi chú |
| :-- | :-- | :-- | :-- |
| W1 | 🟠 | 🟠 | Khung Next.js + tsconfig strict, có contract rõ + `tsc --noEmit` tự biết đúng/sai |
| W2 | 🟠 | 🟠 | Cấu hình route dynamic để build không cần DB, test tự biết đúng/sai qua exit code |
| W3 | 🟠 | 🟠 | `lib/types.ts` chép đúng 01-CONTRACTS.md §7 |
| W4 | 🔴 | 🔴 | DDL — tự ra quyết định thứ tự file migration để né lỗi FK (users trước documents), có neo lý do trong chính file SQL |
| W5 | 🔴 | 🔴 | scrypt + HMAC — ranh giới bảo mật, quyết định độ dài salt/key, cách so sánh timing-safe |
| W6 | 🟠 | 🟠 | Chép nguyên văn câu SQL §4.2, chỉ bọc hàm |
| W7 | 🟠 | 🟠 | Script grep theo đúng công thức 00-ARCHITECTURE.md §9/§11 |
| W8 | 🟠 | 🟠 | Script grep theo đúng công thức, có điều chỉnh phạm vi loại trừ (xem mục 5.2) |
| W9 | 🟠 | 🟠 | Script grep theo đúng công thức BB-05 |
| W10 | 🟢 | 🟢 | Chạy lại 2 script có sẵn của P00, không sửa gì |

Không có gói nào thiếu model đúng tầng.

## 5. Việc KHÔNG làm + lý do

1. **OPERATIONS.md §4 bước 2, 3, 5, 6, 7, 10** — cần `DATABASE_URL`/Vercel, đúng như handoff §1 cấm. Không chạy `db:migrate`, `db:seed:users`, `db:seed:knowledge`, `vercel --prod`, `eval:golden`. Đã **viết mã** cho `scripts/migrate.mjs`, `scripts/seed_users.mjs`, `scripts/seed_knowledge.mjs` nhưng **không chạy** — đúng scope "viết mã, KHÔNG chạy".
2. **`lib/pipeline/` (A1/A2/A3), gọi model thật** — thuộc P02, không đụng. `lib/adapters/anthropic.ts` chỉ có client factory lười + type `SupportedModel`, không có hàm `runClassifier`/`runRetriever`/`runVerifier`.
3. **`npm run eval:golden`** — không thêm script này vào `package.json`. Lý do: chạy Golden qua pipeline thật thuộc P02 (cần model), thêm một script rỗng/giả sẽ gây hiểu lầm là đã có pipeline.
4. **Nội dung UI thật** (chat trả lời, danh sách tài liệu, hàng đợi duyệt, số eval/dashboard) — chỉ có khung trang tồn tại + phân quyền vai qua cookie HMAC, đúng "nội dung để P02/P03/P04 bồi" (handoff §2).
5. **ESLint** — không thêm cấu hình lint. Không nằm trong danh sách W1–W10; thêm vào sẽ là mở rộng phạm vi ngoài "xong khi" đã liệt kê.

## 6. Ghi chú SPEC (không tự sửa, báo lại)

1. **Xung đột `.gitignore` với yêu cầu `.env.example`** — `.gitignore` dòng 2 là `.env*`, nên `git check-ignore -v .env.example` trả về khớp (`.gitignore:2:.env*  .env.example`). File `.env.example` đã được tạo đúng nội dung (OPERATIONS.md §3, giá trị rỗng) nhưng **sẽ không bao giờ commit được** với `.gitignore` hiện tại — không phải do worker thiếu `git add`, mà do pattern chặn đúng cả tên file mẫu. `.gitignore` nằm trong danh sách CẤM chạm của handoff §2 nên không tự sửa. Cần người quyết: đổi pattern thành `.env.local` + `.env*.local` (giữ chặn `.env`, `.env.local` nhưng cho `.env.example` lọt) hoặc thêm dòng `!.env.example`.
2. **`lib/types/` (handoff §2) vs `lib/types.ts` (01-CONTRACTS.md §7 "nguồn chân lý kiểu")** — hai văn bản không khớp nhau về việc đây là thư mục hay file. Đã chọn theo 01-CONTRACTS.md (văn bản có chữ ký chính xác hơn, tự gọi mình là "nguồn chân lý kiểu"), tạo `lib/types.ts` (file đơn), không tạo thư mục `lib/types/`.
3. **Thứ tự bảng trong 01-CONTRACTS.md gây lỗi FK nếu chép nguyên văn thành một script** — §3.1 định nghĩa `documents.uploaded_by REFERENCES users(id)`, nhưng bảng `users` chỉ xuất hiện sau, ở §6. Nếu nối toàn văn §3 rồi §6 thành một file SQL chạy tuần tự, `CREATE TABLE documents` sẽ lỗi vì `users` chưa tồn tại. Đã xử lý bằng cách tách `users` thành `db/migrations/002_users.sql`, chạy TRƯỚC `003_knowledge.sql` (chứa `documents`/`sections`/`chunks`) — giữ nguyên 100% cột/kiểu của cả hai bảng, chỉ đổi thứ tự file. Đã ghi chú thẳng trong `002_users.sql`.
4. **`OPERATIONS.md` §4 bước 1 ghi `npx create-next-app@latest --ts`** — không chạy lệnh này nguyên văn vì thư mục làm việc không rỗng (đã có `knowledge/`, `evals/`, `scripts/`, `.git/`, `package.json` của P00) và lệnh chạy tương tác sẽ hỏi ghi đè/xoá. Thay vào đó đã **tự dựng thủ công** đúng bộ file mà `create-next-app --ts` sinh ra cho App Router (`package.json` deps, `tsconfig.json`, `next.config.mjs`, `next-env.d.ts`, `app/layout.tsx`) rồi `npm install` — "xong khi" của W1 (`npx tsc --noEmit` exit 0) và W2 (`npm run build` exit 0) đều đạt.
5. **`db:migrate:down`** — `OPERATIONS.md` §8 nhắc `npm run db:migrate:down -- --to=<version>` nhưng không có bảng lịch sử migration nào được đặc tả trong 01-CONTRACTS.md/OPERATIONS.md để biết "đã áp bản nào". `scripts/migrate.mjs --down` hiện in cảnh báo + thoát mã `2` thay vì âm thầm không làm gì hoặc giả vờ chạy được — cần người quyết có dựng bảng `schema_migrations` trong vòng 1.0.0 hay chấp nhận rollback thủ công.

## 7. Câu hỏi cần người

1. Quyết định mục 6.1 (`.gitignore` chặn `.env.example`) — đổi pattern hay chấp nhận không bao giờ commit được file mẫu?
2. Xác nhận cách xử lý mục 6.3 (thứ tự migration users→knowledge→operational) có được chấp nhận là "không đổi hợp đồng, chỉ đổi thứ tự file" hay cần Super Orchestrator ghi lại thành một quyết định chính thức trong `plan.md` §2 (worker không được tự sửa `plan.md`, chỉ nêu ở đây theo đúng luật §5.K.2 "không tự quyết").

---

**Không tự phán quyết.** Super Orchestrator đo lại và ra `✅ DUYỆT` / `🔁 SỬA` / `⛔ DỪNG`.

---

## Phán quyết của Super Orchestrator — 2026-09-20

Đã **đo lại toàn bộ, không dùng số của worker**. Bằng chứng: `evidence/p01a/so-remeasure.txt`, `evidence/p01a/so-red-tests.txt`.

| Cổng | SO đo lại | Kết quả |
| :-- | :-- | :-- |
| W1 | `npx tsc --noEmit` | exit 0 ✅ |
| W2 | `env -u DATABASE_URL npm run build` | exit 0; 8/9 route `ƒ Dynamic`, chỉ `/_not-found` static ✅ |
| W3–W6 | `npm test` | `tests 13 · pass 13 · fail 0 · skipped 0` ✅ |
| W7 | `bash scripts/check_adapter_boundary.sh` | `violations: 0` · exit 0 ✅ |
| W8 | `bash scripts/check_no_hardcoded_knowledge.sh` | `matches: 0` · exit 0 ✅ |
| W9 | `bash scripts/check_no_confidence_ui.sh` | `matches: 0` · exit 0 ✅ |
| W10 | `validate_knowledge.mjs` · `validate_golden.mjs` | cả hai exit 0, không hồi quy P00 ✅ |
| Phạm vi | `git status --short` | 0 file ngoài phạm vi H03 ✅ |

**Bộ đo mới phải từng ĐỎ — SO tự thiết kế 4 phép phá KHÁC worker:**

| # | Phép phá của SO | Kết quả |
| :-- | :-- | :-- |
| 1 | `lib/so_probe_bb07.ts` import `@anthropic-ai/sdk` ngoài `lib/adapters/` | `violations: 1` · exit 1 ✅ |
| 2 | `lib/so_probe_db.ts` import `@neondatabase/serverless` ngoài `lib/adapters/` | `violations: 1` · exit 1 ✅ |
| 3 | `lib/so_probe_bb10.ts` hardcode `"OCP1-POOL-RULES-001"` | `matches: 1` · exit 1 ✅ |
| 4 | `app/so_probe_ui.tsx` nhận prop `confidence` và render `{confidence}%` | `matches: 2` · exit 1 ✅ |

Cả bốn gỡ xong đều xanh lại, không sót file thăm dò. **BB-05, BB-07, BB-10 có mã nguồn và đã chứng minh bắt được vi phạm thật.**

### Năm ghi chú của worker — SO trả lời

1. **`.gitignore` chặn `.env.example`: worker đúng, SO đã sửa.** Pattern `.env*` nuốt luôn file mẫu. Thêm `!.env.example` (và `*.tsbuildinfo`). Kiểm: `git add --dry-run .env.example` → `add '.env.example'`. Worker bị cấm chạm `.gitignore` nên báo lên — xử lý đúng.
2. **`lib/types/` vs `lib/types.ts`: worker chọn ĐÚNG.** `01-CONTRACTS.md` §7 tự xưng là nguồn chân lý kiểu và nói rõ `lib/types.ts`. H03 của SO ghi `lib/types/` là cẩu thả; contract thắng handoff.
3. **Thứ tự FK trong migration: worker xử lý ĐÚNG.** `01-CONTRACTS.md` trình bày `documents` (§3.1) trước `users` (§6) theo mạch đọc, không phải theo thứ tự chạy. Tách 4 file `001_enums` → `002_users` → `003_knowledge` → `004_operational` là đúng, nội dung từng bảng giữ nguyên.
4. **Không chạy `create-next-app` nguyên văn: chấp nhận.** Thư mục không rỗng nên lệnh đó sẽ hỏi tương tác — môi trường này không có stdin. Cổng W1/W2 vẫn đạt, tức kết quả tương đương. `OPERATIONS.md` §4 bước 1 ghi *lệnh kiểm* là `npx tsc --noEmit`, không đòi đúng lệnh khởi tạo.
5. **`db:migrate:down` trả exit 2: chấp nhận, xem Đ15 ở `plan.md` §2.** Không có DB thì không thể kiểm chứng một đường lùi; ship rollback chưa từng chạy còn tệ hơn script nói thẳng là chưa có.

**Việc chưa làm, SO xác nhận đúng phạm vi:** `OPERATIONS.md` §4 bước 2/3/5/6/7/10 (cần Neon/Vercel/key); `lib/pipeline/` (P02); `npm run eval:golden`; UI thật của P02–P04; ESLint.

✅ **DUYỆT**

---

## ĐÍNH CHÍNH phán quyết P01a — 2026-09-20, sau khi architect phản biện

**Phán quyết ✅ DUYỆT ở trên GIỮ NGUYÊN, nhưng một kết luận trong đó SAI và phải rút.**

Tôi đã viết: *"BB-05, BB-07, BB-10 có mã nguồn và đã chứng minh bắt được vi phạm thật."*
Vế về **BB-07 là sai**. Bốn phép phá tôi tự thiết kế đều rò bằng **import tên gói**
(`@anthropic-ai/sdk`, `@neondatabase/serverless`). Chúng chỉ chứng minh script bắt được
**tên gói**, không chứng minh nó canh được bất biến BB-07.

Architect gói R04 phản biện rằng script **xanh giả**. Tôi tự dựng lại phép phá để kiểm:

```text
$ cat lib/so_leak_probe.ts          # NẰM NGOÀI lib/adapters/
const HOST = "https://generativelanguage.googleapis.com/v1beta";
const KEY  = process.env.GEMINI_API_KEY;
export async function leak(model, body) {
  const url = `${HOST}/models/${model}:generateContent?key=${KEY}`;
  return fetch(url, { method: "POST", body: JSON.stringify(body) });
}

$ bash scripts/check_adapter_boundary.sh
violations: 0
EXIT=0          <-- XANH GIẢ. Rò cả host lẫn khoá mà không báo gì.
```

**Architect đúng, tôi sai.** Nguyên nhân: bản cũ chỉ bắt `fetch("https://…")` dạng **chuỗi
nguyên văn**; gán host vào biến rồi dùng template literal là lọt. Và nó **không hề canh
việc đọc bí mật** (`process.env.*`) ngoài adapter — trục đó bị bỏ trống hoàn toàn.

### Đã sửa và đã chứng minh lại

`scripts/check_adapter_boundary.sh` viết lại theo **bốn trục**, mỗi trục một mình đủ chặn:

| # | Trục | Phép phá của SO | Kết quả |
| :-- | :-- | :-- | :-- |
| 1 | import SDK nhà cung cấp | `import { GoogleGenAI } from "@google/genai"` | `violations: 1` · exit 1 ✅ |
| 2 | host nhà cung cấp ở bất kỳ dạng chuỗi nào | `const HOST = "https://generativelanguage.googleapis.com/v1beta"` | `violations: 1` · exit 1 ✅ |
| 3 | đọc bí mật ngoài adapter | `process.env.DATABASE_URL` | `violations: 1` · exit 1 ✅ |
| 4 | `fetch()` tới URL tuyệt đối, kể cả template | ``fetch(`${B}/v1/models`)`` | `violations: 1` · exit 1 ✅ |

Cây rò ban đầu (host + khoá) nay ra `violations: 2`, exit 1. Cây sạch ra `violations: 0`, exit 0.

### Bài học, đã ghi thành gotcha

Một bộ đo "đã từng đỏ" **chưa đủ**. Bốn phép phá của tôi đều **cùng một hình dạng** (import
tên gói) nên chỉ chứng minh được đúng một trục. Luật K.5 đòi bộ đo mới phải từng đỏ — nay
bổ sung: **phép phá phải khác nhau về HÌNH DẠNG, không chỉ khác về nội dung.** Xem `G12`.
