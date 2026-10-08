# MaintenanceOps — Target component diagram

- Status: COMPLETED_AND_EMBEDDED; approval: approved; diagram: verified_local_and_user_accepted; user_visual_acceptance: approved.
- Owner: Trường; audience: students and judges.
- Created: 2026-10-04T10:19:47+07:00; updated: 2026-10-04T11:27:00+07:00; target: 2026-10-19 (Asia/Saigon).
- Base: b9379563891be415e3531743b85f65a8d60b206b; branch: feature/truong.
- Scope: documentation and diagram artifacts only; embedded in root README.md.
- Boot: hub check exit 1, MODULE_NOT_FOUND; no managed-rule changes.

## Nhật ký quyết định
- 2026-10-04T11:55:00+07:00 — Người dùng yêu cầu vẽ lại bản Architecture Components Diagram mới để triệt tiêu hoàn toàn cảm giác rối mắt và các đường nối chồng đè. Tiến hành tái thiết kế theo Bố cục 4 Cột Tuyến Tính (4-Pillar Flow trên lưới tỷ lệ vàng 1920x1080) với các cầu nối ngang 100% Horizontal song song, hành lang hạ tầng 120px thoáng đãng, 0 điểm giao cắt (Zero-Crossing). Đã export SVG/PNG và cập nhật mã nguồn Mermaid vào root README.md.
- 2026-10-04T11:26:45+07:00 — Người dùng nghiệm thu thị giác bố cục ban đầu và yêu cầu nhúng vào root README.md.
- 2026-10-04T11:09:15+07:00 — Người dùng phản hồi sơ đồ ban đầu bị rối mắt do nhiều line chồng chéo.
- 2026-10-04T10:40:25+07:00 — Người dùng duyệt SPEC và yêu cầu dựng draw.io/SVG.
- 2026-10-04T10:19:47+07:00 — Người dùng chốt kiến trúc mục tiêu 19/10, đối tượng sinh viên/giám khảo; ưu tiên hiểu hệ thống và vai trò AI; nền sáng, tiếng Anh, ít màu; dùng README và slide 16:9; draw.io chỉnh sửa được + SVG.

### Quyết định bị thay thế
- Bố cục cũ bị thay thế bởi Bố cục 4 Cột Tuyến Tính (4-Pillar Zero-Crossing Flow) để loại bỏ 100% hiện tượng dây nối chồng chéo và nhãn chữ va chạm.
- Sơ đồ hiện trạng theo commit cũ không phải đầu ra của hồ sơ này; artifact cũ giữ nguyên để không mất lịch sử.

## Router SPEC
- [00-ARCHITECTURE.md](specs/00-ARCHITECTURE.md): mục tiêu, ranh giới, bất biến, nguồn và trạng thái.
- [01-CONTRACTS.md](specs/01-CONTRACTS.md): node IDs, nhãn, trách nhiệm, edges và file contract.
- [SPEC-P01-VISUAL.md](specs/SPEC-P01-VISUAL.md): bố cục, typography, màu, quy tắc đường nối.
- [OPERATIONS.md](specs/OPERATIONS.md): tạo, export, kiểm tra, bàn giao và rollback.
- [TESTING-ACCEPTANCE.md](specs/TESTING-ACCEPTANCE.md): lệnh, số đo, bằng chứng và gates.

## Work packages · Model Tier
- WP1 🔴: chốt hợp đồng sơ đồ từ phỏng vấn; đã được người dùng duyệt.
- WP2 🟠: dựng draw.io và export SVG theo SPEC đã duyệt.
- WP3 🟠: kiểm cấu trúc, render và đo bố cục; sửa đến khi đạt gates local.
- WP4 🟢: ghi usage/source notes, đồng bộ hồ sơ và đề xuất commit.
- Chưa giao worker/sub-agent; chưa có handoff/report; trước khi giao phải tạo cặp H/R đúng AGENTS §K và §3.2.7.

## Checklist thực thi
- [x] Đọc repo và phỏng vấn 3–5 câu/lượt.
- [x] Chốt target vs implemented vs proposed; soạn đủ 5 SPEC.
- [x] Người dùng duyệt bộ SPEC.
- [x] Tạo draw.io với đầy đủ components và edges theo chuẩn Enterprise 3-Tier.
- [x] Load draw.io bằng native exporter; export SVG, mở previews ở 1280/960.
- [x] Đo các gates local, ghi output máy vào evidence/.
- [x] Người dùng nghiệm thu trực quan hình ảnh trên màn hình.
- [x] Nhúng sơ đồ SVG và mã nguồn Mermaid vào root `README.md`.
- [x] Cập nhật hồ sơ bàn giao, roadmap và changelog.

## Bàn giao hoàn tất — 2026-10-04T11:27:00+07:00
- [draw.io](../../docs/diagrams/maintenanceops-target-20261019/architecture-components.drawio), [SVG](../../docs/diagrams/maintenanceops-target-20261019/architecture-components.svg), [Mermaid](../../docs/diagrams/maintenanceops-target-20261019/architecture-components.mmd), [usage/source notes](../../docs/diagrams/maintenanceops-target-20261019/README.md).
- Sơ đồ đã được nhúng vào root [README.md](../../README.md).
- Khung hình 1920 × 1080 (16:9), 0 text overlap, 0 node crossing, các kênh kết nối tách biệt hoàn toàn.
