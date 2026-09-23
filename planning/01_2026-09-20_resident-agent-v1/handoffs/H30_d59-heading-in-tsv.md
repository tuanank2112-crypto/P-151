1. Bạn là worker của repo này. Vai + luật hành xử: đọc `.agents/skills/vai-thi-cong/SKILL.md`. Loại handoff: **THI CÔNG**.
2. Bước 0: `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`. Ghi mã thoát vào report. DỪNG Ở `--check`. Mã 2 ⇒ dừng, báo lên.
3. Đọc theo thứ tự: `plan.md` §2 **Đ59** → `specs/01-CONTRACTS.md` §3 (DDL `chunks`, khối Đ59 ngay dưới `chunks_tsv_idx`), §4.2 (SQL truy hồi `ts_rank_cd(...,32)`, G18 `immutable_unaccent`) → `brain4agent/-known-gotchas.md` G18, G53 → `db/migrations/003_knowledge.sql` (dòng 62–75), `006_p05_action_layer.sql` (mẫu migration idempotent) → `scripts/migrate.mjs` (checksum, `schema_migrations`, Đ30) → `scripts/seed_knowledge.mjs` (INSERT chunks ~dòng 164) → `lib/adapters/bql-store.ts` (INSERT chunks ~dòng 465 và ~618) → `lib/adapters/store-mock.ts` (`MockChunk`, `scoreChunk`, dựng index) → `lib/retrieval/query.ts`.

## 1. BỐI CẢNH
Repo `D:\build phase`, nhánh `feature/nhuy`, base = `git rev-parse --short HEAD`. `chunks.tsv` chỉ dựng từ `content_vi` ⇒ câu hỏi khớp nguyên văn tiêu đề mục vẫn truy hồi hụt (MOVE-TIME-03 hạng 13, CONS-TIME-03 hạng 9, TOP_K = 8). Chủ tịch duyệt migration. DB Supabase THẬT đã chạy 001→006. Số nền: tsc 0 · test 289/289 · BB 0.

## 2. PHẠM VI
**Được ghi:** `db/migrations/007_chunk_heading_tsv.sql` (mới) · `scripts/seed_knowledge.mjs` (CHỈ câu INSERT chunks) · `lib/adapters/bql-store.ts` (CHỈ 2 câu INSERT chunks + tham số) · `lib/adapters/store-mock.ts` (CHỈ cộng điểm tiêu đề trong scorer mock) · test mới `tests/heading-tsv.test.ts` · `planning/01_2026-09-20_resident-agent-v1/evidence/h30-heading-tsv/**` · `reports/R34_thi-cong_d59-heading-tsv.md`.
**CẤM chạm:** `db/migrations/001..006` (Đ30 — checksum), `lib/pipeline/**`, `lib/retrieval/query.ts` (SQL truy hồi giữ nguyên), `lib/eval/**`, `evals/**`, `knowledge/**`, `planning/**/specs/**`, `brain4agent/**`, `package.json`.
**CẤM** `git add/commit/push`. **CẤM `git stash` / `git checkout -- <file>` / `git reset` / `git clean`** (AGENTS.md §5.D.5). **CẤM** xoá/sửa dữ liệu ngoài cột `chunks.heading_vi`/`tsv` và index. **CẤM** chạy Golden (SO chạy).

## 3. VIỆC PHẢI LÀM
**W1 — Migration 007 (idempotent, một transaction).** `ALTER TABLE chunks ADD COLUMN IF NOT EXISTS heading_vi text NOT NULL DEFAULT ''` · `UPDATE chunks c SET heading_vi = s.heading_vi FROM sections s WHERE s.section_id = c.section_id` · `DROP INDEX IF EXISTS chunks_tsv_idx` · `ALTER TABLE chunks DROP COLUMN tsv` · `ALTER TABLE chunks ADD COLUMN tsv tsvector GENERATED ALWAYS AS (setweight(to_tsvector('simple', public.immutable_unaccent(heading_vi)), 'A') || to_tsvector('simple', public.immutable_unaccent(content_vi))) STORED` · `CREATE INDEX chunks_tsv_idx ON chunks USING gin(tsv)`. Nội dung GIỮ trọng số mặc định (D) — CẤM `setweight` cho content. **Xong khi:** `node --env-file=.env.local scripts/migrate.mjs` exit 0, `schema_migrations` có 007; `select count(*) from chunks where heading_vi=''` = 0; `select count(*) from chunks` KHÔNG đổi so với trước (ghi số trước/sau).
**W2 — Mọi INSERT chunks ghi `heading_vi`** (seed + 2 chỗ `bql-store.ts`, lấy từ section tương ứng). **Xong khi:** `grep -n "INSERT INTO chunks" lib scripts` mọi dòng đều có `heading_vi`; test upload/đổi version hiện có vẫn xanh.
**W3 — Mock:** `store-mock.ts` cộng điểm khớp tiêu đề (trọng số cao hơn nội dung, tương tự tinh thần A vs D), giữ nguyên hành vi khi không khớp tiêu đề. **Xong khi:** test mock mới: câu "Khung giờ nào được phép chuyển đồ ra vào Tòa nhà?" ⇒ `MOVE-TIME-03` trong top 8.
**W4 — Đo thật không gọi model** (script tạm trong `evidence/h30-heading-tsv/`, KHÔNG trong `scripts/`): `searchLexical` Postgres TRƯỚC và SAU migration cho: 2 câu khung giờ (kỳ vọng MOVE-TIME-03/CONS-TIME-03 vào top 8, lý tưởng top 3), + 6 câu đối chứng (bể bơi trẻ em, phí cấp lại thẻ cư dân, tốc độ hầm, BBQ đặt lượt, hàng rào biệt thự, pickleball) — ghi hạng + điểm section đúng trước/sau; câu KHÔNG khớp tiêu đề thì điểm top1 phải giữ gần như cũ. Lưu `before.txt`, `after.txt`. **Chạy `before` TRƯỚC khi migrate.**
**W5 — Cổng:** `npx tsc --noEmit` 0 · `node scripts/run_tests.mjs` ≥ 289 + mới, 0 fail, 0 skip (DB rảnh) · `check_adapter_boundary.sh` 0 · `check_no_hardcoded_knowledge.sh` 0 · `node scripts/validate_knowledge.mjs` `defects_ok: 4/4` · `node scripts/check_enum_closed.mjs` exit 0 · test mới từng ĐỎ trên mã cũ.

## 4. LUẬT
Migration phải chạy lại lần 2 không lỗi (idempotent: ghi output lần 2). Không để lại tiến trình nền. Thấy việc ngoài phạm vi ⇒ GHI report.

## 5. TẦNG
W1 🔴 (DDL trên DB thật) · W2 🟠 · W3 🟠 · W4 🟠 · W5 🟢.

## 6. REPORT
`reports/R34_thi-cong_d59-heading-tsv.md` đúng mẫu K.4 (dòng 1 khai vai; dòng 2–4 `Handoff:`/`Base:`/`Head:`; lệnh + exit; test tổng/pass/fail/skip; `git diff --stat`; bảng phân công; việc KHÔNG làm; câu hỏi cần người; dòng cuối ✅/🔁/⛔).
