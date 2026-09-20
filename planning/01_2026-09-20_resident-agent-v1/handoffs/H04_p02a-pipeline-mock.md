# H04 — Bàn giao THI CÔNG gói P02a: pipeline 3 agent chạy local trên kho mock

**Vai:** bạn là WORKER THI CÔNG của repo này (được ghi file). Bạn cũng là ORCHESTRATOR của chính gói mình — tự xếp tầng từng việc theo `AGENTS.md` §5.K.3.
**Bước 0 bắt buộc:** từ root repo chạy `node ../brain4agent.release/.agents/skills/.xay-dung-nao-bo/scripts/init_brain.js --check`, ghi exit code vào dòng 1 report. Exit 2 ⇒ DỪNG, hỏi người.
**Thứ tự đọc:** `brain4agent/memory-distill.txt` → `plan.md` §2 (ĐẶC BIỆT **Đ17, Đ18, Đ19, Đ20, Đ24**) → `specs/00-ARCHITECTURE.md` §5, §9 → `specs/01-CONTRACTS.md` §4, §5, §7, §8 → `specs/SPEC-P02-Agent-Pipeline.md` (SPEC CHÍNH của bạn, đọc hết) → `specs/TESTING-ACCEPTANCE.md` §7.

## 1. Bối cảnh

Chủ tịch chốt: **chạy local trước, dùng mock data**. Chưa có `DATABASE_URL` (Neon) và chưa deploy. P01a đã xong: có `app/`, `lib/types.ts`, `lib/auth/`, `lib/retrieval/query.ts`, `db/migrations/`, 13 test. P00 đã xong: `knowledge/` 19 tài liệu / 98 section + 4 khuyết tật cài sẵn, `evals/golden/` 66 case.

Key Gemini **đã có và đã đo** (`GEMINI_API_KEY` trong `.env.local`). Số đo nhà cung cấp: `evidence/p02-provider/gemini-probe.txt` và `so-cm9-cm11.txt`. **Đọc hai file đó trước khi viết adapter** — chúng có sẵn mọi số bạn cần, CẤM tự đo lại để khỏi đốt hạn mức chung.

Bạn KHÔNG có lịch sử hội thoại. Mọi căn cứ lấy từ file trên đĩa.

## 2. Phạm vi

**Được tạo / ghi:**
- `lib/adapters/model.ts` — **đổi tên từ `anthropic.ts`** (BB-07.a). Gọi Gemini, `l2normalize`, retry/backoff, giới hạn song song.
- `lib/adapters/store-mock.ts` — kho mock đọc `knowledge/` + `evals/golden/`, sau đúng interface mà `lib/adapters/db.ts` phơi ra.
- `lib/adapters/db.ts` — sửa để định tuyến theo `DATA_BACKEND` ∈ `mock` | `postgres` (mặc định `mock`).
- `lib/pipeline/` — 9 chặng tất định + A1/A2/A3 theo `SPEC-P02` §2, §5.
- `lib/confidence.ts` — 4 tín hiệu theo `SPEC-P02` §6.1/§6.2.
- `scripts/probe_defects.mjs`, `scripts/trace_sample.mjs`, `scripts/eval_golden.mjs`, `scripts/embed_cache.mjs`
- `tests/` (thêm), `package.json` (thêm script), `.env.example` (thêm `DATA_BACKEND`)
- `reports/R05_p02a-pipeline-mock.md`, `evidence/p02a/*.txt`

**CẤM chạm:** `knowledge/**` · `evals/golden/*.jsonl` · `specs/**` · `plan.md` · `brain4agent/**` · `docs/**` · `AGENTS.md` · `CLAUDE.md` · `.gitignore` · `db/migrations/**`. Thấy SPEC sai ⇒ **báo trong report**, KHÔNG tự sửa.
**CẤM:** `git commit`/`push` · `vercel` bất kỳ lệnh nào · tạo tài khoản · in `GEMINI_API_KEY` ra log kể cả một phần · dùng Vyce (Đ22 đã bác).

## 3. Việc phải làm — "xong khi" là LỆNH + KẾT QUẢ máy đọc được

| WP | Việc | Xong khi (chạy từ root) |
| :-- | :-- | :-- |
| W1 | `lib/adapters/model.ts`: 3 model theo Đ17, `generationConfig.responseSchema`, token từ `usageMetadata` | `npm test -- adapter` xanh; `bash scripts/check_adapter_boundary.sh` ⇒ `violations: 0` |
| W2 | `l2normalize` cho **cả seed lẫn query** (Đ20 — API trả `\|v\|`=0.435 ở 384 chiều) | `node scripts/embed_cache.mjs --probe` in `norm_before_l2: 0.4…` và `norm_after_l2: 1.0000`, exit 0 |
| W3 | Backoff **CẢ 429 LẪN 503**, giới hạn song song **4** (Đ19) | `npm test -- backoff` có ca giả lập 429 và 503, cả hai retry rồi thành công; exit 0 |
| W4 | Kho mock + `DATA_BACKEND` | `DATA_BACKEND=mock node scripts/trace_sample.mjs --q "Bể bơi mở cửa mấy giờ?"` in 3 khối agent, mỗi khối có `model`/`ms`/token; exit 0 |
| W5 | 9 chặng tất định, eligibility gate **trước** khi sinh chữ (BB-08) | `npm test -- pipeline-order` in mảng 9 chặng đúng thứ tự; exit 0 |
| W6 | Trích dẫn bắt buộc (BB-04): mọi `citations[i].section_id` phải có trong `eligible_chunks` | `npm test -- citations` có ca agent bịa `section_id` ⇒ ném `PipelineInvariantError`; exit 0 |
| W7 | Confidence 4 tín hiệu + cổng escalate | `npm test -- confidence` chạy **nguyên bảng ví dụ `SPEC-P02` §6.3**; exit 0 |
| W8 | **G05 / K-M6 — số đo quan trọng nhất** | `node scripts/probe_defects.mjs` in 4 dòng `DEF-0x OK <reason_code> <gate>`; exit 0 |
| W9 | Golden chạy được, in cảnh báo mock | `npm run eval:golden -- --set=safety` in `BACKEND=mock — số định hướng, KHÔNG phải số nghiệm thu` rồi mới in M3; exit 0 |
| W10 | Không phá gói cũ | `npx tsc --noEmit` · `npm run build` (KHÔNG có `DATABASE_URL`) · `npm test` · 3 script `check_*.sh` · `validate_knowledge/golden` — tất cả exit 0 |

**Bộ đo MỚI phải từng ĐỎ (Luật K.5 + G12):** với W6, W7, W8 — mỗi phép phá phải khác nhau về **HÌNH DẠNG**, không chỉ khác nội dung. Chép output đỏ + exit code vào evidence rồi gỡ, chạy lại cho xanh.

## 4. Luật

- **Đ24 — vùng cấm số liệu:** `score_lexical` và `S1` trên mock **KHÔNG chuyển** sang Postgres (mock không có `ts_rank_cd(...,32)`). **CẤM tick Exit Gate `G11`** bằng số mock. **CẤM chỉnh ngưỡng confidence** theo số mock (`SPEC-P02` §6.5). `cosine_sim` từ embedding Gemini thì chuyển được nguyên.
- **CẤM `lib/pipeline/` gọi thẳng `store-mock.ts`** — phải đi qua interface của `db.ts`. Gọi thẳng là làm hỏng đúng cái khiến việc đổi sang Neon rẻ.
- `SPEC-P02` §10 — vùng cấm của gói. Đặc biệt **VC-02: CẤM gộp A2 và A3 thành một lời gọi** (gộp thì agent tự chấm bản nháp nó vừa viết, faithfulness mất nghĩa, BB-06 sụp).
- **BB-05:** `confidence` KHÔNG BAO GIỜ ra UI — chỉ hiện LÝ DO. `check_no_confidence_ui.sh` phải xanh.
- `01-CONTRACTS.md` §2.4 — enum 15 mã `reason_code` là **tập đóng**. CẤM thêm mã mới.
- `AGENTS.md` §5.G Root Clean; §5.L.4 kiểm mã thoát trực tiếp, không qua `grep`.
- Mọi output lệnh §3 lưu nguyên văn vào `evidence/p02a/<ten-lenh>.txt`. **CẤM sửa tay evidence.**
- Embedding 98 chunk = 98 lời gọi. **Đệm ra file** (`scripts/embed_cache.mjs`), chạy lại chỉ bù phần thiếu — trần đo được là 15 song song, đừng bắn ồ ạt.

## 5. Tầng model từng WP

| WP | Tầng | Vì sao |
| :-- | :-- | :-- |
| W5, W6, W7 | 🔴 | Bất biến pipeline và công thức confidence — sai thì mọi số sau đều sai mà không đỏ |
| W1, W2, W3, W4, W8, W9 | 🟠 | Có contract rõ + test tự biết đúng/sai |
| W10 | 🟢 | Chạy lại script có sẵn |

Thiếu model đúng tầng ⇒ LÊN một tầng, ghi vào bảng phân công thực tế. Thiếu 🔴 ⇒ dừng hỏi.

## 6. Mẫu report — `reports/R05_p02a-pipeline-mock.md`

Dòng 1: `Vai · thi công · <họ/model> · Bước 0 exit=<n> · hiểu việc (phạm vi / xong khi / cấm — bằng lời mình)`
Dòng 2–4: `Handoff: H04_p02a-pipeline-mock` · `Base: <SHA>` · `Head: chưa commit — worker bị cấm commit`
Thân: từng lệnh §3 + exit code nguyên văn · **bảng phép ĐỎ của W6/W7/W8 kèm HÌNH DẠNG từng phép** · `git status --short` · bảng phân công thực tế · việc KHÔNG làm + lý do · câu hỏi cần người.
Dòng cuối: KHÔNG tự phán quyết. Super Orchestrator sẽ đo lại và ra `✅ DUYỆT` / `🔁 SỬA` / `⛔ DỪNG`.
