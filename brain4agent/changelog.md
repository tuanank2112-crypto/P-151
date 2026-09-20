# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

## [v1.0.0-gemini] - 2026-09-20: Đổi nhà cung cấp model sang Google Gemini
### Changed
- **A1/A2/A3 chuyển từ Claude sang Gemini** (Đ17): `gemini-3.5-flash-lite` /
  `gemini-3.5-flash` / `gemini-2.5-flash`. Tham số API đổi từ dạng Anthropic
  (`thinking`, `output_config`, `zodOutputFormat`) sang `generationConfig` +
  `responseMimeType` + `responseSchema`. Token đọc từ `usageMetadata`.
- **Adapter đổi tên** `lib/adapters/anthropic.ts` → `lib/adapters/model.ts` (BB-07.a).
  Bất biến vẫn là *thư mục* `lib/adapters/`, nên P01a giữ nguyên nghiệm thu.
- **Embedding** chuyển từ `Xenova/multilingual-e5-small` tại chỗ sang
  `gemini-embedding-001` + `outputDimensionality: 384` (Đ18). Bỏ `@xenova/transformers`.
  Giữ nguyên DDL `vector(384)`.
- Biến môi trường `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`.

### Added
- Bất biến BB-07.a/BB-07.b; vùng cấm mới C-09..C-13, OP-C11..OP-C14, P02-C13..P02-C15,
  P04-C9/C10, T-C10..T-C13; phép đo G27–G31 và R10–R12 trong `TESTING-ACCEPTANCE.md`.
- Seed tri thức tách **Pha A (mạng, có file đệm, chạy lại chỉ bù thiếu)** / **Pha B (DB,
  một transaction)** — vì seed nay tốn ≥97 lời gọi embedding, va thẳng vào trần hạn mức.
- Kill switch nay **ép `lexical`**: bật kill switch vì nhà cung cấp hỏng mà `hybrid` vẫn
  gọi embedding tới đúng nhà cung cấp đó thì phao cứu sinh thủng.

### Removed
- **Vùng cấm `OP-C8`** ("CẤM đặt `hybrid` trên Vercel") — mất căn cứ vì embedding nay là
  một lời gọi HTTP, chạy được trên serverless. Số hiệu để trống, không tái dùng.

### Fixed
- **`scripts/check_adapter_boundary.sh` từng XANH GIẢ** (Đ21): bản cũ chỉ bắt tên gói và
  `fetch("https://…")` chuỗi nguyên văn, bỏ lọt hoàn toàn việc gán host vào biến và đọc
  `process.env.GEMINI_API_KEY` ngoài adapter. Viết lại theo 4 trục, mỗi trục đã chứng
  minh đỏ độc lập.

### Measured
- Model: burst 15 song song qua 15/15; burst 40 thì 39 dính 429. Mọi bậc Pro trả 429.
  `gemini-3.7/3.8-flash` trả 503 ngay lần gọi đơn.
- `responseSchema` được chấp nhận trên cả ba model, tôn trọng `enum` (C-M11, hết nợ).
- `gemini-embedding-001` **chưa chuẩn hoá** khi ép chiều: |v|=1.000 ở 3072, **0.594** ở
  768, **0.435** ở 384 (C-M9, hết nợ) ⇒ bắt buộc tự `l2normalize` cho cả seed lẫn query.

## [v1.0.0-p01a] - 2026-09-20: P01a — nền tảng chạy được không cần key
### Added
- Khung Next.js + TypeScript strict (App Router). Route 2 vai: `app/login`,
  `app/(resident)/chat`, `app/(bql)/documents|review|eval|dashboard`.
- `lib/types.ts` — nguồn chân lý kiểu theo `01-CONTRACTS.md` §7, enum đúng 15 mã
  `reason_code` và 4 `lifecycle_state`.
- `lib/adapters/db.ts` và `lib/adapters/anthropic.ts` — hai file DUY NHẤT được mở
  connection / import SDK (BB-07). `lib/auth/` (scrypt + cookie HMAC ký bằng
  `SESSION_SECRET`). `lib/retrieval/query.ts` giữ cờ chuẩn hoá `32` (C-05).
- `db/migrations/` 4 file theo thứ tự khoá ngoại: `001_enums` → `002_users` →
  `003_knowledge` → `004_operational`. **Soạn mã, chưa chạy lần nào.**
- `scripts/`: `migrate.mjs`, `sql.mjs`, `dump_schema.mjs`, `seed_users.mjs`,
  `seed_knowledge.mjs` (soạn mã), cùng 3 script bất biến `check_adapter_boundary.sh`
  (BB-07), `check_no_hardcoded_knowledge.sh` (BB-10), `check_no_confidence_ui.sh` (BB-05).
- `tests/` 13 ca trên `node:test`, không cần DB.

### Measured
- `npx tsc --noEmit` exit 0 · `npm run build` **không có `DATABASE_URL`** exit 0, 8/9
  route là `ƒ Dynamic` · `npm test` 13/13, 0 fail, 0 skip · ba script bất biến exit 0.
- Super Orchestrator tự thiết kế **4 phép phá** khác worker: rò SDK Anthropic, rò
  connection Neon, hardcode `document_id`, prop `confidence` ra UI — cả bốn exit 1
  đúng lỗi rồi phục hồi xanh. BB-05/BB-07/BB-10 đã chứng minh, không chỉ "xanh".

### Decisions
- **Đ15** — `db:migrate:down` trả exit 2 thay vì giả vờ chạy được. Không có DB thì
  không kiểm chứng được đường lùi; ship rollback chưa từng chạy còn tệ hơn.
  **Hệ quả:** dòng "Migration hỏng" ở `OPERATIONS.md` §8 CHƯA được thoả mãn.
- **Đ16** — `.gitignore` thêm `!.env.example` và `*.tsbuildinfo`. Pattern `.env*` nuốt
  luôn file mẫu, người clone repo sẽ không biết cần biến gì.

### Notes
- `lib/types.ts` (file) thắng `lib/types/` (thư mục) mà handoff H03 ghi nhầm —
  `01-CONTRACTS.md` §7 tự xưng là nguồn chân lý kiểu.
- `01-CONTRACTS.md` trình bày `documents` (§3.1) trước `users` (§6) theo mạch đọc,
  không phải thứ tự chạy. Migration tách 4 file để khoá ngoại đúng thứ tự.

## [v1.0.0-p00] - 2026-09-20: Gói P00 — Knowledge Pack mô phỏng + Golden Dataset
### Added
- **Mã sản phẩm đầu tiên của repo.** Ba thư mục top-level mới: `knowledge/`
  (19 tài liệu mô phỏng / 98 section), `evals/golden/` (66 case đo), `scripts/`
  (3 script kiểm chạy Node thuần), cộng `package.json` khai `"type": "module"`.
- Bốn khuyết tật CỐ Ý cài sẵn theo Đ05 / `SPEC-P00` §5: DEF-01 và DEF-02 (khoảng
  trống tri thức), DEF-03 (cặp tài liệu mâu thuẫn sức chứa Vườn BBQ), DEF-04 (tài
  liệu hết hiệu lực). Hợp đồng máy đọc tại `evals/golden/expected_defects.json`.
- Cổng đo: K-M1 `documents: 19 · sections: 98 · defects_ok: 4/4`; K-M2 `faq: 50
  (answerable 40) · safety: 16 · canonical_codes_covered: 10/10`; K-M3 rỗng;
  K-M4 `true: 13 · false: 1 (FAC-PICKLEBALL)` — tất cả exit 0.

### Decisions
- **Đ13** — Đo key `stealth/union-alpha` + TokenRouter do chủ tịch cấp: TokenRouter
  trả `401` đòi tiền tố `tr_`, và `stealth/union-alpha` là slug của OpenRouter chứ
  không phải model TokenRouter. **Chưa đổi contract model** — A1/A2/A3 vẫn là Claude
  theo `01-CONTRACTS.md` §8 cho tới khi có key đo được tận tay.
- **Đ14** — Rút yêu cầu "key embedding": `01-CONTRACTS.md` §4.3 đã chốt dùng
  `Xenova/multilingual-e5-small` chạy tại chỗ lúc seed (384 chiều), không cần key.
- C-02 (HITL chỉ cho lượt escalate) và C-03 (bỏ Metric 2 Efficiency) được duyệt.

### Fixed
- `SPEC-P00` §3.2 ghi `FAC-FISHING-DECK` trong khi §3.4/§4 (nguồn nghiệm thu K-M4)
  dùng `FAC-FISHING-LAKE` — thống nhất về `FAC-FISHING-LAKE`.
- `handoffs/H02` của Super Orchestrator cấp nhầm đường dẫn `knowledge/expected_defects.json`
  và `golden/*.jsonl`, lệch `SPEC-P00` §2 (`evals/golden/`) và làm K-M3 đỏ. Đã
  chuyển file về đúng chỗ và sửa hằng đường dẫn trong 2 script.

## [v1.0.0-design] - 2026-09-20: Thiết kế hồ sơ Resident Agent v1.0 (demo)
### Added
- Khởi tạo bộ nhớ não `brain4agent/` cho dự án Resident Agent (repo trước đó là
  khung trắng do engine sinh, chưa phản ánh dự án cụ thể nào).
- Nạp 6 đặc tả v0.2 kế thừa (`docs/PRD_ResidentGPT_MVP.md` và 5 tài liệu liên
  quan) + 3 ảnh tham chiếu (`docs/assets/ref-01/02/03.jpg`), hạ cấp thành nguồn
  đặc tả tham chiếu cho lõi trả lời (không còn là định nghĩa sản phẩm).
- Mở hồ sơ kế hoạch `planning/01_2026-09-20_resident-agent-v1/`; chốt 12 quyết
  định kiến trúc (Đ01–Đ12) trong `plan.md` §2, gồm: mục tiêu bám rubric
  `C104/VHR-01/G104` thay vì v0.2 (Đ01), mô phỏng toàn phần không API/dữ liệu
  thật (Đ02), hai tầng mục tiêu khoá sau cổng P01–P04 xanh (Đ03), đảo nội hàm
  `pii_or_account_specific` sang "dữ liệu người khác" (Đ06), stack Next.js +
  TypeScript trên Vercel / Postgres + pgvector trên Neon / Claude cho 3 agent
  (Đ11).
- Hoàn tất đủ 9 file SPEC trong `specs/` (3711 dòng): `00-ARCHITECTURE.md`,
  `01-CONTRACTS.md`, `SPEC-P00/P02/P03/P04/P05-*.md`, `OPERATIONS.md`,
  `TESTING-ACCEPTANCE.md`. Super Orchestrator duyệt
  (`planning/01_2026-09-20_resident-agent-v1/reports/R01_specs-design.md`, phán
  quyết `✅ DUYỆT`).
- `git init` repo lần đầu (trước đó chưa phải git repository); commit local đầu
  tiên đồng bộ não + report + tick bảng SPEC — chưa push, chưa có remote.

### Trạng thái
- **Chỉ mới thiết kế xong. Chưa có dòng mã sản phẩm nào, chưa gói P00–P06 nào
  chạy hay được coi là hoàn thành.**

## [v1.0.0] - 2026-09-19: Initial Project Scaffolding
### Added
- Khởi tạo kiến trúc dự án và thiết lập hệ thống Bộ Nhớ Não Bộ `brain4agent/` Đa Tầng thế hệ mới.
