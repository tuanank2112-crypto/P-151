# Roadmap & Active Tasks

File này chứa danh sách các tính năng, mục tiêu sắp tới và tình trạng công việc hiện tại.

> Nguồn chi tiết: `planning/01_2026-09-20_resident-agent-v1/plan.md` §3 (Work
> Packages) và §4 (checklist thực thi). File này chỉ tóm tắt — không thay thế.

## Mục tiêu hiện tại (Active) — hồ sơ `01_2026-09-20_resident-agent-v1`, deadline 2026-09-27

**Chưa gói nào chạy hay có mã nguồn.** Thứ tự bắt buộc theo phụ thuộc (P05 khoá
sau cổng P01–P04 xanh — Đ03):

- [ ] P00 — Knowledge Pack mô phỏng + Golden Dataset 🔴 (D1–D2)
- [ ] P01 — Nền tảng, auth 2 vai, ingest, deploy 🟠 (D2) — phụ thuộc P00
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
- **Metric 2 "Efficiency"** — không thấy trong `plan.md`/`specs/` hiện tại;
  handoff yêu cầu ghi vào Idea Vault nếu đã bị rút nhưng worker này không tìm
  thấy quyết định rút tường minh nào cho mục này trong `plan.md` hay
  `specs/TESTING-ACCEPTANCE.md`. Ghi "chưa đo được" — xem Câu hỏi mở trong
  `reports/R01_specs-design.md`/report của phiên này thay vì tự suy diễn.

## Đã hoàn thành (Done)

- [x] **Khởi tạo Bộ Nhớ Não Bộ Chuẩn (v1.0.0):** Thiết lập cấu trúc Đa Tầng brain4agent V5.2 và quy chuẩn quản trị AGENTS.md.
- [x] **Khâu THIẾT KẾ hồ sơ `01_2026-09-20_resident-agent-v1` (2026-09-20):** đủ 9
  file SPEC (3711 dòng) trong `specs/`, Super Orchestrator đã duyệt
  (`planning/01_2026-09-20_resident-agent-v1/reports/R01_specs-design.md`, dòng
  cuối `✅ DUYỆT`). **Đây là "thiết kế xong", KHÔNG phải "thi công xong" — chưa
  gói P00–P06 nào chạy hay có mã nguồn.**
