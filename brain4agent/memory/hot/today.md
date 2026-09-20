# 📅 Nhật Ký Làm Việc Ngày 2026-09-19 (Session Memory Log)

> Cập nhật lúc: `2026-09-20T02:55:00.000Z` | Phiên bản: `v1.0.0-p00`

---

## 🏁 Phiên 2026-09-20 (tiếp) — Gói P01a: nền tảng chạy được không cần key

### 🎯 Bối cảnh chỉ đạo:
Chủ tịch: *"làm hết những cái gì chưa cần api key đã nhé"*. SO cắt P01 theo
`OPERATIONS.md` §4 (10 bước dựng): 4 bước không cần tài khoản ⇒ làm ngay; 6 bước
cần Neon/Vercel/key ⇒ để lại, ghi rõ chặn ở đâu.

### 🎯 Đã làm:
- Viết `handoffs/H03_p01a-nen-tang-offline.md`, phóng worker. **Trước khi phóng,
  bắt được một lệch của chính mình:** bản nháp ghi `lib/db/` cho tầng kết nối;
  đối chiếu `00-ARCHITECTURE.md` §5 thì `lib/adapters/db.ts` mới là file DUY NHẤT
  được mở connection ⇒ `lib/db/` sẽ vi phạm BB-07 ngay ở gói đầu tiên. Sửa handoff
  rồi mới giao. (Đúng loại lỗi G03 của phiên này, lần này chặn được trước.)
- Worker dựng: `app/` (login + route 2 vai), `lib/types.ts` (enum 15 mã reason_code),
  `lib/adapters/db.ts` + `lib/adapters/anthropic.ts`, `lib/auth/` (scrypt + cookie
  HMAC), `lib/retrieval/query.ts` (giữ cờ chuẩn hoá 32), `db/migrations/` 4 file
  theo thứ tự khoá ngoại, 5 script vận hành (soạn mã, chưa chạy), 3 script bất
  biến, `tests/` 13 ca.
- **SO đo lại độc lập:** `npx tsc --noEmit` exit 0 · `npm run build` KHÔNG có
  `DATABASE_URL` exit 0 với 8/9 route dynamic · `npm test` 13/13 · ba script bất
  biến exit 0 · P00 không hồi quy.
- **SO tự thiết kế 4 phép phá khác worker**, cả bốn ĐỎ đúng rồi tái xanh: rò SDK
  Anthropic ngoài adapter · rò connection Neon ngoài adapter · hardcode
  `OCP1-POOL-RULES-001` vào code · prop `confidence` render ra UI.
  ⇒ BB-05/BB-07/BB-10 **đã chứng minh**, không chỉ "xanh". **✅ DUYỆT.**

### 🎯 Quyết định của phiên:
- **Đ15** — `db:migrate:down` trả exit 2 thay vì giả vờ chạy được. Không có DB thì
  không kiểm chứng được đường lùi; ship rollback chưa từng chạy còn nguy hiểm hơn
  là nói thẳng chưa có. **Nợ phải trả:** dòng "Migration hỏng" ở `OPERATIONS.md`
  §8 CHƯA được thoả mãn — khi có `DATABASE_URL` phải thêm bảng `schema_migrations`
  và chứng minh bằng một lần migrate-lên-rồi-down-về thật.
- **Đ16** — `.gitignore` thêm `!.env.example` và `*.tsbuildinfo`. Pattern `.env*`
  nuốt luôn file mẫu, người clone repo sẽ không biết cần biến gì.
- `lib/types.ts` (file) thắng `lib/types/` (thư mục) mà H03 ghi nhầm — contract
  thắng handoff.

### ⚠️ Lỗi của SO trong phiên, ghi để không lặp:
- Lại dẫm G02: chạy `python -c "..."` qua Bash với nội dung chứa backtick ⇒ bash
  nuốt sạch phần trong backtick, `today.md` bị ghi hỏng (mất toàn bộ tên file,
  tên biến). Đã `git checkout` khôi phục rồi viết lại qua file. **Luật rút ra:**
  nội dung tiếng Việt có backtick thì LUÔN ghi ra file bằng công cụ ghi file, rồi
  mới cho python đọc file đó — không nhúng thẳng vào lệnh shell.

### ⏳ Đang chờ (đều ngoài tầm agent):
- `DATABASE_URL` (Neon) — chặn migrate, seed, K-M5, và toàn bộ P02.
- `ANTHROPIC_API_KEY` — key `sk-` chủ tịch cấp bị TokenRouter từ chối (đòi `tr_`);
  chủ tịch đang soi lại dashboard.
- Tài khoản Vercel (C-04) — chặn R1 deploy.

⇒ **Phần không cần key của P01 đã hết việc.** Mọi thứ còn lại đều đụng một trong ba
thứ trên. Gói kế tiếp khi có DB: P01b (migrate + seed + deploy) rồi P02.

---

## 🏁 Phiên 2026-09-20 (chiều) — Chốt C-01…C-04, thi công và nghiệm thu gói P00

### 🎯 Đã làm:
- **Đo key do chủ tịch cấp, không dùng được như chỉ định (Đ13).** `stealth/union-alpha`
  qua TokenRouter: `GET api.tokenrouter.io/v1/models` trả `401` — *"Pass
  `Authorization: Bearer tr_...`"*; docs TokenRouter chỉ có `/v1/chat/completions`,
  **không có endpoint embeddings**; quy ước tên model của họ là `openai:`/`anthropic:`/
  `gemini:`, không có dạng `stealth/…`. Tra ra `stealth/union-alpha` là slug của
  **OpenRouter** (ra 2026-09-16, free preview có hạn). Phép đo cuối (bắn key lên
  OpenRouter) **bị sandbox chặn** — đã đưa lệnh `curl` cho người chạy tay.
  ⇒ **CHƯA đổi contract model**, A1/A2/A3 vẫn là Claude.
- **Rút yêu cầu "key embedding" (Đ14).** Đọc kỹ `01-CONTRACTS.md` §4.3 thì architect
  đã chốt `Xenova/multilingual-e5-small` chạy TẠI CHỖ lúc seed, 384 chiều — không
  cần key của ai. Câu xin key hôm trước là do SO chưa đọc kỹ §4.3.
- **Sửa một phát biểu SAI trong `plan.md`:** "Gói P00 chưa được phóng vì C-01 chưa
  chốt". `SPEC-P00` §7 P00-C6 CẤM sinh Knowledge Pack bằng LLM ⇒ P00 không cần key
  model nào. P00 chưa bao giờ bị C-01 chặn.
- **C-02 GẬT** (HITL chỉ cho lượt escalate), **C-03 GẬT** (bỏ Metric 2 Efficiency —
  căn cứ có sẵn ở `SPEC-P00` §6.1, gỡ trạng thái "chưa có căn cứ" ở Idea Vault),
  **C-04 vẫn chờ người** (tài khoản Vercel).
- **Phóng và nghiệm thu gói P00.** Viết `handoffs/H02` (63 dòng, tự chứa), giao
  worker thi công. Kết quả trên đĩa: `knowledge/` 19 tài liệu / 98 section + 4
  khuyết tật cài sẵn, `evals/golden/` 66 case, `scripts/` 3 script kiểm Node thuần,
  `package.json` (ESM, 0 dependency).
- **SO đo lại độc lập, không tin report worker** (Luật K.5): K-M1 `19 · 98 · 4/4`,
  K-M2 `50 (40) · 16 · 10/10`, K-M3 rỗng, K-M4 `13 true / 1 false` — tất cả exit 0.
  Tự thiết kế **2 phép phá khác worker**: bơm "pickleball" vào `SPORTS-SCOPE-01` ⇒
  `DefectMissingError` exit 1; xoá dòng mang mã `source_conflict` ⇒ `GoldenCountError`
  + `CoverageError` exit 1. Cả hai phục hồi tái xanh. ⇒ **✅ DUYỆT**.

### 🎯 Quyết định của phiên:
- Giữ Claude cho 3 agent cho tới khi có key đo được tận tay — không đặt đường găng
  của bài bị chấm lên một model ẩn danh có thể bị rút giữa tuần demo.
- `FAC-FISHING-DECK` vs `FAC-FISHING-LAKE`: thống nhất `FAC-FISHING-LAKE` (theo §3.4/§4
  vì đó là nguồn tính số nghiệm thu K-M4), sửa `SPEC-P00` §3.2.
- `evals/golden/rubric.md` chuyển sang gói P04.

### ⚠️ Lỗi của SO trong phiên này, ghi để không lặp:
- `handoffs/H02` cấp nhầm đường dẫn (`knowledge/expected_defects.json`, `golden/*.jsonl`)
  lệch `SPEC-P00` §2 (`evals/golden/`) ⇒ cổng K-M3 đỏ GIẢ dù dữ liệu lành. Worker
  làm đúng và báo lên thay vì tự sửa SPEC. Đã ghi thành gotcha **G03**.
- Phép thử "đỏ" đầu tiên của SO dùng mã `out_of_scope` không tồn tại trong bộ ⇒
  tưởng script bỏ sót. Ghi thành gotcha **G05**.

### ⏳ Đang chờ:
- **Người chạy `curl` lên OpenRouter** để biết key `sk-…` thuộc nhà nào (sandbox chặn SO).
- **C-04 — tài khoản Vercel** (OPERATIONS §1 đòi deploy từ D2 = 2026-09-21).
- K-M5 cần `DATABASE_URL` Neon; K-M6 cần P02.
- Gói kế tiếp: **P01** (nền tảng, auth 2 vai, ingest, deploy 🟠 D2).

---

## 🏁 Phiên 2026-09-20 — Thiết kế SPEC hồ sơ Resident Agent v1.0 + đồng bộ não

### 🎯 Đã làm:
- Mở hồ sơ kế hoạch `planning/01_2026-09-20_resident-agent-v1/`. Nạp 6 đặc tả
  v0.2 kế thừa từ `docs/` + 3 ảnh tham chiếu `docs/assets/`.
- Chốt 12 quyết định kiến trúc Đ01–Đ12 trong `plan.md` §2 (rubric thay vì v0.2,
  mô phỏng toàn phần, cổng P05 sau P01–P04, khuyết tật cài sẵn trong Knowledge
  Pack, đảo nghĩa `pii_or_account_specific`, confidence 4 tín hiệu, agent verify
  vừa là chốt chặn vừa là thước đo, bất biến "thao tác được ≠ được giải thích
  luật", chính sách đọc-trước-khi-ghi, stack Next.js/Vercel/Neon+pgvector/Claude,
  giữ 10 reason code canonical + thêm nhóm hành động).
- Architect viết đủ **9 file SPEC** trong `specs/` (3711 dòng). Super Orchestrator
  tự đo lại và **DUYỆT** — số đo chép trong
  `planning/01_2026-09-20_resident-agent-v1/reports/R01_specs-design.md`.
- Worker (phiên này): `git init` repo (trước đó chưa là git repository, tạo
  `.gitignore` tối thiểu, branch `main`); viết `reports/R01_specs-design.md`;
  tick 9 dòng bảng Mục 5 của `plan.md` thành `✅`; đồng bộ 8 file não theo Ma
  Trận 6 Điểm + 2 file mở rộng (project-intro, -data-architecture) do dự án
  thêm thư mục top-level mới (`planning/`, đổi nghĩa `docs/`) và đưa vào
  stack mới (Next.js/TypeScript/Postgres).

### 🎯 Quyết định của phiên này (worker, trong phạm vi được giao):
- Không tự quyết bất cứ điều gì ngoài phạm vi cấp — mọi quyết định kiến trúc
  đã chốt sẵn trong `plan.md` §2, worker chỉ phản ánh vào não.
- Ghi nhận 1 câu hỏi mở: không tìm thấy căn cứ tường minh cho việc "Metric 2
  Efficiency" từng tồn tại rồi bị rút — không bịa, để trong `roadmap.md` Idea
  Vault kèm ghi chú "chưa đo được".

### ⏳ Đang chờ:
- Toàn bộ P00–P06 chưa bắt đầu thi công. Bước kế tiếp theo `plan.md` §3: P00
  (Knowledge Pack mô phỏng + Golden Dataset, tầng 🔴, D1–D2).
- Repo hiện chỉ có 1 commit local, chưa push, chưa có remote (đúng theo phạm vi
  được cấp — CẤM push/tạo remote ở phiên này).

---
