# Master Data Architecture & Flow

Tài liệu thiết kế về cấu trúc dữ liệu, cơ chế lưu trữ bền vững (Persistence Layer) và luồng luân chuyển dữ liệu đa tầng.

> **Trạng thái: THIẾT KẾ, CHƯA THI CÔNG.** Không có bảng, migration hay dòng mã
> nào dưới đây đã tồn tại thật trong hạ tầng — repo hiện chưa có dòng mã sản phẩm
> nào (2026-09-20). Nguồn chân lý chi tiết là
> `planning/01_2026-09-20_resident-agent-v1/specs/01-CONTRACTS.md` (DDL, schema,
> enum reason code) — file này chỉ tóm tắt điều hướng, không thay thế nó.

## 1. Các Tầng Lưu Trữ (Data Persistence Stores) — dự kiến

- **Postgres + pgvector trên Neon** (Đ11, `plan.md` §2): MỘT kho chung cho:
  - **RAG:** bảng tài liệu tri thức (Knowledge Pack mô phỏng, xem SPEC-P00) +
    embeddings pgvector cho retrieval.
  - **State ứng dụng:** user 2 vai trò, lịch sử hội thoại (bền qua phiên — R4),
    log 3 chặng agent (latency, token — R6), hàng đợi duyệt câu trả lời (P03/HITL).
  - **Sổ biên nhận (P05, nếu còn trong scope sau cổng Đ03):** ghi lại thao tác ghi
    mô phỏng (đặt chỗ, huỷ...) kèm khả năng hoàn tác — theo Đ10, chính sách phải
    đọc được (read-only) *trước* khi gọi lệnh ghi.
- **Không có** kho dữ liệu cư dân thật, không gọi API Vinhomes (Đ02) — mọi "ghi"
  là mô phỏng nội bộ trong Postgres của chính app.

## 2. Schema & Data Flow

Chi tiết DDL, contract 3 agent, enum reason code (10 mã canonical + nhóm hành
động theo Đ12) nằm trong `specs/01-CONTRACTS.md` — **đọc file đó trước khi viết
bất kỳ type/DDL/API nào** (bắt buộc theo router `specs/00-ARCHITECTURE.md` §1).

Luồng tổng quát (chưa thi công, mô tả dự kiến theo SPEC):
1. Câu hỏi cư dân → agent retrieval/answer truy hồi từ pgvector → sinh nháp trả
   lời có trích dẫn `document_id`/`section_id`.
2. Agent verify soi từng mệnh đề của nháp có neo vào evidence không → vừa là
   chốt an toàn lúc chạy, vừa sinh điểm faithfulness cho bảng eval (Đ08).
3. Cổng escalate hợp 4 tín hiệu đo được (điểm truy hồi, eligibility, faithfulness,
   cờ mâu thuẫn nguồn — Đ07) → quyết định trả lời hay escalate, kèm lý do
   (không hiện % ra UI).
4. BQL đổi `status`/version tài liệu → ảnh hưởng retrieval ngay trong cùng phiên
   (R7) — không cần rebuild offline.
5. (P05, có điều kiện) Trước một lệnh ghi mô phỏng, đọc điều kiện từ dữ liệu
   chính sách read-only (còn chỗ trống, đủ điều kiện, hạn) rồi mới ghi — cấm
   agent "thử và hỏng" bằng lệnh ghi thật (Đ10).
