# Changelog & Semantic Releases

Tất cả các quyết định kiến trúc và lịch sử nâng cấp phiên bản của dự án.

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
