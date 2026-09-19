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
— `plan.md` (nhật ký quyết định Đ01–Đ12) rồi tới `specs/00-ARCHITECTURE.md` rồi
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
- **Data Persistence:** Postgres + **pgvector** trên **Neon** — một kho chung cho
  RAG (embeddings), state ứng dụng (hội thoại, tài liệu, user) và sổ biên nhận
  (P05, nếu còn trong scope).
- **Auth:** credential 2 vai trò (Cư dân / BQL), seed sẵn tài khoản demo.
- **LLM:** Claude cho cả 3 agent (retrieval/answer, verify, escalate).
- **Thời điểm deploy:** D2 — "web đã deploy" là gạch đầu dòng đầu tiên của rubric,
  phải xanh sớm rồi bồi tính năng lên, không để dồn cuối.

## 3. Trạng thái hiện tại

Tính đến 2026-09-20: **mới hoàn tất khâu thiết kế** — 9 file SPEC trong
`planning/01_2026-09-20_resident-agent-v1/specs/` (3711 dòng), Super Orchestrator
đã duyệt (`reports/R01_specs-design.md`). **Chưa có dòng mã sản phẩm nào.** Không
gói P00–P06 nào được coi là "đã hoàn thành" cho tới khi có bằng chứng máy chạy thật.
