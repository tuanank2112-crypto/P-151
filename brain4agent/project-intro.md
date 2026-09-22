# Giới Thiệu Dự Án (Project Overview)

## 0. Bản chất repo — ĐỌC TRƯỚC KHI LÀM GÌ

Đây là **sản phẩm demo mô phỏng**, không phải hệ thống chạy thật, không nối API
Vinhomes, không dữ liệu cư dân thật (quyết định Đ02, `planning/01_2026-09-20_resident-agent-v1/plan.md`
§2). Web app tự viết đóng luôn vai backend cư dân — mọi thao tác "ghi" (đặt chỗ,
huỷ, gia hạn thẻ...) đều là mô phỏng trong DB của chính app, không gọi ra ngoài.

Mục đích: được **ban giám khảo AI20K Build Phase Cohort 4** bấm thử trong 10 phút
và tick đủ 7 gạch đầu dòng của rubric `C104 / VHR-01 / G104`. Deadline **2026-09-27**.

**`docs/` mô tả một sản phẩm CŨ đã bị hạ cấp** (PRD ResidentGPT MVP v0.2 và 5 tài
liệu liên quan). Bộ đó mô tả một *công cụ soạn nháp cho Ban Quản Lý (BQL)*, actor
là bên thứ ba chưa xác thực — khác mục tiêu hiện tại. `docs/` **không còn là định
nghĩa sản phẩm**, chỉ còn là **nguồn đặc tả tham chiếu cho lõi trả lời** (nội dung
tri thức, giọng văn, một số ràng buộc vẫn còn hợp lệ sau khi tái diễn giải — xem
`plan.md` §2 Đ01, Đ06, Đ09). Ba ảnh trong `docs/assets/` (`ref-01/02/03.jpg`) là
tư liệu tham chiếu để dựng giao diện và danh mục tiện ích, không phải hợp đồng.

Nguồn chân lý về **thiết kế đang hiệu lực**: `planning/01_2026-09-20_resident-agent-v1/`
— `plan.md` (nhật ký quyết định Đ01–Đ14) rồi tới `specs/00-ARCHITECTURE.md` rồi
mới tới `docs/`. Khi mâu thuẫn, thứ tự ưu tiên này thắng.

## 1. Mục tiêu (Goals & Objectives)

Trợ lý AI cho cư dân khu đô thị, mô phỏng toàn phần, 2 vai trò (Cư dân / BQL):
- RAG có trích dẫn tới `document_id`/`section_id`, lưu lịch sử hội thoại bền qua phiên.
- Multi-agent 3 con (retrieval/answer, verify/faithfulness, escalate) — mỗi câu trả
  lời trace được từng chặng, có latency và token.
- Escalate khi confidence thấp, hợp từ 4 tín hiệu đo được (Đ07) — không hiện % giả.
- BQL: upload/đổi version/đổi status tài liệu tri thức (ảnh hưởng retrieval ngay
  trong phiên demo) + hàng đợi duyệt câu trả lời (HITL: Duyệt/Sửa/Từ chối).
- Bảng eval faithfulness/relevance trên Golden Dataset + dashboard tỉ lệ tự động
  giải quyết, tách theo intent và lý do escalate.
- (Tầng 2, có thể cắt) Lớp hành động P05: đọc chính sách trước khi ghi, đặt chỗ có
  biên nhận và hoàn tác — chỉ làm sau khi P01–P04 xanh (Đ03, hàng rào chống trễ hạn).

## 2. Công nghệ cốt lõi (Tech Stack) — quyết định Đ11

- **Frontend/Backend:** Next.js + TypeScript, deploy trên **Vercel**.
- **Data Persistence:** Postgres + **pgvector** trên **Supabase** (Đ25 — Turso/SQLite
  đã cân nhắc và **BÁC**: không có `pgvector`, không có `ts_rank_cd(..., 32)` của C-05,
  không có `text[]`/`jsonb`) — một kho chung cho RAG (embeddings), state ứng dụng
  (hội thoại, tài liệu, user) và sổ biên nhận (P05, nếu còn trong scope).
  Driver là `pg` (TCP), nói chuyện được với mọi Postgres chuẩn. Trên serverless BẮT
  BUỘC trỏ `DATABASE_URL` vào connection pooler (Supabase cổng `6543`), không phải `5432`.
- **Kho dữ liệu local (Đ24):** `DATA_BACKEND` ∈ `mock` | `postgres`, mặc định `mock`.
  Mock đọc thẳng `knowledge/`, nằm trong `lib/adapters/` nên BB-07 giữ. **VÙNG CẤM:**
  cấm tick Exit Gate `G11` bằng số chạy trên mock.
- **Auth:** credential 2 vai trò (Cư dân / BQL), seed sẵn tài khoản demo.
- **LLM:** **Google Gemini** cho cả 3 agent (Đ17) — A1 `gemini-3.5-flash-lite`,
  A2 `gemini-3.5-flash`, A3 `gemini-2.5-flash`. Biến `GEMINI_API_KEY`. Contract tại
  `specs/01-CONTRACTS.md` §8. **Không có bậc Pro** (429 — sau cổng thanh toán), nên A2
  chạy bậc Flash: hạ cấp chất lượng có chủ ý, đánh vào `faithfulness`.
- **Embedding:** `gemini-embedding-001` với `outputDimensionality: 384` (Đ18) — khớp
  nguyên `vector(384)`, nên `RETRIEVAL_MODE=hybrid` chạy được **cả trên Vercel**.
  Bắt buộc tự chuẩn hoá L2 (Đ20): API trả vector chưa chuẩn hoá khi ép chiều.
- **Runtime script:** Node ESM thuần (`package.json` → `"type": "module"`). Bộ script
  kiểm của P00 cố ý không có dependency để chạy được ở máy trắng.
- **Thời điểm deploy:** D2 — "web đã deploy" là gạch đầu dòng đầu tiên của rubric,
  phải xanh sớm rồi bồi tính năng lên, không để dồn cuối.

## 3. Trạng thái hiện tại

Tính đến 2026-09-20: thiết kế xong (9 file SPEC, 3711 dòng, `reports/R01`) **và
gói P00 đã thi công xong, đo lại độc lập, ✅ DUYỆT** (`reports/R02`).

Trên đĩa đã có: `knowledge/` (19 tài liệu mô phỏng / 98 section, 4 khuyết tật cài
sẵn), `evals/golden/` (66 case đo), `scripts/` (3 script kiểm chạy **Node thuần,
không cần DB, không gọi LLM**), `package.json` (Node ESM, chưa có dependency nào).

**P01a đã xong, ✅ DUYỆT** (`reports/R03`): khung Next.js + TS strict, route 2 vai,
`lib/types.ts`, `lib/adapters/` (BB-07), `lib/auth/`, `lib/retrieval/`, `db/migrations/`
(soạn mã, chưa chạy), 13 ca test. `npm run build` xanh **không cần `DATABASE_URL`**.
P02a đã thêm `lib/pipeline/` (3 agent, 9 chặng), `lib/confidence.ts`,
`lib/adapters/{model,store-mock}.ts` ⇒ **53 ca test**, vẫn xanh không cần key lẫn DB —
nhưng gói P02a **CHƯA được nghiệm thu**.

**Còn chặn ở ngoài tầm agent:** chưa có `DATABASE_URL` (Supabase — Đ25) ⇒ **chưa
migrate, chưa seed, chưa chạy Golden trên số nghiệm thu**; Vercel CLI đã đăng nhập sẵn
nhưng chờ chủ tịch **chọn scope** (Đ23). `GEMINI_API_KEY` đã có và chạy được (Đ17) —
dòng "chưa có ANTHROPIC_API_KEY" là của giai đoạn trước Đ17, nay hết đối tượng.
P02–P06 chưa bắt đầu. Không gói nào được coi là "đã hoàn thành" cho tới khi có bằng
chứng máy chạy thật.

## 4. Hồ sơ nộp bài BTC và bộ hook AI-log (2026-09-23, Đ47)

Ngoài rubric R1–R10, BTC AI20K chấm **10 deliverables** và 5 tiêu chí (Product · System
Design · UX/UI · DevOps · Code Quality) theo `origin/feature/truong:docs/guide/deliverables/checklist.md`.
Repo nay có đủ hồ sơ ở đúng đường dẫn BTC đòi: `README.md`, `docs/architecture_diagram.md`,
`JOURNAL.md`, `WORKLOG.md`, `eval/results/report.md`, `presentation/`. **Bộ hook AI-log là
Python** (`scripts/log_hook.py`, `submit_log.py`, …, chép nguyên văn từ template BTC) — đây là
ngôn ngữ thứ hai trong repo, CHỈ phục vụ ghi log dùng AI cho ban chấm, không thuộc sản phẩm;
Node ESM vẫn là runtime duy nhất của app và script kiểm. Còn thiếu `.claude/settings.json`
(người tạo tay) và `AI_LOG_API_KEY` từng thành viên (Phoenix). Nhánh `origin/main` trên GitHub
vẫn là template Python rỗng — sản phẩm nằm ở `origin/feature/nhuy` (G38).
