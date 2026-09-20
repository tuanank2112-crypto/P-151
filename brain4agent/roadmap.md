# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

> Nguồn chi tiết: `planning/01_2026-09-20_resident-agent-v1/plan.md` §3 (Work
> Packages) và §4 (checklist thực thi). File này chỉ tóm tắt — không thay thế.

## Mục tiêu hiện tại (Active) — hồ sơ `01_2026-09-20_resident-agent-v1`, deadline 2026-09-27

**P00 đã xong và được đo lại độc lập (2026-09-20).** Thứ tự bắt buộc theo phụ
thuộc (P05 khoá sau cổng P01–P04 xanh — Đ03):

- [x] P00 — Knowledge Pack mô phỏng + Golden Dataset 🔴 (D1–D2) — ✅ DUYỆT, xem `Done`
- [ ] P01 — Nền tảng, auth 2 vai, ingest, deploy 🟠 (D2) — **P01a (phần không cần key) ĐÃ XONG, ✅ DUYỆT**; còn lại chặn ở Neon + Vercel
- [ ] P02 — RAG có trích dẫn, memory, 3 agent, cổng escalate 🔴🟠 (D3–D4) — phụ thuộc P00, P01
- [ ] P03 — Console BQL: quản lý tài liệu + duyệt câu trả lời (HITL) 🟠 (D4–D5) — phụ thuộc P01, P02
- [ ] P04 — Bảng eval faithfulness/relevance + dashboard 🟠 (D5) — phụ thuộc P00, P02
- [ ] P05 — Lớp hành động: đọc chính sách, đặt chỗ, biên nhận, hoàn tác 🟠 (D6) — **cổng: P01–P04 xanh**, gói duy nhất được cắt khi trễ
- [ ] P06 — Kịch bản demo, dữ liệu mồi, dự phòng 🟢 (D7) — phụ thuộc tất cả

## Tương lai (Upcoming)

- (Không có mục ngoài hồ sơ 01 đang mở — dự án chỉ có một hồ sơ kế hoạch tại thời điểm này.)

## 💡 Kho Ý Tưởng & Backlog (Idea Vault)

*Những thứ đã cân nhắc và CHỦ ĐỘNG RÚT khỏi vòng 1.0.0 — không phải "chưa nghĩ tới", ghi kèm lý do để không lật lại mà không có căn cứ mới. Nguồn: `plan.md` §2 "Quyết định bị thay thế".*

- **Lớp hành động đầy đủ (agent tự chủ thanh toán hoá đơn, đặt chỗ không cần điều
  kiện tiên quyết) trên actor "cư dân tự chủ"** — rút, thay bởi Đ01+Đ03. Lý do:
  suy ra từ ảnh + tài liệu cũ trước khi có rubric thật; rubric đòi cả 2 vai (Cư
  dân *và* BQL), không có dòng nào về thanh toán. Giữ hướng cũ sẽ đốt deadline
  vào thứ không được chấm.
- **Ý định bền qua phiên (persistent intent) + bộ lập lịch (scheduler) chạy nền
  cho các thao tác trễ (vd đăng ký ngoài giờ)** — rút theo chỉ đạo chủ tịch
  2026-09-20: ảnh minh hoạ modal từ chối đăng ký ngoài giờ chỉ là ví dụ, không
  phải yêu cầu tính năng. P05 chỉ giữ "đọc chính sách trước khi ghi" (Đ10). Tiết
  kiệm khoảng 1 ngày công và bỏ được một hạ tầng khó (scheduler bền qua restart).
- **Trần thanh toán và rủi ro điều khoản dịch vụ cần chủ tịch quyết** — rút,
  không còn đối tượng sau Đ02 (mô phỏng toàn phần: không tiền thật, không API
  thật).
- **Metric 2 "Efficiency"** — ✅ **ĐÃ GIẢI QUYẾT 2026-09-20**, gỡ trạng thái
  "chưa đo được". Căn cứ tường minh mà worker R01 không tìm ra thực ra có sẵn ở
  `specs/SPEC-P00-Knowledge-Golden.md` §6.1, khối *"Vùng cấm — KHÔNG làm Metric 2
  (Efficiency)"*: `PRD` §9 Metric 2 đòi một manual controlled time study với BQL
  thật xử lý 30 case theo quy trình cũ để lấy baseline; không có BQL thật, không
  có quy trình cũ, rubric C104/VHR-01 không hỏi năng suất ⇒ làm số đó ra là bịa.
  Chủ tịch GẬT C-03 ngày 2026-09-20 (`plan.md` §2, bảng *Quyết định của chủ tịch*).
  Ai muốn lật phải trả lời được "lấy baseline ở đâu".

## Đã hoàn thành (Done)

- [x] **P01a — Nền tảng chạy được không cần key (2026-09-20):** khung Next.js + TS
  strict, route 2 vai (`app/(resident)/chat`, `app/(bql)/documents|review|eval|dashboard`),
  `lib/types.ts` (enum 15 reason_code), `lib/adapters/db.ts` + `lib/adapters/anthropic.ts`
  (BB-07), `lib/auth/` (scrypt + cookie HMAC), `lib/retrieval/query.ts` (giữ cờ 32),
  `db/migrations/` 4 file theo thứ tự FK, `tests/` 13 ca. Đo: `tsc --noEmit` exit 0 ·
  `npm run build` KHÔNG có `DATABASE_URL` exit 0 (8/9 route dynamic) · `npm test` 13/13 ·
  **BB-05/BB-07/BB-10 xanh và đã chứng minh đỏ được** (SO tự thiết kế 4 phép phá).
  Phán quyết ✅ DUYỆT tại `reports/R03_p01a-nen-tang-offline.md`.

- [x] **P00 — Knowledge Pack mô phỏng + Golden Dataset (2026-09-20):** 19 tài liệu
  / 98 section trong `knowledge/`, 4 khuyết tật cài sẵn DEF-01..04 (2 gap, 1 cặp
  conflict, 1 expired), 66 case Golden trong `evals/golden/` (50 FAQ + 16 Safety,
  phủ đủ 10 mã canonical), 3 script kiểm chạy Node thuần. Bốn cổng K-M1→K-M4 exit 0.
  Super Orchestrator đo lại độc lập và tự thiết kế 2 phép phá (cả hai ĐỎ đúng rồi
  tái xanh). Phán quyết ✅ DUYỆT tại `reports/R02_p00-knowledge-golden.md`.
  Còn treo: K-M5 (cần `DATABASE_URL` Neon), K-M6 (cần P02).

- [x] **Khởi tạo Bộ Nhớ Não Bộ Chuẩn (v1.0.0):** Thiết lập cấu trúc Đa Tầng brain4agent V5.2 và quy chuẩn quản trị AGENTS.md.
- [x] **Khâu THIẾT KẾ hồ sơ `01_2026-09-20_resident-agent-v1` (2026-09-20):** đủ 9
  file SPEC (3711 dòng) trong `specs/`, Super Orchestrator đã duyệt
  (`planning/01_2026-09-20_resident-agent-v1/reports/R01_specs-design.md`, dòng
  cuối `✅ DUYỆT`). **Đây là "thiết kế xong", KHÔNG phải "thi công xong" — chưa
  gói P00–P06 nào chạy hay có mã nguồn.**
