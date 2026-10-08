# MaintenanceOps — Architecture Data Flow Diagram Plan

- Status: SPEC_APPROVED; approval: approved; diagram: in_progress.
- Owner: Trường; audience: students, evaluators, and judges.
- Created: 2026-10-04T18:46:00+07:00; updated: 2026-10-04T18:53:35+07:00; target: 2026-10-19 (Asia/Saigon).
- Base: develop / feature/truong; branch: feature/truong.
- Scope: Architecture Data Flow specification and visual artifacts (Mermaid, draw.io, SVG 16:9).
- Reference: docs/CR-BPTN-03.md §5, docs/maintenance.md, brain4agent/-data-architecture.md.

## Nhật ký quyết định
- 2026-10-04T19:15:00+07:00 — Người dùng phản hồi các đường nối cũ bị rối vào nhau. Tiến hành tái thiết kế toàn diện sơ đồ Data Flow theo Bố cục 4 Trụ Tuyến Tính (4-Pillar Architecture Data Flow trên lưới 1920x1080): Pillar 1 (Intake & Safety Gate) -> Pillar 2 (AI Reasoning & Enrichment) -> Pillar 3 (Field Dispatch & Execution) -> Pillar 4 (Quality Gate & ACID Persistence). Các cầu nối chính 100% Horizontal thẳng hàng, các nhánh rẽ và kho lưu trữ được đóng gói cục bộ trong từng cột, triệt tiêu hoàn toàn giao cắt đường nối (Zero-Crossing) và loại bỏ hoàn toàn các đường phản hồi chạy chéo phức tạp.
- 2026-10-04T18:53:35+07:00 — Người dùng duyệt toàn bộ gói SPEC Data Flow. Tiến hành thi công Mermaid, draw.io XML và xuất bản vẽ vector SVG 16:9.
- 2026-10-04T18:44:35+07:00 — Vòng phỏng vấn 3 chốt: Ngôn ngữ 100% Tiếng Anh (Pure English Enterprise standard); Gộp trục chính thành 6 trạm trung tâm; Bỏ Subtitle và Metadata Tag, chỉ giữ Title sạch; Thống nhất vị trí artifact tại docs/diagrams/maintenanceops-data-flow-20261019/.
- 2026-10-04T18:41:22+07:00 — Vòng phỏng vấn 2 chốt: Data Stores đặt ở dải đáy (Data Stores Bar); Định tuyến luồng phản hồi theo 3 Hành lang Tuyến tính (Upper Escalation, Central Highway, Lower Feedback) đạt Zero-Crossing; Tác nhân con người đặt ở biên ngoại vi (External Touchpoints); Lược bỏ telemetry Phoenix để dành 100% diện tích cho luồng dữ liệu nghiệp vụ.
- 2026-10-04T18:38:25+07:00 — Vòng phỏng vấn 1 chốt: Phạm vi Option B (Deep-dive AI Agent Decision Pipeline & Backend Engine); Thể hiện đầy đủ cả 4 luồng rẽ / feedback loops (Bậc 1 Khẩn cấp, Bậc 2 Nghi ngờ, Bổ sung dữ liệu, Thiếu kho/vật tư, và Làm lại/Rework); Dữ liệu biểu diễn ở mức tổng quát (Conceptual/Document payload); Định dạng Mermaid + draw.io/SVG 16:9.

### Quyết định bị thay thế
- Sơ đồ Data Flow thay thế các sơ đồ luồng dữ liệu cũ phân tán trong tài liệu legacy (docs/architecture_diagram.md, docs/Activity Diagram.png) vốn chưa đồng bộ với CR-BPTN-03.
- Bỏ phương án vẽ RAG/Vector/Telemetry Phoenix trong sơ đồ này để tập trung tuyệt đối vào luồng dữ liệu quyết định của Agent và máy trạng thái.

## Router SPEC
- [00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md): Mục tiêu, ranh giới, bất biến kiến trúc và router thứ tự đọc.
- [01-CONTRACTS.md](specs/01-CONTRACTS.md): Data payload schemas, node definitions, edges và I/O persistence.
- [SPEC-P01-VISUAL.md](specs/SPEC-P01-VISUAL.md): Bố cục 3 hành lang trên lưới 1920x1080 (16:9), quy tắc Zero-Crossing và màu sắc.
- [OPERATIONS.md](specs/OPERATIONS.md): Quy trình dựng Mermaid, xuất draw.io/SVG, kiểm tra và bàn giao.
- [TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md): Ma trận kiểm chứng, số đo kiểm tra trực quan và các cổng nghiệm thu (Exit Gates).

## Work packages · Model Tier
- WP1 🔴: Phỏng vấn thu thập yêu cầu và soạn thảo bộ SPEC trọn gói (Đã hoàn tất và được duyệt).
- WP2 🟠: Dựng mã nguồn Mermaid và file draw.io XML tỷ lệ 16:9 theo chuẩn 3-Corridor Flow.
- WP3 🟠: Xuất vector SVG 16:9, kiểm chứng rendering, tỷ lệ font và đo kiểm Zero-Crossing.
- WP4 🟢: Soạn tài liệu giải thích Data Flow README.md, đồng bộ hồ sơ não bộ và đề xuất commit.

## Checklist thực thi
- [x] Đọc codebase và phỏng vấn người dùng 3 vòng (chốt đủ 100% yêu cầu).
- [x] Lập gói SPEC đầy đủ tại `planning/08_2026-10-04_data-flow/specs/`.
- [x] Người dùng duyệt bộ SPEC Data Flow.
- [x] Dựng sơ đồ Mermaid `data-flow.mmd` theo 3-Corridor Linear Layout.
- [x] Dựng sơ đồ draw.io `data-flow.drawio` (1920 × 1080) và export `data-flow.svg`.
- [x] Đo kiểm các tiêu chuẩn thị giác (16:9, font >= 16px, 0 crossing đường chính, text padding).
- [x] Tạo `docs/diagrams/maintenanceops-data-flow-20261019/README.md`.
- [ ] Trình người dùng nghiệm thu thị giác (Visual sign-off).
